'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'ok' | 'err' | '';
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: Kind }[]>([]);
  const push = useCallback((msg: string, kind: Kind = '') => {
    const id = Date.now() + Math.random();
    setItems(p => [...p, { id, msg, kind }]);
    setTimeout(() => setItems(p => p.filter(x => x.id !== id)), kind === 'err' ? 7000 : 3800);
  }, []);
  return (
    <Ctx value={push}>
      {children}
      <div className="toasts" aria-live="polite">{items.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>
    </Ctx>
  );
}
