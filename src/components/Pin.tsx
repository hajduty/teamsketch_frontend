import { FC } from "react";

interface PinProps {
  isPinned: boolean;
  onClick?: () => void;
  className?: string; // optional for extra styling
}

export const PinComponent: FC<PinProps> = ({ isPinned, onClick, className }) => {
  return (
    <button
      onClick={onClick}
      className={`
        absolute top-4 right-4 
        w-6 h-6 p-1
        rounded-md
        flex items-center justify-center 
        transition-colors duration-200
        select-none cursor-pointer
        ${isPinned ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-500 " : "text-neutral-500 hover:bg-neutral-700"} 
        ${className || ""}
      `}
      aria-label={isPinned ? "Unpin" : "Pin"}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
        {isPinned ? "keep" : "keep_off"}
      </span>
    </button>
  );
};
