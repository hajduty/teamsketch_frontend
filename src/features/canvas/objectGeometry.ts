// Where canvas objects are in canvas coordinates, applying their move/rotate/scale like Konva does.
import Konva from "konva";
import { CanvasObject } from "./tools/baseTool";

export type Rect = { x: number; y: number; width: number; height: number };

export const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

export const objectTransform = (obj: CanvasObject) => {
  const t = new Konva.Transform();
  t.translate(obj.x || 0, obj.y || 0);
  t.rotate(((obj.rotation || 0) * Math.PI) / 180);
  t.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
  return t;
};

/** Corners/points of an object before its transform. */
const localPoints = (obj: CanvasObject): { x: number; y: number }[] | null => {
  if (obj.type === "text") {
    const lines = String(obj.text ?? "").split("\n").length;
    const w = obj.width || 200, h = (obj.fontSize || 16) * 1.2 * lines;
    return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  }
  if (obj.type === "asset") {
    const w = obj.width || 0, h = obj.height || 0;
    return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  }
  if (Array.isArray(obj.points) && obj.points.length >= 2) {
    const points = [];
    for (let i = 0; i + 1 < obj.points.length; i += 2) points.push({ x: obj.points[i], y: obj.points[i + 1] });
    return points;
  }
  return null;
};

export const objectBounds = (obj: CanvasObject): Rect | null => {
  const local = localPoints(obj);
  if (!local) return null;
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

/** The placed library shape a pointer event landed on, if any. */
export const assetNodeAt = (target: Konva.Node | null | undefined): Konva.Node | null => {
  if (!target) return null;
  if (target.getAttr("assetId")) return target;
  return target.findAncestor((n: Konva.Node) => !!n.getAttr("assetId")) ?? null;
};

/** Bounds of several objects together, or null when none has a size. */
export const boundsOf = (objects: CanvasObject[]): Rect | null => {
  let bounds: Rect | null = null;
  for (const obj of objects) {
    const b = objectBounds(obj);
    if (b) bounds = bounds ? union(bounds, b) : b;
  }
  return bounds;
};
