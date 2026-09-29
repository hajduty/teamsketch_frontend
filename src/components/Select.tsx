import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Styled replacement for <select>. The menu is rendered in a portal with fixed
 * positioning so it can't be clipped by scrolling containers (e.g. inside dialogs).
 */
export function Select<T extends string>({ value, options, onChange, label, size = "md", className = "" }: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));
  const selected = options[selectedIndex];

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    // Open upwards when there's no room below
    const below = rect.bottom + 4 + menuHeight <= window.innerHeight - 8;
    setPosition({
      top: below ? rect.bottom + 4 : rect.top - 4 - menuHeight,
      left: Math.min(rect.left, window.innerWidth - 8 - Math.max(rect.width, 180)),
      minWidth: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    // Follow the trigger when a surrounding container scrolls, rather than closing:
    // containers like a dialog's list can fire scroll events just from the menu opening
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) place();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    // Focus once positioned, without scrolling the page to it
    const frame = requestAnimationFrame(() => menuRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close, place]);

  const openMenu = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    onChange(options[index].value);
    close();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openMenu();
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActive(i => (i + 1) % options.length); break;
      case "ArrowUp": e.preventDefault(); setActive(i => (i - 1 + options.length) % options.length); break;
      case "Home": e.preventDefault(); setActive(0); break;
      case "End": e.preventDefault(); setActive(options.length - 1); break;
      case "Enter": case " ": e.preventDefault(); choose(active); break;
      case "Escape": e.preventDefault(); e.stopPropagation(); close(); break;
      case "Tab": close(false); break;
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`flex items-center justify-between gap-2 rounded-md border bg-canvas text-ink cursor-pointer transition-colors
          ${open ? "border-accent" : "border-line-strong hover:border-ink-faint"}
          ${size === "sm" ? "h-8 pl-2.5 pr-1.5 text-xs" : "h-9 pl-3 pr-2 text-sm"} ${className}`}
      >
        <span className="truncate">{selected?.label}</span>
        <Icon iconName="expand_more" fontSize="16px" className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && createPortal(
        <ul
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, minWidth: position?.minWidth }}
          className="fixed z-[60] w-max max-w-72 p-1 rounded-lg bg-surface border border-line shadow-2xl shadow-black/60 outline-none"
        >
          {options.map((option, i) => (
            <li
              key={option.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={option.value === value}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
              className={`flex items-start gap-2 pl-2 pr-3 py-1.5 rounded-md cursor-pointer text-sm ${i === active ? "bg-raised" : ""}`}
            >
              <Icon
                iconName="check"
                fontSize="16px"
                className={`mt-0.5 text-[#8fb0ff] ${option.value === value ? "" : "invisible"}`}
              />
              <span className="flex flex-col">
                <span className="text-ink">{option.label}</span>
                {option.description && <span className="text-xs text-ink-faint">{option.description}</span>}
              </span>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </>
  );
}
