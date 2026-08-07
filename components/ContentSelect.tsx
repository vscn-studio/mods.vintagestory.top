'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type ContentSelectOption = {
  value: string;
  label: string;
};

type ContentSelectProps = {
  className?: string;
  label?: string;
  ariaLabel?: string;
  value: string;
  options: ContentSelectOption[];
  onChange: (value: string) => void;
};

export function ContentSelect({ className = '', label, ariaLabel, value, options, onChange }: ContentSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const accessibleLabel = ariaLabel ?? label ?? selectedOption?.label ?? '';

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className={`content-select-menu${className ? ` ${className}` : ''}`} ref={menuRef}>
      <button
        className={isOpen ? 'content-select content-select--open' : 'content-select'}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={accessibleLabel}
        onClick={() => setIsOpen((open) => !open)}
      >
        {label ? <span className="content-select__label">{label}</span> : null}
        <span className="content-select__value">{selectedOption?.label}</span>
        <ChevronDown className={isOpen ? 'content-select__chevron content-select__chevron--up' : 'content-select__chevron'} size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>

      <div
        className={isOpen ? 'content-select-popover content-select-popover--open' : 'content-select-popover'}
        role="listbox"
        aria-hidden={!isOpen}
        aria-label={accessibleLabel}
      >
        {options.map((option) => (
          <button
            className={option.value === value ? 'content-select-option content-select-option--active' : 'content-select-option'}
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            onClick={() => {
              onChange(option.value);
              setIsOpen(false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
