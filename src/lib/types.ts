/**
 * Domain types shared by the UI and the API layer.
 * Shapes mirror what the NestJS backend is expected to return (ISO date strings, ids as strings).
 */

/** "ppm" = PP Meeting — the last stage: GPQ sets the PPM time, the meeting records Findings. */
export type StageKey = "fabric" | "cutting" | "print" | "emb" | "sewing" | "gpq" | "ppm";

/** a) Print, b) Embroidery, c) Print and Emb, d) None — chosen on the New order entry form. */
export type Embellishment = "none" | "print" | "emb" | "print_emb";

/**
 * Where an order is inside one stage.
 * - not_reached: the order has not arrived yet
 * - waiting: arrived, nobody started it (shown as "Ready" / the hand-off label)
 * - skipped: stage is not needed for this order (e.g. Print when embellishment is None)
 */
export type StageState = "not_reached" | "waiting" | "in_progress" | "blocked" | "done" | "skipped";

/** The 7 status tones from the UI guideline §3.2. */
export type StatusTone = "pending" | "ready" | "progress" | "hold" | "blocked" | "rework" | "done";

/** admin, merchandiser and manager are super users (create users, settings, every department). */
export type Role = "admin" | "merchandiser" | "manager" | "supervisor";

export interface UserRef {
  id: string;
  name: string;
  email: string;
}

export interface User extends UserRef {
  /** Sign-in name, e.g. "rahim.mia". */
  username: string;
  /** Employee ID, also accepted at sign-in, e.g. "EMP-0008". */
  employeeId: string;
  role: Role;
  title: string;
  phone: string;
  /** Departments this person works in. Empty = all departments. */
  departments: StageKey[];
  lastActiveAt: string;
  active: boolean;
}

export interface Buyer {
  id: string;
  code: string;
  name: string;
  orderCount?: number;
}

export interface StageRecord {
  stage: StageKey;
  state: StageState;
  /** Word shown on the badge, e.g. "Fabric delivered", "Sent to Print". */
  statusLabel?: string;
  /** When the order arrived in this stage. */
  arrivedAt?: string;
  startedAt?: string;
  doneAt?: string;
  /** The time the department recorded on its action (delivered time / sent time). */
  actionAt?: string;
  comment?: string;
  assignee?: UserRef;
  /** Cutting → Sewing only. */
  sewingUnit?: string;
  /** Reason when blocked. */
  problem?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyer: Buyer;
  colors: string[];
  embellishment: Embellishment;
  /** Set by admin / merchandiser: cutting sends straight to Sewing. */
  ignoreEmbellishment: boolean;
  comments?: string;
  imageUrl?: string;
  createdAt: string;
  createdBy: UserRef;
  stages: Record<StageKey, StageRecord>;
  completedAt?: string;
  commentCount: number;
  /** PP (pre-production) Meeting record. */
  ppMeeting?: PPMeeting;
}

/** One PP Meeting finding: a numbered note, or a photo of hard-copy findings. */
export interface PPMFinding {
  id: string;
  /** 1, 2, 3… in the order they were added. */
  no: number;
  text?: string;
  imageUrl?: string;
  by: UserRef;
  at: string;
}

export interface PPMeeting {
  /** PPM time, set by GPQ. */
  ppmAt: string;
  setBy: UserRef;
  setAt: string;
  findings: PPMFinding[];
}

export interface PPMFindingInput {
  text?: string;
  imageUrl?: string;
}

export type ActivityKind = "created" | "status" | "handoff" | "problem" | "comment";

export interface ActivityEvent {
  id: string;
  orderId: string;
  orderNumber: string;
  kind: ActivityKind;
  stage?: StageKey;
  actor?: UserRef;
  text: string;
  at: string;
  attachmentName?: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface DashboardSummary {
  activeOrders: number;
  waitingOrders: number;
  completedThisMonth: number;
  atRisk: number;
  blocked: number;
  workload: { stage: StageKey; waiting: number; inProgress: number; blocked: number }[];
  longestWaiting: { order: Order; stage: StageKey; days: number }[];
  bottlenecks: { stage: StageKey; count: number; days: number }[];
}

export interface FactoryProfile {
  name: string;
  unit: string;
  address: string;
  timezone: string;
  shift: string;
  phone: string;
}

export interface NotificationSettings {
  handoff: boolean;
  blocked: boolean;
  fabricNotFound: boolean;
  dailySummary: boolean;
  sms: boolean;
}

export type ReportKey = "by-stage" | "stage-time" | "embellishment" | "fabric-issues" | "completed";

export interface ReportResult {
  key: ReportKey;
  chart: { label: string; value: number }[];
  chartUnit: string;
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: Record<string, string | number>[];
}

/* ---------- request bodies ---------- */

export interface CreateOrderInput {
  orderNumber: string;
  buyerId: string;
  colors: string[];
  embellishment: Embellishment;
  comments?: string;
  imageUrl?: string;
}

export interface FabricUpdateInput {
  result: "delivered" | "not_found";
  deliveredAt?: string;
  comment?: string;
}

export interface CuttingDispatchInput {
  sewing?: { sentAt: string; unit: string; comment?: string };
  print?: { sentAt: string; comment?: string };
  emb?: { sentAt: string; comment?: string };
}

export interface StageCompleteInput {
  doneAt: string;
  comment?: string;
  /** Needed when this completion sends the order on to Sewing. */
  sewingUnit?: string;
  /** GPQ only: when the PP Meeting will be held. */
  ppmAt?: string;
}

export interface CreateUserInput {
  name: string;
  username: string;
  employeeId?: string;
  email?: string;
  phone?: string;
  role: Role;
  title?: string;
  departments: StageKey[];
  password: string;
}

export interface UpdateUserInput {
  name?: string;
  role?: Role;
  title?: string;
  departments?: StageKey[];
  active?: boolean;
  /** Sets a new password (reset). */
  password?: string;
}

/** Signed-in user plus the company they belong to. */
export interface SessionUser extends User {
  companyName: string;
}

export interface ProblemInput {
  reason: string;
  note?: string;
}
