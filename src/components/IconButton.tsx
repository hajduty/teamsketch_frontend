import { FC, ReactNode } from "react";
import Icon from "./Icon";

type Side = "top" | "right" | "bottom" | "left";

interface IconButtonProps {
  icon: string;
  /** Accessible name, also shown in the tooltip */
  label: string;
  /** Keyboard shortcut shown next to the label, e.g. "Ctrl+Z" */
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  tooltip?: Side;
  className?: string;
  children?: ReactNode;
}

const tooltipPosition: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-3",
  left: "right-full top-1/2 -translate-y-1/2 mr-3",
};

export const IconButton: FC<IconButtonProps> = ({
  icon,
  label,
  shortcut,
  active,
  disabled,
  onClick,
  tooltip = "top",
  className = "",
  children,
}) => (
  <div className="relative group/btn flex">
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center size-9 rounded-lg cursor-pointer transition-colors duration-100
        disabled:cursor-default disabled:text-ink-faint/60 disabled:hover:bg-transparent
        ${active ? "bg-accent-soft text-[#8fb0ff]" : "text-ink-muted hover:bg-raised hover:text-ink"}
        ${className}`}
    >
      <Icon iconName={icon} fontSize="20px" />
      {children}
    </button>
    <span
      role="tooltip"
      className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-raised border border-line px-2 py-1 text-xs text-ink
        opacity-0 transition-opacity duration-100 group-hover/btn:opacity-100 group-hover/btn:delay-300
        group-has-[:focus-visible]/btn:opacity-100 ${tooltipPosition[tooltip]}`}
    >
      {label}
      {shortcut && <span className="ml-2 text-ink-faint">{shortcut}</span>}
    </span>
  </div>
);
