'use client';
import { Fragment, useState, useTransition } from 'react';
import { resetAccessAction, setAccessAction } from '@/app/actions';
import { LEVELS, LEVEL_LABEL, MODULES, ROLES, ceiling, rank, type Level, type Matrix, type Role } from '@/lib/access-config';
import { useToast } from './Toaster';

/** Managing Director: set the level (none / view / edit / full) for each module and role. Each change is saved at once and logged. */
export default function AccessMatrix({ matrices }: { matrices: Record<Role, Matrix> }) {
  const [m, setM] = useState(matrices); const [pending, start] = useTransition(); const toast = useToast();
  const change = (role: Role, mod: string, level: Level) => start(async () => {
    const r = await setAccessAction(role, mod, level);
    if (r.ok) { setM(p => ({ ...p, [role]: { ...p[role], [mod]: level } })); toast('Access updated', 'ok'); } else toast(r.errors?._ ?? 'Not allowed', 'err');
  });
  const reset = (role: Role) => start(async () => { const r = await resetAccessAction(role); if (r.ok) { toast('Reset to standard levels — reloading', 'ok'); location.reload(); } else toast(r.errors?._ ?? 'Not allowed', 'err'); });
  const groups = [...new Set(MODULES.map(x => x.group))];
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>Choose what each role can do in every part of the system. <b>View only</b> hides the add / edit / delete buttons and refuses them on the server; <b>No access</b> hides the menu item and blocks the page, downloads and actions. Money modules and contracts can never be opened to Operations Staff. The Managing Director always has full access.</p>
      <div className="scroll-x"><table><thead><tr><th>Module</th>{ROLES.map(r => <th key={r.id}>{r.label}</th>)}</tr></thead><tbody>
        {groups.map(g => (
          <Fragment key={g}>
            <tr><td colSpan={1 + ROLES.length} style={{ background: '#f1f6fb', fontWeight: 700 }}>{g}</td></tr>
            {MODULES.filter(x => x.group === g).map(mod => (
              <tr key={mod.id}><td>{mod.label}</td>
                {ROLES.map(r => (
                  <td key={r.id}>{r.id === 'md' ? <span className="pill green">{LEVEL_LABEL.full}</span> : (
                    <select className="input" aria-label={`${mod.label} — ${r.label}`} value={m[r.id][mod.id]} disabled={pending} onChange={e => change(r.id, mod.id, e.target.value as Level)}>
                      {LEVELS.map(l => <option key={l} value={l} disabled={rank(l) > rank(ceiling(r.id, mod))}>{LEVEL_LABEL[l]}{rank(l) > rank(ceiling(r.id, mod)) ? ' (not allowed)' : ''}</option>)}
                    </select>)}</td>))}
              </tr>))}
          </Fragment>))}
      </tbody></table></div>
      <div className="row" style={{ marginTop: 12 }}>{ROLES.filter(r => r.id !== 'md').map(r => <button key={r.id} className="btn secondary small" type="button" disabled={pending} onClick={() => reset(r.id)}>Reset {r.label} to standard</button>)}</div>
    </div>
  );
}
