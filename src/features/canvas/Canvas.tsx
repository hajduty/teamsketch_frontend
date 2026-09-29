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
import { SelectTool } from "./tools/selectTool";
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
import { Permissions } from "../../types/permission";

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
  select: SelectTool
};

const TOOLS_COMPONENTS: Record<string, FC<any>> = {
  path: PenRender,
  text: TextRender,
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

  // Yjs setup
  // Lazy initialisers: useRef(new ...) would build a new doc/undo manager on every render,
  // and each undo manager stays subscribed to the doc
  const [ydoc] = useState(() => new Y.Doc());
  const [yObjects] = useState(() => ydoc.getMap<any>("objects"));
  // One awareness for the doc's lifetime, shared by every provider. A new one per provider
  // (e.g. after a hot reload) restarts its clock under the same client id, and everyone
  // ignores its cursor as outdated until the clock catches up.
  const [docAwareness] = useState(() => new Awareness(ydoc));
  const providerRef = useRef<WebsocketProvider | null>(null);
  const awarenessRef = useRef<any>(null);
  // Set once connected, for the cursor overlay
  const [awareness, setAwareness] = useState<any>(null);

  const [undoManager] = useState(() => new Y.UndoManager(yObjects, {
    captureTimeout: 200,
  }));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isToolsDisabled = role === "none" || role === "viewer" || role === "";

  // Pick only what the board uses: subscribing to the whole store re-rendered every object
  // on unrelated updates, e.g. the zoom level and saved view written on each wheel tick
  const { tool: activeTool, options: toolOptions, init: initCanvasStore, editingId, addGuestRoom } = useCanvasStore(
    useShallow(state => ({
      tool: state.tool,
      options: state.options,
      init: state.init,
      editingId: state.editingId,
      addGuestRoom: state.addGuestRoom,
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

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!roomId || !stageRef.current) return;

    if (!isConnected) return;

    const saved = useCanvasStore.getState().loadStageState(roomId);
    if (!saved) return;

    stageRef.current.position({ x: saved.x, y: saved.y });
    stageRef.current.scale({ x: saved.scale, y: saved.scale });

    setStagePosition({ x: saved.x, y: saved.y });
    setStageScale(saved.scale);
  }, [roomId, stageRef, setStagePosition, setStageScale, isConnected]);

  useEffect(() => {
    const setup = async () => {
      await initCanvasStore(ydoc, yObjects, undoManager);

      if (guest) {
        const room: Permissions = { role: "editor", room: roomId, userId: user?.id!, userEmail: user?.email! };
        addGuestRoom(room);
      }
    };

    setup();
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
    const token = localStorage.getItem("token");
    const roomName = roomId;

    providerRef.current = new WebsocketProvider(
      `${wsUrl}/${roomName}/${token}`,
      "",
      ydoc,
      { awareness: docAwareness }
    );

    awarenessRef.current = providerRef.current.awareness;

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

    const handleStatus = ({ status }: { status: string }) => {
      setIsConnected(status === 'connected');
    };

    const handleSync = (isSynced: boolean) => {
      if (isSynced) {
        setIsConnected(true);
      }
    };

    providerRef.current.on('status', handleStatus);
    providerRef.current.on('sync', handleSync);

    if (providerRef.current.wsconnected) {
      setIsConnected(true);
    }

    return () => {
      awareness.off('change', handleAwareness);
      // Tell the others we left (sent before the socket closes), so no cursor is left behind
      awareness.setLocalState(null);
      useCanvasStore.setState({ peers: [] });
      yObjects.unobserveDeep(handleObjects);
      providerRef.current?.off('status', handleStatus);
      providerRef.current?.off('sync', handleSync);
      providerRef.current?.disconnect();
    };
  }, [updateObjectsFromYjs, yObjects, docAwareness]);

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

  if (!isConnected) {
    return (
      <div className="m-0 p-0 canvas-stage">
        <svg
          className="h-4 w-4 text-white animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      </div>
    )
  }

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