import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";

export const Color = ({ className, onChange, value }: { className?: string, onChange?: (value: string) => void, value: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [color, setColor] = useState(value);

  // Follow changes made elsewhere (e.g. the quick swatches)
  useEffect(() => {
    setColor(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value);
    onChange?.(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setIsOpen(false);
    if (e.key === 'ArrowDown') setIsOpen(true);
    if (e.key === 'Escape') setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(prev => !prev);
    inputRef.current?.focus();
  };

  const changeColor = (newColor: string) => {
    setColor(newColor);
    onChange?.(newColor);
  }

  return (
    <>
      <div className={`relative w-full ${className}`} ref={dropdownRef}>
        <div className="flex flex-row items-center w-full h-8 text-ink text-xs bg-canvas border border-line-strong rounded-md focus-within:border-accent">
          <input type="text" aria-label="Color value" className="bg-transparent text-ink border-none outline-none px-2 text-xs w-full min-w-0 tabular" ref={inputRef}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onClick={() => setIsOpen(true)}
            value={color}
          />
          <button type="button" aria-label="Pick a color" className="flex items-center pr-2 pl-1 h-full cursor-pointer flex-shrink-0" onClick={toggleDropdown}>
            <span className="size-4 rounded-sm border border-white/15" style={{ backgroundColor: color }} />
          </button>
        </div>
        {isOpen && (
          <div className="absolute left-0 mt-2 w-fit text-xs shadow-2xl shadow-black/50 rounded-lg overflow-hidden z-30">
            <HexColorPicker color={color} onChange={changeColor} />
          </div>
        )}
      </div>
    </>
  )
}