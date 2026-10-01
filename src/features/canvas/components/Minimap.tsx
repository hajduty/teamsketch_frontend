import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { CanvasObject } from "../tools/baseTool";
import { useCanvasStore } from "../canvasStore";
import { useIsCompact } from "../../../hooks/useIsCompact";
import { objectBounds, objectTransform, Rect, union } from "../objectGeometry";
import { getAsset, categoryColor } from "../assets/catalog";
import { drawAsset } from "../assets/draw";

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

// Objects keep their identity until they change, so their bounds can be cached
const boundsCache = new WeakMap<CanvasObject, Rect | null>();
const cachedBounds = (obj: CanvasObject) => {
  if (!boundsCache.has(obj)) boundsCache.set(obj, objectBounds(obj));
  return boundsCache.get(obj)!;
};

export const Minimap: FC<MinimapProps> = ({ stageRef, objects, stageScale, stagePosition, setStagePosition, roomId }) => {
  const compact = useIsCompact();
  const width = compact ? MOBILE_WIDTH : WIDTH;
  const height = compact ? MOBILE_HEIGHT : HEIGHT;

  const backgroundColor = useCanvasStore(state => state.stageStates[roomId]?.backgroundColor) ?? "#18191c";
  const borderColor = useCanvasStore(state => state.stageStates[roomId]?.borderColor) ?? "#2a2c31";

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

  const contentBounds = useMemo(() => {
    let bounds: Rect | null = null;
    for (const obj of objects) {
      const b = cachedBounds(obj);
      if (b) bounds = bounds ? union(bounds, b) : b;
    }
    return bounds;
  }, [objects]);

  // The objects drawn at the current mapping; redrawn only when the content or mapping changes
  const contentLayer = useRef<{ canvas: HTMLCanvasElement; key: unknown[] } | null>(null);

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
      let bounds = contentBounds ? union(viewport, contentBounds) : viewport;
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
    const key = [objects, bounds.x, bounds.y, scale, width, height, dpr, backgroundColor];
    const layer = contentLayer.current;
    if (!layer || layer.key.some((value, i) => value !== key[i])) {
      const layerCanvas = layer?.canvas ?? document.createElement("canvas");
      layerCanvas.width = canvas.width;
      layerCanvas.height = canvas.height;
      drawContent(layerCanvas, bounds, scale, offsetX, offsetY, dpr);
      contentLayer.current = { canvas: layerCanvas, key };
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(contentLayer.current!.canvas, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Current view
    const vx = offsetX + (viewport.x - bounds.x) * scale;
    const vy = offsetY + (viewport.y - bounds.y) * scale;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(vx, vy, viewport.width * scale, viewport.height * scale);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, viewport.width * scale, viewport.height * scale);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- drawContent only reads values listed here
  }, [stageRef, objects, contentBounds, width, height, backgroundColor]);

  const drawContent = (canvas: HTMLCanvasElement, bounds: Rect, scale: number, offsetX: number, offsetY: number, dpr: number) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const toMap = new Konva.Transform([scale, 0, 0, scale, offsetX - bounds.x * scale, offsetY - bounds.y * scale]);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const obj of objects) {
      const t = toMap.copy().multiply(objectTransform(obj));
      ctx.globalAlpha = obj.opacity ?? 1;

      if (obj.type === "asset") {
        const def = getAsset(obj.assetId);
        if (!def) continue;
        // Same drawing as on the canvas, in the map's scale
        const m = t.getMatrix();
        ctx.save();
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        drawAsset(ctx, def, obj.width || def.width, obj.height || def.height, { color: obj.color || categoryColor(def), label: obj.label });
        ctx.restore();
        continue;
      }

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
          const b = cachedBounds(obj);
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
  };

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
      className={`fixed right-3 z-20 rounded-xl overflow-hidden border shadow-2xl shadow-black/60 transition-opacity duration-300
        ${compact ? "bottom-[72px]" : "bottom-3"}
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
