// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef } from "react";
import throttle from "lodash/throttle";
import Konva from "konva";
import { useCanvasStore } from "../features/canvas/canvasStore";

interface UseCanvasInteractionsProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  providerRef: React.MutableRefObject<any>;
  isToolsDisabled: boolean;
  handleMouseMove?: (e: any) => void;
  stageScale: number;
  setStageScale: (scale: number) => void;
  setStagePosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setIsSpacePressed: (pressed: boolean) => void;
  roomId: string;
}

export function useCanvasInteractions({
  stageRef,
  providerRef,
  isToolsDisabled,
  handleMouseMove,
  stageScale,
  setStageScale,
  setStagePosition,
  setIsSpacePressed,
  roomId
}: UseCanvasInteractionsProps) {
  // Debounced awareness cursor update
  const debouncedSetCursor = useMemo(() =>
    throttle((x: number, y: number) => {
      if (providerRef.current) {
        const awareness = providerRef.current.awareness;
        const position = { x, y };
        awareness.setLocalState({ ...awareness.getLocalState(), cursorPosition: position, lastActive: Date.now() });
      }
    }, 8)
    , [providerRef]);


  const editing = useCanvasStore(state => state.editing);

  /*   useEffect(() => {
      console.log("editing is", editing); // this logs correctly
    }, [editing]); */

  // Clean up debounce on unmount
  useEffect(() => {
    return () => debouncedSetCursor.cancel();
  }, [debouncedSetCursor]);

  // Share our cursor while the pointer is over the canvas, and hide it while it's off (over
  // the UI or outside the window). Uses the browser's pointer events rather than Konva's:
  // Konva sends no mousemove while an object is being dragged, which froze the cursor.
  useEffect(() => {
    let onCanvas = false;
    const onMove = (e: PointerEvent) => {
      const stage = stageRef.current;
      const container = stage?.container();
      if (!stage || !container?.contains(e.target as Node) || isToolsDisabled) return;
      onCanvas = true;
      const box = container.getBoundingClientRect();
      const point = stage.getAbsoluteTransform().copy().invert().point({ x: e.clientX - box.left, y: e.clientY - box.top });
      debouncedSetCursor(point.x, point.y);
    };
    const leave = () => {
      if (!onCanvas) return;
      onCanvas = false;
      debouncedSetCursor.cancel();
      providerRef.current?.awareness.setLocalStateField("cursorPosition", null);
    };
    const onOver = (e: PointerEvent) => {
      const container = stageRef.current?.container();
      if (container?.contains(e.target as Node)) onCanvas = true;
      else leave();
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) leave(); // left the window
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    window.addEventListener("blur", leave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", leave);
    };
  }, [stageRef, providerRef, debouncedSetCursor, isToolsDisabled]);

  // Mouse move for the active tool (the cursor itself is shared above)
  const wrappedHandleMouseMove = useCallback((e: any) => {
    if (isToolsDisabled) return;
    handleMouseMove?.(e);
  }, [isToolsDisabled, handleMouseMove]);

  // Hand cursor while panning: "grab" with Space held, "grabbing" while dragging
  const spaceHeldRef = useRef(false);
  const setCursor = useCallback((cursor: string) => {
    const container = stageRef.current?.container();
    if (container) container.style.cursor = cursor;
  }, [stageRef]);

  const releaseSpace = useCallback(() => {
    spaceHeldRef.current = false;
    stageRef.current?.draggable(false);
    setIsSpacePressed(false);
    setCursor("");
  }, [stageRef, setIsSpacePressed, setCursor]);

  // Space key toggles draggable
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (editing) return;

    if (e.code === "Space") {
      stageRef.current?.draggable(true);
      setIsSpacePressed(true);
      if (!spaceHeldRef.current) {
        spaceHeldRef.current = true;
        setCursor(stageRef.current?.isDragging() ? "grabbing" : "grab");
      }
    }
  }, [stageRef, setIsSpacePressed, setCursor, editing]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (editing) return;

    if (e.code === "Space") {
      releaseSpace();
    }
  }, [releaseSpace, editing]);

  // Stage drag start (only the stage itself, not objects being moved)
  const handleStageDragStart = useCallback((e: any) => {
    if (e.target === stageRef.current) setCursor("grabbing");
  }, [stageRef, setCursor]);

  // Pan by holding the middle mouse button (scroll-wheel click), same as Space + drag
  useEffect(() => {
    let pan: { pointerId: number; startX: number; startY: number; stageX: number; stageY: number } | null = null;

    const onCanvas = (e: Event) => {
      const container = stageRef.current?.container();
      return !!container && container.contains(e.target as Node);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 1 || !onCanvas(e)) return;
      const stage = stageRef.current;
      if (!stage) return;
      e.preventDefault();
      pan = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, stageX: stage.x(), stageY: stage.y() };
      stage.container().setPointerCapture?.(e.pointerId);
      setCursor("grabbing");
    };

    // Stop the browser's middle-click auto-scroll on the canvas
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 && onCanvas(e)) e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      const stage = stageRef.current;
      if (!pan || e.pointerId !== pan.pointerId || !stage) return;
      stage.position({ x: pan.stageX + e.clientX - pan.startX, y: pan.stageY + e.clientY - pan.startY });
      stage.fire("dragmove"); // keeps the minimap following, as with Space-drag
    };

    const onPointerUp = (e: PointerEvent) => {
      const stage = stageRef.current;
      if (!pan || e.pointerId !== pan.pointerId) return;
      pan = null;
      stage?.container().releasePointerCapture?.(e.pointerId);
      setCursor(spaceHeldRef.current ? "grab" : "");
      if (!stage) return;
      const position = { x: stage.x(), y: stage.y() };
      setStagePosition(position);
      useCanvasStore.getState().saveStageState(roomId, position);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [stageRef, setCursor, setStagePosition, roomId]);

  // Wheel zoom handler
  const handleWheelZoom = useCallback((e: any) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.05;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setStageScale(newScale);
    setStagePosition(newPos);
    useCanvasStore.getState().saveStageState(roomId, { x: newPos.x, y: newPos.y, scale: newScale });
  }, [stageRef, stageScale, setStageScale, setStagePosition]);

  // Drag end handler
  const handleStageDragEnd = useCallback((e: any) => {
    if (e.target === stageRef.current) setCursor(spaceHeldRef.current ? "grab" : "");
    setStagePosition(e.target.position());
    //console.log(e.target.position());
    useCanvasStore.getState().saveStageState(roomId, { x: e.target.position().x, y: e.target.position().y });
  }, [setStagePosition, setCursor]);

  // Attach key listeners
  useEffect(() => {
    // Space released outside the window (e.g. alt-tab) never fires keyup; don't get stuck panning
    const handleBlur = () => {
      if (spaceHeldRef.current) releaseSpace();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, releaseSpace]);

  // Mobile handlers
  useEffect(() => {
    const stage = stageRef.current?.getStage();
    if (!stage) return;

    const content = stage.content;

    let lastDist = 0;
    let lastCenter = { x: 0, y: 0 };

    const getDistance = (p1: Touch, p2: Touch) => {
      return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
    };

    const getCenter = (p1: Touch, p2: Touch) => {
      return {
        x: (p1.clientX + p2.clientX) / 2,
        y: (p1.clientY + p2.clientY) / 2,
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        setIsSpacePressed(true); // prevent drawing
        lastDist = getDistance(e.touches[0], e.touches[1]);
        lastCenter = getCenter(e.touches[0], e.touches[1]);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [touch1, touch2] = e.touches;
        const center = getCenter(touch1, touch2);

        const dx = center.x - lastCenter.x;
        const dy = center.y - lastCenter.y;

        setStagePosition(pos => ({
          x: pos.x + dx,
          y: pos.y + dy,
        }));

        lastCenter = center;

        //const dist = getDistance(touch1, touch2);
        //const scaleBy = dist / lastDist;
        //setStageScale(Math.max(0.1, Math.min(stageScale * scaleBy, 5)));
        //lastDist = dist;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        setIsSpacePressed(false);
      }
    };

    content.addEventListener("touchstart", handleTouchStart, { passive: false });
    content.addEventListener("touchmove", handleTouchMove, { passive: false });
    content.addEventListener("touchend", handleTouchEnd);
    content.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      content.removeEventListener("touchstart", handleTouchStart);
      content.removeEventListener("touchmove", handleTouchMove);
      content.removeEventListener("touchend", handleTouchEnd);
      content.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [stageRef, setIsSpacePressed, setStagePosition, setStageScale]);

  return {
    wrappedHandleMouseMove,
    handleKeyDown,
    handleKeyUp,
    handleWheelZoom,
    handleStageDragStart,
    handleStageDragEnd,
  };
}
