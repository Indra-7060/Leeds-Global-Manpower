/**
 * "Domain records" are flat, V6-shaped objects (client by NAME, links by CODE such as order_id = "ORD-1001").
 * The database layer (src/lib/repo) maps Prisma rows to these, so every calculation below stays pure and unit-testable.
 */
export type Rec = Record<string, any>;

export interface State {
  clients: Rec[];
  visits: Rec[];
  demands: Rec[];
  orders: Rec[];
  allocations: Rec[];
  candidates: Rec[];
  interviews: Rec[];
  tickets: Rec[];
  warranties: Rec[];
  domestic: Rec[];
  credentials: Rec[];
  finance: Rec[];
  cvInbox: Rec[];
  activity: Rec[];
}

export const emptyState = (): State => ({
  clients: [], visits: [], demands: [], orders: [], allocations: [], candidates: [], interviews: [],
  tickets: [], warranties: [], domestic: [], credentials: [], finance: [], cvInbox: [], activity: [],
});

export interface ReportColumn { key: string; label: string }
export interface ReportResult { name: string; columns: ReportColumn[]; rows: Rec[]; interpretation?: string[]; error?: string }
