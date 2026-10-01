import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../../../components/Icon";
import { useCanvasStore } from "../canvasStore";
import { assetsIn, categoryColor, CATEGORIES, getAsset, getCategory } from "../assets/catalog";
import { insertFromLibrary } from "../assets/insert";
import { AssetThumb } from "./AssetThumb";

const TOOLS = [
  { name: "select", icon: "arrow_selector_tool", label: "Select" },
  { name: "pen", icon: "edit", label: "Pen" },
  { name: "text", icon: "text_fields", label: "Text" },
];
const PEN_SIZES = [2, 5, 8, 16, 32]; // 5 is the default weight
const TEXT_SIZES = [12, 16, 24, 36, 48];
const SWATCHES = ["#ececef", "#9a9ca5", "#f0525a", "#f59e0b", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];
const MARGIN = 8;

interface QuickMenuProps {
  /** Where the canvas was right-clicked, in viewport pixels */
  x: number;
  y: number;
  /** The canvas point that was right-clicked */
  point?: { x: number; y: number } | null;
  /** Id of the placed shape that was right-clicked, if any */
  targetId?: string;
  onClose: () => void;
}

/**
 * While the library is open: shapes like the one right-clicked (or the last one added). Picking one swaps the
 * right-clicked shape, or places a new one where the menu was opened.
 */
const SimilarShapes: FC<{ point?: { x: number; y: number } | null; targetId?: string; onDone: () => void }> = ({ point, targetId, onDone }) => {
  const recentCategory = useCanvasStore(state => state.recentCategory);
  // Read once: the menu closes as soon as something is picked
  const [targetAssetId] = useState(() => (targetId ? useCanvasStore.getState().objectAssetId(targetId) : undefined));
  const [category, setCategory] = useState(() => getAsset(targetAssetId)?.category ?? recentCategory);
  const info = getCategory(category);

  const pick = (assetId: string) => {
    const def = getAsset(assetId);
    if (!def) return;
    const store = useCanvasStore.getState();
    if (targetId) {
      store.updateObject(targetId, { assetId: def.id, color: categoryColor(def) });
      store.noteAssetUsed(def.id);
    } else {
      insertFromLibrary({ kind: "asset", id: def.id }, point ?? undefined);
    }
    onDone();
  };

  return (
    <>
      <div className="h-px bg-line -mx-2" />
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-ink-faint">{targetId ? "Change to" : "Similar shapes"}</span>
        <span className="text-xs font-medium" style={{ color: info?.color }}>{info?.name}</span>
      </div>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label={`${info?.name} shapes`}>
        {assetsIn(category).map(asset => (
          <button
            key={asset.id}
            type="button"
            title={asset.name}
            aria-label={asset.name}
            aria-pressed={asset.id === targetAssetId}
            onClick={() => pick(asset.id)}
            className={`flex items-center justify-center h-12 rounded-lg cursor-pointer transition-colors
              ${asset.id === targetAssetId ? "bg-raised ring-1 ring-accent" : "hover:bg-raised"}`}
          >
            <AssetThumb asset={asset} size={38} />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 px-0.5" role="group" aria-label="Other categories">
        {CATEGORIES.filter(c => c.id !== category).map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className="flex items-center gap-1 h-6 px-2 rounded-full bg-canvas border border-line text-[11px] text-ink-muted hover:text-ink cursor-pointer"
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
          </button>
        ))}
      </div>
    </>
  );
};

/** Right-click menu on the canvas: switch tool, size and colour without leaving the canvas. */
export const QuickMenu: FC<QuickMenuProps> = ({ x, y, point, targetId, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  const tool = useCanvasStore(state => state.tool);
  const { size, fontSize, color } = useCanvasStore(state => state.options);
  const setOption = useCanvasStore(state => state.setOption);
  const canDelete = useCanvasStore(state => state.canDelete);
  const libraryOpen = useCanvasStore(state => state.libraryOpen);

  // Keep the menu inside the window
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPosition({
      left: Math.max(MARGIN, Math.min(x, window.innerWidth - width - MARGIN)),
      top: Math.max(MARGIN, Math.min(y, window.innerHeight - height - MARGIN)),
    });
  }, [x, y, tool, libraryOpen]);

  useEffect(() => {
    // A press outside closes the menu. On the canvas it does only that: it shouldn't also
    // start a stroke, so the event is stopped before the canvas sees it.
    const onPointerDown = (e: Event) => {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target)) return;
      if (target.closest?.(".konvajs-content")) {
        e.stopPropagation();
        // The mousedown/touchstart for this same press follows separately and may arrive
        // after the menu has unmounted, so block it with a one-off listener
        const block = (ev: Event) => ev.stopPropagation();
        const options = { capture: true, once: true };
        document.addEventListener("mousedown", block, options);
        document.addEventListener("touchstart", block, options);
        // A right-click while open just closes the menu: swallow the contextmenu event that
        // would otherwise reopen it (and keep the browser's own menu away)
        const blockMenu = (ev: Event) => { ev.preventDefault(); ev.stopPropagation(); };
        if ((e as PointerEvent).button === 2) document.addEventListener("contextmenu", blockMenu, options);
        setTimeout(() => {
          document.removeEventListener("mousedown", block, options);
          document.removeEventListener("touchstart", block, options);
          document.removeEventListener("contextmenu", blockMenu, options);
        }, 400);
      }
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onBlur = () => onClose();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [onClose]);

  const isText = tool === "text";
  const sizes = isText ? TEXT_SIZES : PEN_SIZES;
  const currentSize = Number(isText ? fontSize : size);
  const showStyle = tool === "pen" || tool === "text";

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Quick settings"
      style={position}
      onContextMenu={(e) => e.preventDefault()}
      className="quick-menu island fixed z-40 w-60 p-2 flex flex-col gap-2 text-sm text-ink select-none"
    >
      <div className="flex gap-1" role="group" aria-label="Tool">
        {TOOLS.map(t => (
          <button
            key={t.name}
            type="button"
            aria-pressed={tool === t.name}
            onClick={() => { useCanvasStore.getState().setTool(t.name); useCanvasStore.setState({ optionsPanel: "tool" }); }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs
              ${tool === t.name ? "bg-accent-soft text-[#8fb0ff]" : "text-ink-muted hover:bg-raised hover:text-ink"}`}
          >
            <Icon iconName={t.icon} fontSize="20px" />
            {t.label}
          </button>
        ))}
      </div>

      {showStyle && (
        <>
          <div className="h-px bg-line -mx-2" />
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-ink-faint">{isText ? "Font size" : "Brush size"}</span>
            <span className="text-xs text-ink-muted tabular">{currentSize} px</span>
          </div>
          <div className="flex gap-1" role="radiogroup" aria-label={isText ? "Font size" : "Brush size"}>
            {sizes.map(s => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={currentSize === s}
                aria-label={`${s} px`}
                onClick={() => setOption(isText ? "fontSize" : "size", s)}
                className={`flex-1 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-colors
                  ${currentSize === s ? "bg-raised ring-1 ring-accent" : "hover:bg-raised"}`}
              >
                {isText ? (
                  <span className="text-ink tabular" style={{ fontSize: 10 + TEXT_SIZES.indexOf(s) * 2 }}>{s}</span>
                ) : (
                  <span className="rounded-full" style={{ width: Math.min(s, 20) + 2, height: Math.min(s, 20) + 2, backgroundColor: color }} />
                )}
              </button>
            ))}
          </div>
          <div className="flex justify-between px-1 pb-0.5" role="radiogroup" aria-label="Color">
            {SWATCHES.map(c => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color?.toLowerCase() === c}
                aria-label={c}
                onClick={() => setOption("color", c)}
                className={`size-5 rounded-full cursor-pointer border border-white/10
                  ${color?.toLowerCase() === c ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "hover:ring-1 hover:ring-line-strong hover:ring-offset-1 hover:ring-offset-surface"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </>
      )}

      {libraryOpen && <SimilarShapes point={point} targetId={targetId} onDone={onClose} />}

      {canDelete && (
        <>
          <div className="h-px bg-line -mx-2" />
          <button
            type="button"
            onClick={() => {
              const store = useCanvasStore.getState();
              store.setCanDelete(false);
              store.delete();
              onClose();
            }}
            className="flex items-center gap-2 h-8 px-2 rounded-lg text-ink-muted hover:bg-danger/15 hover:text-danger cursor-pointer transition-colors"
          >
            <Icon iconName="delete" fontSize="18px" />
            <span className="flex-1 text-left">Delete selection</span>
            <span className="text-xs text-ink-faint">Del</span>
          </button>
        </>
      )}
    </div>,
    document.body
  );
};
