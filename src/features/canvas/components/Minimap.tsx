import { FC, useCallback, useEffect, useRef, useState } from "react";
import Konva from "konva";
import { CanvasObject } from "../tools/baseTool";
import { useCanvasStore } from "../canvasStore";
import { useIsMobile } from "../../../hooks/useIsMobile";

interface MinimapProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  objects: CanvasObject[];
  stageScale: number;
  stagePosition: { x: number; y: number };
  setStagePosition: (position: { x: number; y: number }) => void;
  roomId: string;
}

const WIDTH = 200;
const HEIGHT = 130;
const MOBILE_WIDTH = 150;
const MOBILE_HEIGHT = 100;
const PADDING = 0.08;       // extra space around the content, as a fraction of its size
const HIDE_AFTER_MS = 1500;

type Rect = { x: number; y: number; width: number; height: number };

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

/** World-space bounds of an object, applying its move/rotate/scale like Konva does. */
const objectBounds = (obj: CanvasObject): Rect | null => {
  let local: { x: number; y: number }[];
  if (obj.type === "text") {
    const lines = String(obj.text ?? "").split("\n").length;
    const w = obj.width || 200, h = (obj.fontSize || 16) * 1.2 * lines;
    local = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  } else if (Array.isArray(obj.points) && obj.points.length >= 2) {
    local = [];
    for (let i = 0; i + 1 < obj.points.length; i += 2) local.push({ x: obj.points[i], y: obj.points[i + 1] });
  } else {
    return null;
  }
  const t = objectTransform(obj);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of local) {
    const q = t.point(p);
    minX = Math.min(minX, q.x); minY = Math.min(minY, q.y);
    maxX = Math.max(maxX, q.x); maxY = Math.max(maxY, q.y);
  }
  const pad = (obj.strokeWidth || 0) / 2;
  return { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
};

const objectTransform = (obj: CanvasObject) => {
  const t = new Konva.Transform();
  t.translate(obj.x || 0, obj.y || 0);
  t.rotate(((obj.rotation || 0) * Math.PI) / 180);
  t.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
  return t;
};

export const Minimap: FC<MinimapProps> = ({ stageRef, objects, stageScale, stagePosition, setStagePosition, roomId }) => {
  const isMobile = useIsMobile();
  const width = isMobile ? MOBILE_WIDTH : WIDTH;
  const height = isMobile ? MOBILE_HEIGHT : HEIGHT;

  const backgroundColor = useCanvasStore(state => state.stageStates[roomId]?.backgroundColor) ?? "#111111";
  const borderColor = useCanvasStore(state => state.stageStates[roomId]?.borderColor) ?? "#333333";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // While a drag that started elsewhere (e.g. a pen stroke) is in progress, let the pointer
  // pass through; otherwise the canvas would miss the mouseup and keep drawing.
  const [passThrough, setPassThrough] = useState(false);
  const hoveredRef = useRef(false);
  const draggingRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Mapping from world to minimap, kept fixed while dragging so the map doesn't shift under the pointer
  const mappingRef = useRef<{ bounds: Rect; scale: number; offsetX: number; offsetY: number } | null>(null);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!hoveredRef.current && !draggingRef.current) setVisible(false);
    }, HIDE_AFTER_MS);
  }, []);

  // Show when zooming. Skip the first scale values (initial render and restoring the saved view).
  const lastScale = useRef<number | null>(null);
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    const previous = lastScale.current;
    lastScale.current = stageScale;
    if (previous === null || previous === stageScale) return;
    if (Date.now() - mountedAt.current < 1000) return;
    setVisible(true);
    scheduleHide();
  }, [stageScale, scheduleHide]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setPassThrough(true);
    };
    const onUp = () => setPassThrough(false);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stage.scaleX() || 1;
    const viewport: Rect = { x: -stage.x() / s, y: -stage.y() / s, width: stage.width() / s, height: stage.height() / s };

    if (!draggingRef.current || !mappingRef.current) {
      let bounds = viewport;
      for (const obj of objects) {
        const b = objectBounds(obj);
        if (b) bounds = union(bounds, b);
      }
      const pad = Math.max(bounds.width, bounds.height) * PADDING;
      bounds = { x: bounds.x - pad, y: bounds.y - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 };
      const scale = Math.min(width / bounds.width, height / bounds.height);
      mappingRef.current = {
        bounds,
        scale,
        offsetX: (width - bounds.width * scale) / 2,
        offsetY: (height - bounds.height * scale) / 2,
      };
    }
    const { bounds, scale, offsetX, offsetY } = mappingRef.current;
    const toMap = new Konva.Transform([scale, 0, 0, scale, offsetX - bounds.x * scale, offsetY - bounds.y * scale]);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const obj of objects) {
      const t = toMap.copy().multiply(objectTransform(obj));
      ctx.globalAlpha = obj.opacity ?? 1;

      if (obj.type === "text") {
        const fontSize = (obj.fontSize || 16) * scale * (obj.scaleY ?? 1);
        const origin = t.point({ x: 0, y: 0 });
        ctx.fillStyle = obj.color || "#ffffff";
        if (fontSize >= 4) {
          ctx.font = `${fontSize}px ${obj.fontFamily || "Arial"}`;
          ctx.textBaseline = "top";
          String(obj.text ?? "").split("\n").forEach((line, i) => ctx.fillText(line, origin.x, origin.y + i * fontSize * 1.2));
        } else {
          // Too small to read: show where the text is
          const b = objectBounds(obj);
          if (b) {
            ctx.globalAlpha *= 0.5;
            ctx.fillRect(offsetX + (b.x - bounds.x) * scale, offsetY + (b.y - bounds.y) * scale, Math.max(2, b.width * scale), Math.max(1, b.height * scale));
          }
        }
        continue;
      }

      if (!Array.isArray(obj.points) || obj.points.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i + 1 < obj.points.length; i += 2) {
        const p = t.point({ x: obj.points[i], y: obj.points[i + 1] });
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      if (obj.shape) ctx.closePath();
      ctx.strokeStyle = obj.color || "#ffffff";
      // Keep thin strokes visible at small map scales
      ctx.lineWidth = Math.max(1, (obj.strokeWidth || 2) * scale * Math.abs(obj.scaleX ?? 1));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Current view
    const vx = offsetX + (viewport.x - bounds.x) * scale;
    const vy = offsetY + (viewport.y - bounds.y) * scale;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(vx, vy, viewport.width * scale, viewport.height * scale);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, viewport.width * scale, viewport.height * scale);
  }, [stageRef, objects, width, height, backgroundColor]);

  // Redraw while visible whenever the view or the content changes
  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [visible, draw, stageScale, stagePosition]);

  // Space-drag panning moves the stage without updating React state; follow it directly
  useEffect(() => {
    const stage = stageRef.current;
    if (!visible || !stage) return;
    stage.on("dragmove.minimap", draw);
    return () => { stage.off("dragmove.minimap"); };
  }, [visible, draw, stageRef]);

  // Centre the view on the clicked/dragged map position
  const navigate = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const stage = stageRef.current;
    const mapping = mappingRef.current;
    if (!stage || !mapping) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const worldX = mapping.bounds.x + (e.clientX - rect.left - mapping.offsetX) / mapping.scale;
    const worldY = mapping.bounds.y + (e.clientY - rect.top - mapping.offsetY) / mapping.scale;
    const s = stage.scaleX() || 1;
    const position = { x: stage.width() / 2 - worldX * s, y: stage.height() / 2 - worldY * s };
    setStagePosition(position);
    useCanvasStore.getState().saveStageState(roomId, position);
  }, [stageRef, setStagePosition, roomId]);

  return (
    <div
      ref={containerRef}
      className={`fixed right-2 z-3 rounded-md overflow-hidden border border-t-zinc-700 shadow-2xl shadow-black transition-opacity duration-300
        ${isMobile ? "bottom-40" : "bottom-14"}
        ${visible ? "opacity-100" : "opacity-0"} ${!visible || passThrough ? "pointer-events-none" : ""}`}
      style={{ width, height, borderColor }}
      onPointerEnter={() => { hoveredRef.current = true; clearTimeout(hideTimer.current); }}
      onPointerLeave={() => { hoveredRef.current = false; scheduleHide(); }}
    >
      <canvas
        ref={canvasRef}
        className="block cursor-pointer touch-none"
        style={{ width, height }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          navigate(e);
        }}
        onPointerMove={(e) => { if (draggingRef.current) navigate(e); }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
          scheduleHide();
        }}
      />
    </div>
  );
};
