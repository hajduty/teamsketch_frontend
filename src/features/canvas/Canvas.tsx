import { useRef, useState, useEffect, FC, useCallback, useMemo } from "react";
import { Stage, Layer } from "react-konva";
import useWindowDimensions from "../../hooks/useWindowDimensions";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import { PenTool } from "./tools/penTool";
import { TextTool } from "./tools/textTool";
import { CanvasObject, Tool } from "./tools/baseTool";
import { TextRender } from "./components/TextRender";
import PenRender from "./components/PenRender";
import { useIsDoubleClick } from "../../hooks/useIsDoubleClick";
import { RemoteCursors } from "./components/RemoteCursors";
import { colorFor, readPeers } from "./presence";
import { bindLocalCanvas, GUEST_OWNER, loadLocalCanvas } from "./localCanvas";
import { SelectTool } from "./tools/selectTool";
import AssetRender from "./components/AssetRender";
import { DRAG_TYPE, insertFromLibrary, LibraryPayload } from "./assets/insert";
import InfiniteGrid from "./components/InfiniteGrid";
import { Minimap } from "./components/Minimap";
import { QuickMenu } from "./components/QuickMenu";
import { toolCursor } from "../../utils/toolCursor";
import { useAuth } from "../auth/AuthProvider";
import { useCanvasStore } from "./canvasStore";
import { useShallow } from "zustand/react/shallow";
import Konva from "konva";
import { useCanvasInteractions } from "../../hooks/useCanvasInteractions";
import { wsUrl } from "../../lib/apiClient";

export interface CanvasRef {
  clearCanvas: () => void;
  setTool: (tool: string) => void;
  setOption: (key: string, value: any) => void;
  undo: () => void;
  redo: () => void;
  canRedo: boolean;
  canUndo: boolean;
}

export interface History {
  id: string;            // Object ID
  historyId?: string;     // Unique history entry ID
  before: any;           // State before change
  after: any;            // State after change
  deleted?: boolean;      // Whether this history entry has been undone
  operation?: string;     // Type of change
}

/** Tools act on the primary (left) mouse button only; right-click opens the quick menu. */
const leftButtonOnly = <E extends { evt: MouseEvent }>(handler?: (e: E) => void) =>
  handler && ((e: E) => {
    if (e.evt.button !== 0) return;
    handler(e);
  });

const toPlainObject = (id: string, value: Y.Map<unknown>): CanvasObject => {
  const plain: Record<string, unknown> = { id };
  value.forEach((val, key) => {
    plain[key] = val instanceof Y.Array ? val.toArray() : val;
  });
  return plain as unknown as CanvasObject;
};

const sameValue = (a: unknown, b: unknown) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const sameObject = (a: CanvasObject, b: CanvasObject) => {
  const x = a as unknown as Record<string, unknown>, y = b as unknown as Record<string, unknown>;
  const keys = Object.keys(x);
  if (keys.length !== Object.keys(y).length) return false;
  return keys.every(key => sameValue(x[key], y[key]));
};

const TOOLS: Record<string, Tool> = {
  pen: PenTool,
  text: TextTool,
  select: SelectTool,
};

const TOOLS_COMPONENTS: Record<string, FC<any>> = {
  path: PenRender,
  text: TextRender,
  asset: AssetRender,
};

export const CanvasBoard: FC<{ roomId: string, role?: string }> = ({ roomId, role }) => {
  const { user, guest } = useAuth();
  const stageRef = useRef<Konva.Stage | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  //const [role, setRole] = useState<string>("");

  const isDoubleClick = useIsDoubleClick(200);
  const { width, height } = useWindowDimensions();
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentState = useRef<any>({});

  // This device's copy of the room: a guest's only copy, an account's offline cache
  const localOwner = guest ? GUEST_OWNER : user?.id;

  // Yjs setup
  // Lazy initialisers: useRef(new ...) would build a new doc/undo manager on every render,
  // and each undo manager stays subscribed to the doc. The saved copy is loaded first, so the
  // canvas shows straight away (and offline) and loading it isn't an undoable change.
  const [ydoc] = useState(() => {
    const doc = new Y.Doc();
    if (localOwner) loadLocalCanvas(localOwner, roomId, doc);
    return doc;
  });
  const [yObjects] = useState(() => ydoc.getMap<any>("objects"));
  // One awareness for the doc's lifetime, shared by every provider. A new one per provider
  // (e.g. after a hot reload) restarts its clock under the same client id, and everyone
  // ignores its cursor as outdated until the clock catches up.
  const [docAwareness] = useState(() => new Awareness(ydoc));
  const providerRef = useRef<WebsocketProvider | null>(null);
  const awarenessRef = useRef<any>(null);
  // Set once set up, for the cursor overlay
  const [awareness, setAwareness] = useState<any>(null);
  // Accounts: whether the server is reachable. Guests never connect.
  const [online, setOnline] = useState(false);
  // Don't flash "offline" while the first connection is still being made
  const [connectGraceOver, setConnectGraceOver] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const [undoManager] = useState(() => new Y.UndoManager(yObjects, {
    captureTimeout: 200,
  }));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isToolsDisabled = role === "none" || role === "viewer" || role === "";

  // Pick only what the board uses: subscribing to the whole store re-rendered every object
  // on unrelated updates, e.g. the zoom level and saved view written on each wheel tick
  const { tool: activeTool, options: toolOptions, init: initCanvasStore, editingId } = useCanvasStore(
    useShallow(state => ({
      tool: state.tool,
      options: state.options,
      init: state.init,
      editingId: state.editingId,
    }))
  );

  const setCanDelete = useCanvasStore(state => state.setCanDelete);

  // Right-click quick settings menu
  const [quickMenu, setQuickMenu] = useState<{ x: number; y: number } | null>(null);
  const closeQuickMenu = useCallback(() => setQuickMenu(null), []);

  // Zoom around the centre of the screen, for the zoom buttons
  const zoomTo = useCallback((targetScale: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const newScale = Math.min(20, Math.max(0.05, targetScale));
    const center = { x: stage.width() / 2, y: stage.height() / 2 };
    const worldCenter = { x: (center.x - stage.x()) / oldScale, y: (center.y - stage.y()) / oldScale };
    const position = { x: center.x - worldCenter.x * newScale, y: center.y - worldCenter.y * newScale };
    setStageScale(newScale);
    setStagePosition(position);
    useCanvasStore.getState().saveStageState(roomId, { ...position, scale: newScale });
  }, [roomId]);

  // Glide to another user at their zoom: centred on their cursor, or, when their pointer is off
  // the canvas, on the middle of their screen
  const jumpToPeer = useCallback((clientId: number) => {
    const stage = stageRef.current;
    const state = awarenessRef.current?.getStates().get(clientId);
    const target = state?.cursorPosition
      ? { ...state.cursorPosition, scale: state.view?.scale ?? stage?.scaleX() ?? 1 }
      : state?.view;
    if (!stage || !target) return;
    // Their exact zoom: wheel zoom has no limits, so neither does this
    const scale = Number.isFinite(target.scale) && target.scale > 0 ? target.scale : stage.scaleX();
    const position = { x: stage.width() / 2 - target.x * scale, y: stage.height() / 2 - target.y * scale };
    new Konva.Tween({
      node: stage,
      duration: 0.35,
      easing: Konva.Easings.EaseInOut,
      x: position.x,
      y: position.y,
      scaleX: scale,
      scaleY: scale,
      onUpdate: () => stage.fire("dragmove"), // keeps the minimap following
      onFinish: () => {
        setStageScale(scale);
        setStagePosition(position);
        useCanvasStore.getState().saveStageState(roomId, { ...position, scale });
      },
    }).play();
  }, [roomId]);

  useEffect(() => {
    useCanvasStore.setState({
      viewControls: {
        zoomIn: () => zoomTo((stageRef.current?.scaleX() ?? 1) * 1.25),
        zoomOut: () => zoomTo((stageRef.current?.scaleX() ?? 1) / 1.25),
        resetZoom: () => zoomTo(1),
        center: () => {
          const stage = stageRef.current;
          if (!stage) return { x: 0, y: 0 };
          return stage.getAbsoluteTransform().copy().invert().point({ x: stage.width() / 2, y: stage.height() / 2 });
        },
        clientToCanvas: (clientX: number, clientY: number) => {
          const stage = stageRef.current;
          if (!stage) return null;
          const box = stage.container().getBoundingClientRect();
          return stage.getAbsoluteTransform().copy().invert().point({ x: clientX - box.left, y: clientY - box.top });
        },
        jumpToPeer,
        peerLastActive: (clientId: number) => awarenessRef.current?.getStates().get(clientId)?.lastActive ?? null,
      },
    });
    return () => useCanvasStore.setState({ viewControls: null });
  }, [zoomTo, jumpToPeer]);

  useEffect(() => {
    useCanvasStore.setState({ zoom: stageScale });
  }, [stageScale]);

  // Share what we're looking at, so others can jump to it (with our zoom)
  const view = width && height
    ? { x: (width / 2 - stagePosition.x) / stageScale, y: (height / 2 - stagePosition.y) / stageScale, scale: stageScale }
    : null;
  // Latest view for the provider effect, which (re)creates our awareness state from scratch
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (!awareness) return;
    const timer = setTimeout(() => awareness.setLocalStateField("view", viewRef.current), 150);
    return () => clearTimeout(timer);
  }, [awareness, stagePosition, stageScale, width, height]);

  // Saved library items belong to whoever is signed in (or the guest)
  useEffect(() => {
    if (localOwner) useCanvasStore.getState().loadLibrary(localOwner);
  }, [localOwner]);

  // Library items dragged from the panel land where they're dropped
  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container || isToolsDisabled) return;
    // Both dragenter and dragover have to be cancelled to accept a drop (Firefox/Safari need
    // the dragenter one)
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (e: DragEvent) => {
      const data = e.dataTransfer?.getData(DRAG_TYPE);
      if (!data) return;
      e.preventDefault();
      try {
        const point = useCanvasStore.getState().viewControls?.clientToCanvas(e.clientX, e.clientY);
        insertFromLibrary(JSON.parse(data) as LibraryPayload, point ?? undefined);
      } catch {
        // Not something we can place
      }
    };
    container.addEventListener("dragenter", onDragOver);
    container.addEventListener("dragover", onDragOver);
    container.addEventListener("drop", onDrop);
    return () => {
      container.removeEventListener("dragenter", onDragOver);
      container.removeEventListener("dragover", onDragOver);
      container.removeEventListener("drop", onDrop);
    };
  }, [isToolsDisabled]);

  // Restore this room's saved view
  useEffect(() => {
    if (!roomId || !stageRef.current) return;

    const saved = useCanvasStore.getState().loadStageState(roomId);
    if (!saved) return;

    stageRef.current.position({ x: saved.x, y: saved.y });
    stageRef.current.scale({ x: saved.scale, y: saved.scale });

    setStagePosition({ x: saved.x, y: saved.y });
    setStageScale(saved.scale);
  }, [roomId, stageRef, setStagePosition, setStageScale]);

  useEffect(() => {
    initCanvasStore(ydoc, yObjects, undoManager);
  }, [initCanvasStore, ydoc, yObjects, undoManager]);

  useEffect(() => {
    if (!undoManager) return;

    const updateStatus = () => {
      useCanvasStore.getState().setUndoRedoStatus(
        undoManager.canUndo(),
        undoManager.canRedo()
      );
    };

    undoManager.on('stack-item-added', updateStatus);
    undoManager.on('stack-item-popped', updateStatus);

    updateStatus();

    return () => {
      undoManager.off('stack-item-added', updateStatus);
      undoManager.off('stack-item-popped', updateStatus);
    };
  }, [undoManager]);

  // Plain copy of each Y.Map, reused while it's unchanged so renderers can skip it by identity
  const plainCache = useRef(new Map<string, CanvasObject>());

  /**
   * Sync `objects` with Yjs. `changed` lists the objects known to have changed (from the
   * observer); without it every object is re-read and compared, keeping unchanged ones.
   */
  const updateObjectsFromYjs = useCallback((changed?: Set<string>) => {
    const cache = plainCache.current;
    const next = new Map<string, CanvasObject>();
    let dirty = false;
    yObjects.forEach((value, key) => {
      if (!(value instanceof Y.Map)) return;
      const cached = cache.get(key);
      if (cached && changed && !changed.has(key)) {
        next.set(key, cached);
        return;
      }
      const plain = toPlainObject(key, value);
      if (cached && !changed && sameObject(cached, plain)) {
        next.set(key, cached);
      } else {
        next.set(key, plain);
        dirty = true;
      }
    });
    if (next.size !== cache.size) dirty = true;
    plainCache.current = next;
    if (dirty) setObjects([...next.values()]);
  }, [yObjects]);

  useEffect(() => {
    awarenessRef.current = docAwareness;

    awarenessRef.current.setLocalState({
      userId: user?.id,
      username: user?.email,
      color: colorFor(user?.id),
      cursorPosition: null,
      view: viewRef.current,
      lastActive: Date.now(),
    });

    const awareness = awarenessRef.current;
    setAwareness(awareness);
    // Cursor moves also land here, so only publish the peer list when it actually changes
    let lastPeers = "";
    const handleAwareness = () => {
      const peers = readPeers(awareness.getStates(), awareness.clientID, user?.id);
      const key = JSON.stringify(peers);
      if (key === lastPeers) return;
      lastPeers = key;
      useCanvasStore.setState({ peers });
    };
    handleAwareness();
    awareness.on('change', handleAwareness);

    // Only re-read the objects the transaction touched (while drawing, just the stroke)
    const handleObjects = (events: Y.YEvent<any>[]) => {
      const changed = new Set<string>();
      for (const event of events) {
        if (event.target === yObjects) event.changes.keys.forEach((_, key) => changed.add(key));
        else if (typeof event.path[0] === "string") changed.add(event.path[0]);
      }
      updateObjectsFromYjs(changed);
    };
    yObjects.observeDeep(handleObjects);
    // Show what was loaded from this device
    updateObjectsFromYjs();

    const unbindLocal = localOwner ? bindLocalCanvas(localOwner, roomId, ydoc, ok => setSaveFailed(!ok)) : undefined;

    // Accounts sync through the room server; edits made while it's unreachable are kept above
    // and sent once it's back. Guests stay on this device.
    let handleStatus: ((event: { status: string }) => void) | undefined;
    if (!guest) {
      const token = localStorage.getItem("token");
      providerRef.current = new WebsocketProvider(`${wsUrl}/${roomId}/${token}`, "", ydoc, { awareness: docAwareness });
      handleStatus = ({ status }) => setOnline(status === 'connected');
      providerRef.current.on('status', handleStatus);
      setOnline(providerRef.current.wsconnected);
    }
    const grace = setTimeout(() => setConnectGraceOver(true), 2500);

    return () => {
      clearTimeout(grace);
      unbindLocal?.();
      awareness.off('change', handleAwareness);
      // Tell the others we left (sent before the socket closes), so no cursor is left behind
      awareness.setLocalState(null);
      useCanvasStore.setState({ peers: [] });
      yObjects.unobserveDeep(handleObjects);
      if (handleStatus) providerRef.current?.off('status', handleStatus);
      providerRef.current?.disconnect();
      providerRef.current = null;
    };
  }, [updateObjectsFromYjs, yObjects, docAwareness, ydoc, roomId, guest, localOwner]);

  // The objects don't depend on the view, so zooming and panning reuse the same elements
  const renderedObjects = useMemo(() => objects.map((obj) => {
    const ToolComponent = TOOLS_COMPONENTS[obj.type];
    return ToolComponent ? (
      <ToolComponent
        key={obj.id}
        obj={obj}
        yObjects={yObjects}
        toolOptions={toolOptions}
        activeTool={activeTool}
        updateObjectsFromYjs={updateObjectsFromYjs}
        isSpacePressed={isSpacePressed}
        isSelected={selectedId === obj.id}
        stageRef={stageRef}
        userId={user?.id}
        editing={editingId === obj.id}
      />
    ) : null;
  }), [objects, yObjects, toolOptions, activeTool, updateObjectsFromYjs, isSpacePressed, selectedId, user?.id, editingId]);

  const tool = TOOLS[activeTool] || PenTool;
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleClick,
    handleDblClick
  } = tool.create(
    yObjects,
    isDrawing,
    setIsDrawing,
    currentState,
    toolOptions, // <-- Use toolOptions from store
    updateObjectsFromYjs,
    activeTool,
    setSelectedId,
    awarenessRef.current?.getLocalState()?.userId,
    setCanDelete
  );

  const {
    wrappedHandleMouseMove,
    handleWheelZoom,
    handleStageDragStart,
    handleStageDragEnd,
  } = useCanvasInteractions({
    stageRef,
    providerRef,
    isToolsDisabled,
    handleMouseMove,
    stageScale,
    setStageScale,
    setStagePosition,
    setIsSpacePressed,
    roomId
  });

  return (
    <>
      <Stage className="m-0 p-0 canvas-stage"
        // Tool cursor lives in a CSS variable so pan/resize cursors (set inline by the pan
        // code and Konva's transformer) can override it and fall back to it when cleared
        style={{ "--tool-cursor": toolCursor(activeTool, toolOptions, isToolsDisabled) } as React.CSSProperties}
        ref={stageRef}
        width={width!}
        height={height!}
        draggable={isSpacePressed}
        scale={{ x: stageScale, y: stageScale }}
        position={stagePosition}
        onWheel={handleWheelZoom}
        onDragStart={handleStageDragStart}
        onDragEnd={handleStageDragEnd}
        onTouchStart={!isSpacePressed && !isToolsDisabled ? handleMouseDown : undefined}
        onTouchMove={!isSpacePressed ? wrappedHandleMouseMove : undefined}
        onTouchEnd={!isSpacePressed && !isToolsDisabled ? handleMouseUp : undefined}
        onMouseDown={!isSpacePressed && !isToolsDisabled ? leftButtonOnly(handleMouseDown) : undefined}
        onMouseMove={!isSpacePressed ? wrappedHandleMouseMove : undefined}
        onMouseUp={!isSpacePressed && !isToolsDisabled ? leftButtonOnly(handleMouseUp) : undefined}
        onClick={!isSpacePressed && !isToolsDisabled ? leftButtonOnly(handleClick) : undefined}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          if (isToolsDisabled || isSpacePressed) return;
          setQuickMenu({ x: e.evt.clientX, y: e.evt.clientY });
        }}
        onDblClick={(e) => {
          if (!isSpacePressed && !isToolsDisabled && (isDoubleClick() && handleClick)) {
            handleDblClick?.(e);
          }
        }}
      >
        <InfiniteGrid stageRef={stageRef} roomId={roomId} />
        <Layer>
          {renderedObjects}
        </Layer>
      </Stage>
      <RemoteCursors stageRef={stageRef} awareness={awareness} />
      {(!guest && !online && connectGraceOver) || saveFailed ? (
        <div
          role="status"
          className="fixed top-3 left-1/2 -translate-x-1/2 max-sm:top-16 z-20 island flex items-center gap-2 h-9 px-3 text-xs text-ink-muted pointer-events-none"
        >
          <span className={`size-1.5 rounded-full ${saveFailed ? "bg-danger" : "bg-[#f59e0b]"}`} />
          {saveFailed
            ? "Storage full: recent changes aren't saved on this device"
            : "Offline. Changes are saved on this device and sync when you're back."}
        </div>
      ) : null}
      {quickMenu && <QuickMenu x={quickMenu.x} y={quickMenu.y} onClose={closeQuickMenu} />}
      <Minimap
        stageRef={stageRef}
        objects={objects}
        stageScale={stageScale}
        stagePosition={stagePosition}
        setStagePosition={setStagePosition}
        roomId={roomId}
      />
    </>
  );
};