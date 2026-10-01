import { FC, useEffect, useRef } from "react";
import { AssetDef, categoryColor } from "../assets/catalog";
import { drawAsset, iconFontReady } from "../assets/draw";
import { LibraryItem } from "../assets/library";
import { CanvasObject } from "../tools/baseTool";
import { objectTransform } from "../objectGeometry";
import { getAsset } from "../assets/catalog";

const PADDING = 4;

/** Draws a library item's objects (shapes, strokes, text) scaled to fit. */
const drawObjects = (ctx: CanvasRenderingContext2D, objects: CanvasObject[], scale: number) => {
  for (const obj of objects) {
    const m = objectTransform(obj).getMatrix();
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.globalAlpha = obj.opacity ?? 1;
    if (obj.type === "asset") {
      const def = getAsset(obj.assetId);
      if (def) drawAsset(ctx, def, obj.width || def.width, obj.height || def.height, { color: obj.color || categoryColor(def), label: obj.label });
    } else if (obj.type === "text") {
      ctx.fillStyle = obj.color || "#ececef";
      ctx.font = `${obj.fontSize || 16}px ${obj.fontFamily || "Arial"}`;
      ctx.textBaseline = "top";
      String(obj.text ?? "").split("\n").forEach((line, i) => ctx.fillText(line, 0, i * (obj.fontSize || 16) * 1.2));
    } else if (Array.isArray(obj.points) && obj.points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(obj.points[0], obj.points[1]);
      for (let i = 2; i + 1 < obj.points.length; i += 2) ctx.lineTo(obj.points[i], obj.points[i + 1]);
      if (obj.shape) ctx.closePath();
      ctx.strokeStyle = obj.color || "#ececef";
      // Thin strokes would vanish at thumbnail size
      ctx.lineWidth = Math.max((obj.strokeWidth || 2) * Math.abs(obj.scaleX ?? 1), 1.5 / scale);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    ctx.restore();
  }
};

/** Preview of a built-in shape or a saved library item, drawn like on the canvas. */
export const AssetThumb: FC<{ asset?: AssetDef; item?: LibraryItem; size: number; className?: string }> = ({ asset, item, size, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const draw = () => {
      const canvas = ref.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const w = asset ? asset.width : item?.width ?? 1;
      const h = asset ? asset.height : item?.height ?? 1;
      const scale = Math.min((size - PADDING * 2) / w, (size - PADDING * 2) / h);
      ctx.translate((size - w * scale) / 2, (size - h * scale) / 2);
      ctx.scale(scale, scale);
      if (asset) drawAsset(ctx, asset, asset.width, asset.height, { color: categoryColor(asset), hideLabel: true });
      else if (item) drawObjects(ctx, item.objects, scale);
    };
    draw();
    let cancelled = false;
    iconFontReady().then(() => { if (!cancelled) draw(); });
    return () => { cancelled = true; };
  }, [asset, item, size]);

  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-hidden="true" />;
};
