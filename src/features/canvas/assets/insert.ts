// Putting built-in shapes and library items on the canvas (from clicks, menus and drag and drop).
import { useCanvasStore } from "../canvasStore";
import { getAsset } from "./catalog";
import { instantiateItem, newAssetObject } from "./library";

/** What's being dragged from the library panel onto the canvas. */
export const DRAG_TYPE = "application/x-teamsketch-library";
export type LibraryPayload = { kind: "asset"; id: string } | { kind: "item"; id: string };

/** Place a built-in shape or a library item centred on `point` (default: middle of the screen). */
export const insertFromLibrary = (payload: LibraryPayload, point?: { x: number; y: number }) => {
  const store = useCanvasStore.getState();
  const at = point ?? store.viewControls?.center();
  if (!at) return;
  // Same size on screen at any zoom
  const zoom = store.zoom > 0 ? store.zoom : 1;
  if (payload.kind === "asset") {
    const def = getAsset(payload.id);
    if (!def) return;
    store.insertObjects([newAssetObject(def, at, zoom)], true);
    store.noteAssetUsed(def.id);
  } else {
    const item = store.libraryItems.find(i => i.id === payload.id);
    if (item) store.insertObjects(instantiateItem(item, at, zoom), true);
  }
};
