/**
 * Small typed API client. Every screen talks to the backend only through these functions.
 * Base URL: NEXT_PUBLIC_API_BASE_URL (NestJS) or the built-in mock at /api/mock.
 */
import type {
  ActivityEvent,
  Buyer,
  CreateOrderInput,
  CreateUserInput,
  PPMFindingInput,
  SessionUser,
  UpdateUserInput,
  CuttingDispatchInput,
  DashboardSummary,
  FabricUpdateInput,
  FactoryProfile,
  NotificationSettings,
  Order,
  Paged,
  ProblemInput,
  ReportKey,
  ReportResult,
  StageCompleteInput,
  StageKey,
  User,
} from "@/lib/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/mock";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Dev-only: `?state=loading|empty|error` in the page URL previews UI states against the mock API. */
function mockStateHeader(): Record<string, string> {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_API_BASE_URL) return {};
  const state = new URLSearchParams(window.location.search).get("state");
  return state ? { "x-mock-state": state } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        "content-type": "application/json",
        ...mockStateHeader(),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? "Something went wrong.");
  }
  return (await res.json()) as T;
}

const get = <T,>(path: string) => request<T>(path);
const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T,>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) });
const patch = <T,>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) });

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false) sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface OrderFilters {
  q?: string;
  buyer?: string;
  stage?: StageKey;
  status?: string;
  embellishment?: string;
  tab?: "all" | "active" | "blocked" | "completed";
  atRisk?: boolean;
  scope?: "queue" | "done_today";
}

export interface MyWork {
  departments: StageKey[];
  todo: { order: Order; stage: StageKey }[];
  inProgress: { order: Order; stage: StageKey }[];
  doneToday: { order: Order; stage: StageKey }[];
}

/** Endpoint paths, also used as SWR cache keys. */
export const paths = {
  me: "/auth/me",
  orders: (f: OrderFilters = {}) => `/orders${qs({ ...f })}`,
  order: (id: string) => `/orders/${encodeURIComponent(id)}`,
  orderActivity: (id: string) => `/orders/${encodeURIComponent(id)}/activity`,
  activity: (limit = 20) => `/activity${qs({ limit })}`,
  notifications: "/notifications",
  dashboard: "/dashboard/summary",
  myWork: "/my-work",
  report: (key: ReportKey) => `/reports/${key}`,
  buyers: "/buyers",
  users: "/users",
  factory: "/settings/factory",
  notificationSettings: "/settings/notifications",
};

export const fetcher = <T,>(path: string) => get<T>(path);

export const api = {
  login: (body: { company?: string; login?: string; password?: string; userId?: string; remember?: boolean }) =>
    post<SessionUser>("/auth/login", body),
  logout: () => post<{ ok: true }>("/auth/logout"),

  createOrder: (body: CreateOrderInput) => post<Order>("/orders", body),
  updateFabric: (id: string, body: FabricUpdateInput) => post<Order>(`${paths.order(id)}/fabric`, body),
  ignoreEmbellishment: (id: string) => post<Order>(`${paths.order(id)}/ignore-embellishment`),
  dispatchCutting: (id: string, body: CuttingDispatchInput) => post<Order>(`${paths.order(id)}/cutting/dispatch`, body),
  startStage: (id: string, stage: StageKey) => post<Order>(`${paths.order(id)}/stages/${stage}/start`),
  completeStage: (id: string, stage: StageKey, body: StageCompleteInput) =>
    post<Order>(`${paths.order(id)}/stages/${stage}/complete`, body),
  reportProblem: (id: string, stage: StageKey, body: ProblemInput) =>
    post<Order>(`${paths.order(id)}/stages/${stage}/problem`, body),
  resumeStage: (id: string, stage: StageKey) => post<Order>(`${paths.order(id)}/stages/${stage}/resume`),
  setPpmTime: (id: string, ppmAt: string) => post<Order>(`${paths.order(id)}/ppm/time`, { ppmAt }),
  addPpmFinding: (id: string, body: PPMFindingInput) => post<Order>(`${paths.order(id)}/ppm/findings`, body),
  completePpm: (id: string, doneAt: string) => post<Order>(`${paths.order(id)}/ppm/complete`, { doneAt }),
  addComment: (id: string, body: { text: string; attachmentName?: string }) =>
    post<{ ok: true }>(`${paths.order(id)}/comments`, body),
  setOrderImage: (id: string, imageUrl: string) => post<Order>(`${paths.order(id)}/image`, { imageUrl }),

  createBuyer: (body: { code: string; name: string }) => post<Buyer>("/buyers", body),
  createUser: (body: CreateUserInput) => post<User>("/users", body),
  updateUser: (id: string, body: UpdateUserInput) => patch<User>(`/users/${id}`, body),
  saveFactory: (body: FactoryProfile) => put<FactoryProfile>("/settings/factory", body),
  saveNotifications: (body: NotificationSettings) => put<NotificationSettings>("/settings/notifications", body),
};

export type { ActivityEvent, Buyer, DashboardSummary, FactoryProfile, NotificationSettings, Order, Paged, ReportResult, User };
