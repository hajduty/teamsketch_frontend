import Icon from "../../../components/Icon";
import { useCanvasStore } from "../canvasStore";
import { useIsCompact } from "../../../hooks/useIsCompact";

/** Actions for the current selection; only shown while something is selected. */
export const SelectionBar = () => {
  const compact = useIsCompact();
  const canDelete = useCanvasStore(state => state.canDelete);
  const setCanDelete = useCanvasStore(state => state.setCanDelete);
  const deleteSelection = useCanvasStore(state => state.delete);

  if (!canDelete) return null;

  return (
    <div className={`island fixed z-20 left-1/2 -translate-x-1/2 flex items-center p-1 ${compact ? "bottom-[72px]" : "top-3"}`} role="toolbar" aria-label="Selection">
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
