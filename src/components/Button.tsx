import React from 'react';

export const Button: React.FC<{ onClick?: () => void; children: React.ReactNode, highlighted?: boolean, className?: string }> = ({ onClick, children, highlighted, className = "rounded-xl"}) => (
  <button
    type="button"
    className={`${className} duration-100 px-2 border-zinc-800 p-2 border flex items-center ${highlighted ? "bg-blue-500" : "hover:bg-zinc-800"}`}
    onClick={onClick}
  >
    {children}
  </button>
);
