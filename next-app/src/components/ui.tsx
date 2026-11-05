/** Presentation helpers in V6's visual vocabulary (server-safe: no state, no browser APIs). React escapes all text. */
import type { ReactNode } from 'react';

export function badgeClass(s: string): string {
  if (/rejected|expired/i.test(s)) return 'red';
  if (/active|arrived|joined|printed|selected|accepted|approved|reviewed|created|issued|^yes$|^done$/i.test(s)) return 'green';
  if (/pending|review|interview|processing|qvc|rtp|scheduled|follow|booking|sourcing|received|needs/i.test(s)) return 'orange';
  return 'grey';
}
export const Badge = ({ text }: { text: string }) => <span className={`pill ${badgeClass(text)}`}>{text}</span>;

export function Heading({ title, desc, actions }: { title: string; desc: string; actions?: ReactNode }) {
  return (
    <div className="row between">
      <div><div className="eyebrow">LGM / {title}</div><h1 className="title">{title}</h1><div className="muted">{desc}</div></div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
export const Metric = ({ label, value, sub }: { label: string; value: ReactNode; sub: string }) => (
  <div className="card"><div className="muted">{label}</div><div className="num">{value}</div><div className="muted">{sub}</div></div>
);
export const Cards = ({ children, cols }: { children: ReactNode; cols?: number }) => (
  <div className="cards" style={cols ? { gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` } : undefined}>{children}</div>
);
export const Panel = ({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) => (
  <section className="panel"><div className="row between"><h3>{title}</h3><div className="row">{actions}</div></div>{children}</section>
);
export const Flow = ({ items }: { items: readonly string[] }) => (
  <div className="flow">{items.map((s, i) => <span key={s + i} style={{ display: 'contents' }}><span>{s}</span>{i < items.length - 1 && <i>→</i>}</span>)}</div>
);
export const Notice = ({ children, tone }: { children: ReactNode; tone?: 'live' }) => <div className={`notice ${tone ?? ''}`}>{children}</div>;
export const Muted = ({ children }: { children: ReactNode }) => <p className="muted">{children}</p>;
export const Bar = ({ label, count, pct }: { label: string; count: number; pct: number }) => (
  <>
    <div className="row between"><span>{label}</span><strong>{count}</strong></div>
    <div className="bar"><div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
  </>
);
export const StageBar = ({ stage, stages }: { stage: string; stages: readonly string[] }) => {
  const i = stages.indexOf(stage);
  return <div className="stagebar" title={stage}>{stages.map((s, k) => <i key={s} className={k <= i ? 'on' : ''} />)}</div>;
};
export const Table = ({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty?: string }) =>
  rows.length === 0 ? <div className="empty">{empty ?? 'No records yet.'}</div> : (
    <div className="scroll-x"><table><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
  );
