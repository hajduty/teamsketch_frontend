import { useState, useRef, useEffect } from 'react';
import Icon from './Icon';

interface EditableDropdownProps {
  options?: any[];
  /** Current value, shown instead of the placeholder */
  value?: any;
  placeholder?: any;
  onChange?: (value: any) => void;
  className?: string;
}

export default function EditableDropdown({
  options = [],
  placeholder = "Select or enter an option",
  value,
  onChange,
  className = ""
}: EditableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<any>(value ?? "");

  // Follow changes made elsewhere (e.g. the right-click quick menu)
  useEffect(() => {
    if (value !== undefined) setInputValue(value);
  }, [value]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (option: any) => {
    setInputValue(option);
    setIsOpen(false);
    onChange?.(option);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
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

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      <div className="flex flex-row items-center justify-between w-full h-8 text-ink text-xs bg-canvas border border-line-strong rounded-md focus-within:border-accent">
        <input
          ref={inputRef}
          type="text"
          className="bg-transparent text-ink border-none outline-none px-2 text-xs w-full min-w-0 tabular"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={() => setIsOpen(true)}
        />
        <button type="button" aria-label="Show options" className="flex items-center h-full px-1.5 cursor-pointer flex-shrink-0 text-ink-muted hover:text-ink" onClick={toggleDropdown}>
          <span className={`transition-transform flex items-center ${isOpen ? 'rotate-180' : ''}`}>
            <Icon iconName="expand_more" fontSize="16px" />
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-full text-xs bg-surface border border-line rounded-md shadow-2xl shadow-black/50 max-h-60 overflow-auto scrollbar-thin z-30 py-1">
          {options.length > 0 ? (
            <ul>
              {options.map((option, index) => (
                <li
                  key={index}
                  className="px-2.5 py-1.5 text-ink hover:bg-raised cursor-pointer tabular"
                  onClick={() => handleOptionClick(option)}
                >
                  {option}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-2.5 py-1.5 text-ink-muted">No options available</div>
          )}
        </div>
      )}
    </div>
  );
}