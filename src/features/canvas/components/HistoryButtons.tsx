import { useEffect } from 'react';
import { IconButton } from '../../../components/IconButton';
import { useIsCompact } from '../../../hooks/useIsCompact';
import { useCanvasStore } from '../canvasStore';

export const HistoryButtons = () => {
  const compact = useIsCompact();

  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const zoom = useCanvasStore((state) => state.zoom);
  const viewControls = useCanvasStore((state) => state.viewControls);
  const canUndo = useCanvasStore((state) => state.canUndo);
  const canRedo = useCanvasStore((state) => state.canRedo);

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

  // On phones undo/redo are part of the bottom toolbar and zoom is by pinch
  if (compact) return null;

  return (
    <div className="history-buttons fixed z-20 flex gap-2 left-3 bottom-3">
      <div className="island flex gap-0.5 p-1" role="group" aria-label="History">
        <IconButton icon="undo" label="Undo" shortcut="Ctrl+Z" onClick={undo} disabled={!canUndo} />
        <IconButton icon="redo" label="Redo" shortcut="Ctrl+Y" onClick={redo} disabled={!canRedo} />
      </div>
      {viewControls && (
        <div className="island flex items-center gap-0.5 p-1" role="group" aria-label="Zoom">
          <IconButton icon="remove" label="Zoom out" onClick={viewControls.zoomOut} />
          <button
            type="button"
            onClick={viewControls.resetZoom}
            title="Reset to 100%"
            className="h-9 min-w-14 px-1.5 rounded-lg text-xs text-ink-muted hover:bg-raised hover:text-ink cursor-pointer tabular"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton icon="add" label="Zoom in" onClick={viewControls.zoomIn} />
        </div>
      )}
    </div>
  );
}
