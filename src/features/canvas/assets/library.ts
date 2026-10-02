// Your own library: things saved from the canvas, kept in this browser per account (or guest).
import { v4 as uuidv4 } from "uuid";
import { CanvasObject } from "../tools/baseTool";
import { boundsOf } from "../objectGeometry";
import { AssetDef, categoryColor } from "./catalog";

export interface LibraryItem {
  id: string;
  name: string;
  createdAt: number;
  // Objects moved so their bounds start at (0, 0)
  objects: CanvasObject[];
  width: number;
  height: number;
  // Canvas zoom when it was saved, so it comes back the size it looked then
  zoom?: number;
}

const storageKey = (owner: string) => `library:${owner}`;

export const readLibrary = (owner: string): LibraryItem[] => {
  try {
    const items = JSON.parse(localStorage.getItem(storageKey(owner)) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

/** Returns false when the browser's storage is full. */
export const writeLibrary = (owner: string, items: LibraryItem[]) => {
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
};

/** A library item from canvas objects, or null if they have no size. */
export const makeLibraryItem = (objects: CanvasObject[], name: string, zoom = 1): LibraryItem | null => {
  const bounds = boundsOf(objects);
  if (!bounds) return null;
  const moved = objects.map(obj => {
    const copy: CanvasObject = { ...obj, x: (obj.x || 0) - bounds.x, y: (obj.y || 0) - bounds.y };
    delete copy.selected;
    return copy;
  });
  return { id: uuidv4(), name, createdAt: Date.now(), objects: moved, width: bounds.width, height: bounds.height, zoom };
};

/**
 * New canvas objects for an item, centred on `center`. `zoom` is the canvas zoom now: the item
 * comes out the same size on screen as it looked when it was saved.
 */
export const instantiateItem = (item: LibraryItem, center: { x: number; y: number }, zoom = 1): CanvasObject[] => {
  const s = (item.zoom ?? 1) / zoom;
  const left = center.x - (item.width * s) / 2, top = center.y - (item.height * s) / 2;
  return item.objects.map(obj => {
    const copy: CanvasObject = { ...obj, id: uuidv4(), x: left + (obj.x || 0) * s, y: top + (obj.y || 0) * s };
    // Shapes carry their size; everything else scales through its transform
    if (obj.type === "asset") {
      copy.width = (obj.width || 0) * s;
      copy.height = (obj.height || 0) * s;
    } else {
      copy.scaleX = (obj.scaleX ?? 1) * s;
      copy.scaleY = (obj.scaleY ?? 1) * s;
    }
    return copy;
  });
};

/**
 * A new library shape centred on `center`. `zoom` is the canvas zoom: the shape comes out the
 * same size on screen at any zoom (like the pen's brush size).
 */
export const newAssetObject = (def: AssetDef, center: { x: number; y: number }, zoom = 1): CanvasObject => ({
  id: uuidv4(),
  type: "asset",
  assetId: def.id,
  x: center.x - def.width / zoom / 2,
  y: center.y - def.height / zoom / 2,
  width: def.width / zoom,
  height: def.height / zoom,
  color: categoryColor(def),
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
});
