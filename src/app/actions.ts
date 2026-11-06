'use server';
import { revalidatePath } from 'next/cache';
import { requireUser, requirePermission } from '@/lib/auth/dal';
import { setWorkspace } from '@/lib/auth/session';
import * as R from '@/lib/repo/mutations';
import * as R2 from '@/lib/repo/mutations-more';
import * as R3 from '@/lib/repo/mutations-3';
import * as R4 from '@/lib/repo/mutations-v8';
import * as R5 from '@/lib/repo/mutations-v8b';
import * as AC from '@/lib/repo/access';
import type { Level, Role } from '@/lib/access-config';
import type { Errors } from '@/lib/forms';

export interface FormState { ok?: boolean; errors?: Errors; message?: string; values?: Record<string, string>; nonce?: number }
export type Entity = 'clients' | 'orders' | 'candidates' | 'visits' | 'demands' | 'allocations' | 'interviews' | 'tickets' | 'warranties' | 'domestic' | 'finance' | 'credentials'
  | 'domAccount' | 'domPayments' | 'refunds' | 'vacancies' | 'placements' | 'placementFees' | 'placePayments' | 'serviceTerms' | 'serviceInvoices' | 'servicePayments' | 'fundAllocations' | 'contracts' | 'tasks' | 'interviewEntries' | 'agencyRecords';
type Simple = 'visits' | 'demands' | 'allocations' | 'interviews' | 'tickets' | 'warranties' | 'domestic';

const refresh = () => revalidatePath('/', 'layout');
/** Level-wise access check (Settings → Roles & Access). Runs BEFORE every write, on the server. */
async function guard(role: Role, target: { entity?: string; module?: string }, need: Level): Promise<FormState | null> {
  const err = await AC.accessError(role, target, need);
  return err ? { ok: false, errors: { _: err } } : null;
}
const toState = (r: R.Result, doneMsg: string, values?: Record<string, string>): FormState =>
  r.ok ? { ok: true, message: doneMsg + (r.warnings?.length ? ' — note: ' + r.warnings.join(' ') : '') } : { ok: false, errors: r.errors, values, nonce: Date.now() + Math.random() };

/** Create (id = null) or update a record. Bound from the client form: saveEntity.bind(null, entity, id). */
export async function saveEntity(entity: Entity, id: number | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, ws } = await requireUser();
  const denied = await guard(user.role, { entity }, 'edit'); if (denied) return denied;
  const actor: R.Actor = { workspace: ws, role: user.role, userId: user.userId };
  const input = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  const fn = { clients: R.saveClient, orders: R.saveOrder, candidates: R.saveCandidate, visits: R2.saveVisit, demands: R2.saveDemand, allocations: R2.saveAllocation,
    interviews: R2.saveInterview, tickets: R2.saveTicket, warranties: R2.saveWarranty, domestic: R2.saveDomestic, finance: R3.saveFinance, credentials: R3.saveCredential,
    domAccount: R4.saveDomAccount, domPayments: R4.saveDomPayment, refunds: R4.saveRefund, vacancies: R4.saveVacancy, placements: R4.savePlacement, placementFees: R4.savePlacementFee,
    placePayments: R4.savePlacementPayment, serviceTerms: R4.saveServiceTerm, serviceInvoices: R4.saveServiceInvoice, servicePayments: R4.saveServicePayment, fundAllocations: R4.saveFundAllocation,
    contracts: R4.saveContract, tasks: R4.saveTask, interviewEntries: R4.saveInterviewEntry, agencyRecords: R5.saveAgency }[entity];
  if (!fn) return { ok: false, errors: { _: 'Unknown record type.' } };
  const res = await fn(actor, input, id ?? undefined);
  if (res.ok && entity === 'candidates' && input._cv) await R3.setCvStatus(actor, Number(input._cv), 'Candidate created'); // created from a CV intake item
  if (res.ok) refresh();
  return toState(res, `${id ? 'Updated' : 'Saved'}${res.ok && res.code ? ' ' + res.code : ''}`, input);
}

export async function deleteEntity(entity: Entity, id: number): Promise<FormState> {
  const { user, ws } = await requireUser();
  const denied = await guard(user.role, { entity }, 'full'); if (denied) return denied;
  const actor: R.Actor = { workspace: ws, role: user.role, userId: user.userId };
  const res = entity === 'agencyRecords' ? await R5.deleteAgency(actor, id) : R4.isV8Deletable(entity) ? await R4.deleteV8(actor, entity, id) : entity === 'clients' ? await R.deleteClient(actor, id) : entity === 'orders' ? await R.deleteOrder(actor, id) : entity === 'candidates' ? await R.deleteCandidate(actor, id)
    : entity === 'finance' ? await R3.deleteFinance(actor, id) : entity === 'credentials' ? await R3.deleteCredential(actor, id) : await R2.deleteSimple(actor, entity as Simple, id);
  if (res.ok) refresh();
  return toState(res, 'Deleted');
}

export async function moveStage(id: number, to: string): Promise<FormState> {
  const { user, ws } = await requireUser();
  const denied = await guard(user.role, { module: 'candidates' }, 'edit'); if (denied) return denied;
  const res = await R.moveCandidate({ workspace: ws, role: user.role, userId: user.userId }, id, to);
  if (res.ok) refresh();
  return toState(res, `Moved to ${to}`);
}

export async function undoStage(id: number): Promise<FormState> {
  const { user, ws } = await requireUser();
  const denied = await guard(user.role, { module: 'candidates' }, 'edit'); if (denied) return denied;
  const res = await R.undoCandidate({ workspace: ws, role: user.role, userId: user.userId }, id);
  if (res.ok) refresh();
  return toState(res, 'Stage corrected');
}

export async function switchWorkspace(target: 'demo' | 'live'): Promise<FormState> {
  await requirePermission('workspace.switch');
  await setWorkspace(target);
  refresh();
  return { ok: true, message: `${target.toUpperCase()} workspace active` };
}

/** Move a travel record / warranty case / domestic case one step along its workflow. */
export async function advanceStep(entity: 'tickets' | 'warranties' | 'domestic', id: number): Promise<FormState> {
  const { user, ws } = await requireUser();
  const denied = await guard(user.role, { entity }, 'edit'); if (denied) return denied;
  const res = await R2.advanceStatus({ workspace: ws, role: user.role, userId: user.userId }, entity, id);
  if (res.ok) refresh();
  return toState(res, 'Moved to the next step');
}

// ───────────── Stage 3 actions ─────────────
const actorOf = async () => { const { user, ws } = await requireUser(); return { workspace: ws, role: user.role, userId: user.userId } as R.Actor; };

export async function clearFinanceAction(): Promise<FormState> {
  { const { user } = await requireUser(); const d = await guard(user.role, { module: 'finance' }, 'full'); if (d) return d; }
  const res = await R3.clearFinance(await actorOf()); if (res.ok) refresh(); return toState(res, 'Finance entries cleared');
}
export async function setCvStatusAction(id: number, status: string): Promise<FormState> {
  const res = await R3.setCvStatus(await actorOf(), id, status); if (res.ok) refresh(); return toState(res, 'Updated');
}
export async function deleteCvAction(id: number): Promise<FormState> {
  const res = await R3.deleteCvItem(await actorOf(), id); if (res.ok) refresh(); return toState(res, 'Deleted');
}
export async function resetDemoAction(): Promise<FormState> {
  const res = await R3.resetDemo(await actorOf()); if (res.ok) refresh(); return toState(res, 'Demo data reset');
}
/** Clearing a workspace is destructive: the caller must type DELETE. Checked here, on the server. */
export async function clearWorkspaceAction(typed: string): Promise<FormState> {
  if (typed.trim() !== 'DELETE') return { ok: false, errors: { _: 'Type DELETE (capitals) to confirm.' } };
  const res = await R3.clearWorkspace(await actorOf()); if (res.ok) refresh(); return toState(res, 'Workspace cleared');
}
export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = String(formData.get('next') ?? ''), again = String(formData.get('again') ?? '');
  if (next !== again) return { ok: false, errors: { again: 'The two new passwords do not match.' } };
  const res = await R3.changeOwnPassword(await actorOf(), String(formData.get('current') ?? ''), next);
  if (res.ok) return { ok: true, message: 'Password changed' };
  return { ok: false, errors: res.errors.password ? { next: res.errors.password } : res.errors };
}
export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const v = { email: String(formData.get('email') ?? ''), name: String(formData.get('name') ?? ''), role: String(formData.get('role') ?? ''), password: String(formData.get('password') ?? '') };
  const res = await R3.createUser(await actorOf(), v);
  if (res.ok) refresh();
  // on failure keep what was typed (except the password) so the admin does not have to retype everything
  return res.ok ? { ok: true, message: 'User created' } : { ok: false, errors: res.errors, values: { email: v.email, name: v.name, role: v.role }, nonce: Date.now() + Math.random() };
}
export async function setUserActiveAction(id: number, active: boolean): Promise<FormState> {
  const res = await R3.setUserActive(await actorOf(), id, active); if (res.ok) refresh(); return toState(res, active ? 'User enabled' : 'User disabled');
}
export async function resetUserPasswordAction(id: number, password: string): Promise<FormState> {
  const res = await R3.resetUserPassword(await actorOf(), id, password); return toState(res, 'Password reset');
}

// ───────────── V8 actions ─────────────
export async function decideRefundAction(id: number, decision: 'Approved' | 'Rejected', note: string): Promise<FormState> {
  { const { user } = await requireUser(); const d = await guard(user.role, { module: 'domestic_payments' }, 'edit'); if (d) return d; }
  const res = await R4.decideRefund(await actorOf(), id, decision, note); if (res.ok) refresh(); return toState(res, 'Refund claim ' + decision.toLowerCase() + ' (no payment was made)');
}
export async function decideAllocationAction(id: number, decision: 'Approved' | 'Rejected'): Promise<FormState> {
  { const { user } = await requireUser(); const d = await guard(user.role, { module: 'finance' }, 'edit'); if (d) return d; }
  const res = await R4.decideAllocation(await actorOf(), id, decision); if (res.ok) refresh(); return toState(res, 'Allocation ' + decision.toLowerCase());
}
export async function setTaskStatusAction(id: number, status: 'Open' | 'Done'): Promise<FormState> {
  { const { user } = await requireUser(); const d = await guard(user.role, { module: 'tasks' }, 'edit'); if (d) return d; }
  const res = await R4.setTaskStatus(await actorOf(), id, status); if (res.ok) refresh(); return toState(res, status === 'Done' ? 'Task completed' : 'Task reopened');
}

export async function archiveContractAction(id: number, archived: boolean): Promise<FormState> {
  { const { user } = await requireUser(); const d = await guard(user.role, { module: 'contracts' }, 'edit'); if (d) return d; }
  const res = await R5.setContractArchived(await actorOf(), id, archived); if (res.ok) refresh(); return toState(res, archived ? 'Contract archived (files kept)' : 'Contract restored');
}
export async function addListItemAction(kind: string, value: string): Promise<FormState> {
  const res = await R5.addListItem(await actorOf(), kind, value); if (res.ok) refresh(); return toState(res, 'Added');
}
export async function deleteListItemAction(id: number): Promise<FormState> {
  const res = await R5.deleteListItem(await actorOf(), id); if (res.ok) refresh(); return toState(res, 'Removed');
}

// ───────────── Roles & Access (Managing Director only) ─────────────
export async function setAccessAction(role: Role, moduleId: string, level: Level): Promise<FormState> {
  const res = await AC.setAccess(await actorOf(), role, moduleId, level); if (res.ok) refresh(); return toState(res, 'Access updated');
}
export async function resetAccessAction(role: Role): Promise<FormState> {
  const res = await AC.resetAccess(await actorOf(), role); if (res.ok) refresh(); return toState(res, 'Access reset to the standard levels');
}
