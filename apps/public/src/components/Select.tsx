import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type SelectOption<T> = { value: T; label: string };

/**
 * Custom listbox — native <select> can't have its open dropdown styled
 * (the option list is rendered by the OS, not the page) so a fully custom
 * one is needed for a consistent look. Single reusable component: every
 * select on the public site should go through this rather than a bare
 * <select>, so the dropdown look stays consistent site-wide.
 */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: globalThis.KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  // Jump straight to the currently selected option on open, same as a
  // native <select> highlighting its current value when the list drops
  // down — without this, a long list (e.g. age 1-45) always opens at the
  // top regardless of what's already selected.
  useEffect(() => {
    if (!open) return;
    const activeItem = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    activeItem?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setActiveIndex(selectedIndex);
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(activeIndex);
    }
  };

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          setActiveIndex(selectedIndex);
          setOpen((current) => !current);
        }}
        onKeyDown={onKeyDown}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm text-slate-900 transition focus:outline-none ${
          open ? 'border-brand-600 ring-2 ring-brand-600/15' : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ''}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-64 w-full min-w-max overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/5"
        >
          {options.map((option, index) => (
            <li
              key={String(option.value)}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition ${
                index === activeIndex ? 'bg-brand-50 text-brand-700' : 'text-slate-700'
              }`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && <Check size={14} className="shrink-0 text-brand-600" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
