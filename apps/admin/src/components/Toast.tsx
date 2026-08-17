import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type ToastProps = {
  message: string;
  onClose: () => void;
  tone?: 'error' | 'success';
};

const DURATION_MS = 6000;

export function Toast({ message, onClose, tone = 'error' }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const [shrink, setShrink] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(onClose, DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [message, onClose]);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setVisible(true));
    const startShrink = requestAnimationFrame(() => setShrink(true));
    return () => {
      cancelAnimationFrame(enter);
      cancelAnimationFrame(startShrink);
    };
  }, [message]);

  const success = tone === 'success';

  return (
    <div
      className="pointer-events-none fixed top-5 right-5 z-50 flex w-[min(22rem,calc(100vw-2.5rem))] justify-end"
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`pointer-events-auto w-full overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-900/5 transition-all duration-300 ease-out ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full ${
              success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {success ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
          </span>
          <p className="flex-1 pt-1 text-sm leading-snug font-medium text-slate-800">{message}</p>
          <button
            className="-mt-1 -mr-1 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            aria-label="Fermer la notification"
          >
            <X size={15} />
          </button>
        </div>
        <div className="h-1 w-full bg-slate-100">
          <div
            className={`h-full transition-[width] ease-linear ${success ? 'bg-emerald-500' : 'bg-red-500'} ${
              shrink ? 'w-0' : 'w-full'
            }`}
            style={{ transitionDuration: `${DURATION_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
