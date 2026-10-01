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
export const makeLibraryItem = (objects: CanvasObject[], name: string): LibraryItem | null => {
  const bounds = boundsOf(objects);
  if (!bounds) return null;
  const moved = objects.map(obj => {
    const copy: CanvasObject = { ...obj, x: (obj.x || 0) - bounds.x, y: (obj.y || 0) - bounds.y };
    delete copy.selected;
    return copy;
  });
  return { id: uuidv4(), name, createdAt: Date.now(), objects: moved, width: bounds.width, height: bounds.height };
};

/** New canvas objects for an item, centred on `center`. */
export const instantiateItem = (item: LibraryItem, center: { x: number; y: number }): CanvasObject[] => {
  const dx = center.x - item.width / 2, dy = center.y - item.height / 2;
  return item.objects.map(obj => ({ ...obj, id: uuidv4(), x: (obj.x || 0) + dx, y: (obj.y || 0) + dy }));
};

/** A new plot shape centred on `center`. */
export const newAssetObject = (def: AssetDef, center: { x: number; y: number }): CanvasObject => ({
  id: uuidv4(),
  type: "asset",
  assetId: def.id,
  x: center.x - def.width / 2,
  y: center.y - def.height / 2,
  width: def.width,
  height: def.height,
  color: categoryColor(def),
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
});
