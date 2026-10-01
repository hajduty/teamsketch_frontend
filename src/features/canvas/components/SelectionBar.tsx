import Icon from "../../../components/Icon";
import { useCanvasStore } from "../canvasStore";
import { useIsCompact } from "../../../hooks/useIsCompact";
import { useEffect, useState } from "react";
import { makeLibraryItem } from "../assets/library";
import { getAsset } from "../assets/catalog";
import { CanvasObject } from "../tools/baseTool";

const itemName = (objects: CanvasObject[]) => {
  if (objects.length === 1) {
    const [obj] = objects;
    if (obj.type === "asset") return obj.label || getAsset(obj.assetId)?.name || "Shape";
    if (obj.type === "text") return String(obj.text ?? "Text").split("\n")[0].slice(0, 30) || "Text";
    return "Drawing";
  }
  return `${objects.length} items`;
};

/** Actions for the current selection; only shown while something is selected. */
export const SelectionBar = () => {
  const compact = useIsCompact();
  const canDelete = useCanvasStore(state => state.canDelete);
  const setCanDelete = useCanvasStore(state => state.setCanDelete);
  const deleteSelection = useCanvasStore(state => state.delete);
  const [saved, setSaved] = useState<"added" | "full" | null>(null);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 1500);
    return () => clearTimeout(timer);
  }, [saved]);

  if (!canDelete) return null;

  const addToLibrary = () => {
    const store = useCanvasStore.getState();
    const objects = store.selectedObjects();
    const item = makeLibraryItem(objects, itemName(objects));
    if (!item) return;
    setSaved(store.addLibraryItem(item) ? "added" : "full");
  };

  return (
    <div className={`island fixed z-20 left-1/2 -translate-x-1/2 flex items-center p-1 ${compact ? "bottom-[72px]" : "top-3"}`} role="toolbar" aria-label="Selection">
      <button
        type="button"
        onClick={addToLibrary}
        className="flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-lg text-sm text-ink-muted hover:bg-raised hover:text-ink cursor-pointer transition-colors"
      >
        <Icon iconName={saved === "added" ? "check" : "library_add"} fontSize="18px" />
        {saved === "added" ? "Added to library" : saved === "full" ? "Storage full" : "Add to library"}
      </button>
      <div className="w-px h-5 bg-line mx-0.5" />
      <button
        type="button"
        onClick={() => { setCanDelete(false); deleteSelection(); }}
        className="flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-lg text-sm text-ink-muted hover:bg-danger/15 hover:text-danger cursor-pointer transition-colors"
      >
        <Icon iconName="delete" fontSize="18px" />
        Delete
        <span className="text-xs text-ink-faint ml-1">Del</span>
      </button>
    </div>
  );
};
