import React from 'react';

export const Button: React.FC<{ onClick?: () => void; children: React.ReactNode, highlighted?: boolean, className?: string }> = ({ onClick, children, highlighted, className = "rounded-xl"}) => (
  <button
    type="button"
    className={`${className} duration-100 px-2 border-line p-2 border flex items-center select-none cursor-pointer ${highlighted ? "bg-accent text-white" : "hover:bg-raised"}`}
    onClick={onClick}
  >
    {children}
  </button>
);
