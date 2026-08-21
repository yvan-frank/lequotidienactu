import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type SelectOption<T> = { value: T; label: string };

/**
 * Custom listbox — native <select> can't have its open dropdown styled
 * (the option list is rendered by the OS, not the page) so a fully custom
 * one is needed for a consistent look. Mirrors apps/public/src/components/
 * Select.tsx (separate Vite bundle, can't share the import) — kept in
 * sync manually; colors use orange-* rather than brand-* since the admin
 * build has no brand-* theme tokens defined.
 */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<'below' | 'above'>('below');
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
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

  // Measures the panel's actual rendered box against the viewport (rather
  // than guessing its height from the option count) and flips it above the
  // button when it would otherwise run off the bottom of the screen and
  // there's more room above — runs before paint so there's no visible
  // jump. Re-measures on scroll/resize while open since either can change
  // how much room is left.
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const root = rootRef.current;
      const list = listRef.current;
      if (!root || !list) return;
      const rootRect = root.getBoundingClientRect();
      const listHeight = list.getBoundingClientRect().height;
      const spaceBelow = window.innerHeight - rootRect.bottom;
      const spaceAbove = rootRect.top;
      setPlacement(listHeight > spaceBelow && spaceAbove > spaceBelow ? 'above' : 'below');
    };
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  // Jump straight to the currently selected option on open, same as a
  // native <select> highlighting its current value when the list drops
  // down.
  useLayoutEffect(() => {
    if (!open) return;
    const activeItem = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    activeItem?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const openDropdown = () => {
    setPlacement('below');
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  };

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
        openDropdown();
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
        onClick={() => (open ? setOpen(false) : openDropdown())}
        onKeyDown={onKeyDown}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-left text-sm transition focus:outline-none ${
          open ? 'border-orange-600 ring-2 ring-orange-600/15' : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected?.label ?? placeholder ?? ''}
        </span>
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
          className={`absolute z-30 max-h-64 w-full min-w-max overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/5 ${
            placement === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {options.map((option, index) => (
            <li
              key={String(option.value)}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition ${
                index === activeIndex ? 'bg-orange-50 text-orange-800' : 'text-slate-700'
              }`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && <Check size={14} className="shrink-0 text-orange-700" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
