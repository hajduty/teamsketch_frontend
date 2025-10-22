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

  return (
    <div className="bottom-0 right-0 flex md:flex-row flex-col gap-2 w-auto rounded-r-2xl fixed z-3 text-white group m-2 history-buttons">
      <button
        type="button"
        className={`p-2 bg-neutral-950 border border-neutral-700 rounded-md flex ${canDelete ? "bg-neutral-950 hover:bg-black" : "bg-neutral-600 text-zinc-700"}`}
        onClick={handleDelete}
        disabled={!canDelete}
      >
        <Icon iconName="delete" color="redo" />
      </button>

      <button
        type="button"
        className={`p-2 bg-neutral-950 border border-neutral-700 rounded-md flex ${canUndo ? "bg-neutral-950 hover:bg-black" : "bg-neutral-600 text-zinc-700"}`}
        onClick={undo}
        disabled={!canUndo}
      >
        <Icon iconName="undo" color="redo" />
        {!isMobile}
      </button>

      <button
        type="button"
        className={`p-2 bg-neutral-950 border border-neutral-700 rounded-md flex  ${canRedo ? "bg-neutral-950 hover:bg-black" : "bg-neutral-600 text-zinc-400"}`}
        onClick={redo}
        disabled={!canRedo}
      >
        <Icon iconName="redo" color="redo" />
        {!isMobile}
      </button>
    </div>
  );
}