import { useEffect } from 'react';
import Icon from '../../../components/Icon';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useCanvasStore } from '../canvasStore';

export const HistoryButtons = () => {
  const isMobile = useIsMobile();

  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const deleteObject = useCanvasStore((state) => state.delete);
  const canUndo = useCanvasStore((state) => state.canUndo);
  const canRedo = useCanvasStore((state) => state.canRedo);
  const canDelete = useCanvasStore((state) => state.canDelete);
  const setCanDelete = useCanvasStore((state) => state.setCanDelete);

  const handleDelete = () => {
    setCanDelete(false);
    deleteObject();
  }

  // Keyboard shortcuts for the same actions as the buttons below
  useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

    const handleKeyDown = (e: KeyboardEvent) => {
      // Leave native undo/delete alone while editing text
      if (isTyping(e.target)) return;

      const state = useCanvasStore.getState();
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (state.canUndo) state.undo();
      } else if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (state.canRedo) state.redo();
      } else if (!mod && (e.key === "Delete" || e.key === "Backspace") && state.canDelete && !state.editing) {
        e.preventDefault();
        state.setCanDelete(false);
        state.delete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className={`bottom-0 right-0 flex md:flex-row flex-col gap-2 w-auto rounded-r-2xl fixed z-3 text-white group m-2 history-buttons ${isMobile ? "":"flex-col-reverse"}`}>
      <button
        type="button"
        className={`p-2 bg-neutral-950 border border-t-zinc-700 border-zinc-800 rounded-md flex  ${canDelete ? "bg-neutral-950 hover:bg-zinc-800" : "bg-neutral-600 text-neutral-700"}`}
        onClick={handleDelete}
        disabled={!canDelete}
        title="Delete (Del)"
      >
        <Icon iconName="delete" color="redo" />
      </button>

      <button
        type="button"
        className={`p-2 bg-neutral-950 border border-t-zinc-700 border-zinc-800 rounded-md flex ${canUndo ? "bg-neutral-950 hover:bg-zinc-800" : "bg-neutral-600 text-neutral-700"}`}
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <Icon iconName="undo" color="redo" />
        {!isMobile}
      </button>

      <button
        type="button"
        className={`p-2 bg-neutral-950 border border-t-zinc-700 border-zinc-800 rounded-md flex ${canRedo ? "bg-neutral-950 hover:bg-zinc-800" : "bg-neutral-600 text-neutral-700"}`}
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
      >
        <Icon iconName="redo" color="redo" />
        {!isMobile}
      </button>
    </div>
  );
}