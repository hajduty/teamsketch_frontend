import { FC, ReactNode } from "react";
import Icon from "../../../components/Icon";
import { IconButton } from "../../../components/IconButton";
import { useIsCompact } from "../../../hooks/useIsCompact";
import { useCanvasStore } from "../canvasStore";
import { assetsIn, CATEGORIES } from "../assets/catalog";
import { DRAG_TYPE, insertFromLibrary, LibraryPayload } from "../assets/insert";
import { AssetThumb } from "./AssetThumb";

// A div acting as a button: Firefox never starts a drag from a <button>
const Tile: FC<{ payload: LibraryPayload; name: string; children: ReactNode; onRemove?: () => void }> = ({ payload, name, children, onRemove }) => (
  <li className="group relative">
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => insertFromLibrary(payload)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        insertFromLibrary(payload);
      }}
      title={`${name}: click to add, or drag onto the canvas`}
      className="w-full flex flex-col items-center gap-1 p-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-raised transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
      <span className="w-full truncate text-[11px] text-ink-muted text-center">{name}</span>
    </div>
    {onRemove && (
      <button
        type="button"
        aria-label={`Remove ${name} from library`}
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 flex items-center justify-center size-6 rounded-md bg-surface/90 text-ink-faint hover:text-danger
          opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
      >
        <Icon iconName="close" fontSize="16px" />
      </button>
    )}
  </li>
);

const Section: FC<{ title: ReactNode; children: ReactNode }> = ({ title, children }) => (
  <section className="pt-3">
    <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-faint mb-1.5">{title}</h3>
    <ul className="grid grid-cols-3 gap-1">{children}</ul>
  </section>
);

/** Excalidraw-style library: your saved items and the built-in system design shapes. */
export const LibraryPanel = () => {
  const compact = useIsCompact();
  const open = useCanvasStore(state => state.libraryOpen);
  const setOpen = useCanvasStore(state => state.setLibraryOpen);
  const items = useCanvasStore(state => state.libraryItems);
  const removeItem = useCanvasStore(state => state.removeLibraryItem);

  if (!open) return null;

  return (
    <aside
      aria-label="Library"
      className={`library-panel island fixed z-20 flex flex-col text-sm text-ink select-none
        ${compact ? "left-3 right-3 bottom-[72px] max-h-[60dvh]" : "right-3 top-16 w-72 max-h-[calc(100dvh-80px)]"}`}
    >
      <header className="flex items-center gap-2 pl-4 pr-1.5 h-11 border-b border-line flex-shrink-0">
        <Icon iconName="shapes" fontSize="18px" className="text-ink-muted" />
        <h2 className="font-medium flex-1">Library</h2>
        <IconButton icon="close" label="Close" onClick={() => setOpen(false)} tooltip="bottom" />
      </header>
      <div className="overflow-y-auto scrollbar-thin px-3 pb-3">
        {items.length > 0 && (
          <Section title="Your library">
            {items.map(item => (
              <Tile key={item.id} payload={{ kind: "item", id: item.id }} name={item.name} onRemove={() => removeItem(item.id)}>
                <AssetThumb item={item} size={56} />
              </Tile>
            ))}
          </Section>
        )}
        {CATEGORIES.map(category => (
          <Section
            key={category.id}
            title={<><span className="size-1.5 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</>}
          >
            {assetsIn(category.id).map(asset => (
              <Tile key={asset.id} payload={{ kind: "asset", id: asset.id }} name={asset.name}>
                <AssetThumb asset={asset} size={56} />
              </Tile>
            ))}
          </Section>
        ))}
      </div>
    </aside>
  );
};
