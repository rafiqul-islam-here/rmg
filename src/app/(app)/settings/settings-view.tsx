"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Building,
  Check,
  CircleCheck,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog, DisabledReason, Drawer, Field } from "@/components/tf/drawer";
import { PageHeader, Section } from "@/components/tf/page";
import { useSession } from "@/components/tf/session";
import { STAGE_ICON } from "@/components/tf/stage-icon";
import { EmptyState, ErrorState, Skel } from "@/components/tf/states";
import { TabBar } from "@/components/tf/tab-bar";
import { api, ApiError } from "@/lib/api/client";
import { useBuyers, useFactory, useNotificationSettings, useRefreshAll, useUsers } from "@/lib/api/hooks";
import { formatRelative, initials } from "@/lib/format";
import { useI18n, type Lang } from "@/lib/i18n";
import { can, isSuperUser, ROLE_LABEL, ROLE_SUMMARY } from "@/lib/permissions";
import { SEWING_UNITS, STAGE_KEYS, STAGE_LABEL } from "@/lib/stages";
import type { FactoryProfile, NotificationSettings, Role, StageKey, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "factory" | "users" | "buyers" | "departments" | "notifications" | "language";

const TABS: { value: Tab; label: string }[] = [
  { value: "factory", label: "Company profile" },
  { value: "users", label: "Users & roles" },
  { value: "buyers", label: "Buyers" },
  { value: "departments", label: "Departments & stages" },
  { value: "notifications", label: "Notifications" },
  { value: "language", label: "Language" },
];

export function SettingsView() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((x) => x.value === sp.get("tab"))?.value ?? "users") as Tab;

  return (
    <div className="space-y-4">
      <PageHeader title={t("Settings")} subtitle="Factory, people, buyers and how orders move." />
      <TabBar<Tab> label="Settings sections" value={tab} onChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })} tabs={TABS} />
      {tab === "factory" && <FactoryTab />}
      {tab === "users" && <UsersTab />}
      {tab === "buyers" && <BuyersTab />}
      {tab === "departments" && <DepartmentsTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "language" && <LanguageTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ Factory */

function FactoryTab() {
  const { data, error, isLoading, mutate } = useFactory();
  if (error) return <ErrorState error={error} title="Couldn't load the factory profile." onRetry={() => mutate()} />;
  if (isLoading || !data) return <Skel className="h-96 rounded-xl" />;
  return <FactoryForm initial={data} />;
}

function FactoryForm({ initial }: { initial: FactoryProfile }) {
  const router = useRouter();
  const refresh = useRefreshAll();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (k: keyof FactoryProfile) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Enter the company name.");
    setBusy(true);
    try {
      await api.saveFactory(form);
      toast.success("Company profile saved.");
      await refresh();
      // The company name is part of the session (sidebar, top bar), so reload server data.
      router.refresh();
    } catch (err) {
      toast.error("Not saved", { description: err instanceof Error ? err.message : undefined, duration: Infinity, closeButton: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Section title="Company profile" description="Your company name is shown in the app and needed to sign in.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Company name" required error={error} helper="Shown in the app and used on the login page. Tell your team if you change it.">
            {(id) => <Input id={id} value={form.name} onChange={(e) => { set("name")(e); setError(undefined); }} />}
          </Field>
          <Field label="Unit">{(id) => <Input id={id} value={form.unit} onChange={set("unit")} />}</Field>
          <Field label="Address" className="md:col-span-2">{(id) => <Input id={id} value={form.address} onChange={set("address")} />}</Field>
          <Field label="Phone">{(id) => <Input id={id} value={form.phone} onChange={set("phone")} />}</Field>
          <Field label="Shift">{(id) => <Input id={id} value={form.shift} onChange={set("shift")} />}</Field>
          <Field label="Time zone" helper="All times in ThreadFlow use Bangladesh time.">
            {(id) => <Input id={id} value={form.timezone} readOnly className="bg-background text-muted-foreground" />}
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={() => setForm(initial)} disabled={!dirty || busy}>
            Reset
          </Button>
          <Button type="submit" loading={busy} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </Section>
    </form>
  );
}

/* ------------------------------------------------------------------ Users & roles */

const ROLES: Role[] = ["admin", "merchandiser", "manager", "supervisor"];
const ROLE_TONE: Record<Role, string> = {
  admin: "bg-navy text-white",
  merchandiser: "bg-st-rework-bg text-st-rework",
  manager: "bg-primary-soft text-primary",
  supervisor: "bg-st-ready-bg text-st-ready",
};

function RoleBadge({ role }: { role: Role }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", ROLE_TONE[role])}>{ROLE_LABEL[role]}</span>;
}

function SuperUserTag() {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-primary/30 px-2 text-xs font-medium text-primary" title="Super user: can create users and manage settings">
      <ShieldCheck className="size-3.5" aria-hidden /> Super user
    </span>
  );
}

function deptText(u: Pick<User, "departments">) {
  return u.departments.length === 0 ? "All departments" : u.departments.map((d) => STAGE_LABEL[d]).join(", ");
}

type DrawerState = { mode: "create" } | { mode: "edit"; user: User } | null;

function UsersTab() {
  const me = useSession();
  const { data, error, isLoading, mutate } = useUsers();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "all">("all");
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const users = data?.items ?? [];
  const needle = q.trim().toLowerCase();
  const list = users
    .filter((u) => role === "all" || u.role === role)
    .filter((u) => !needle || [u.name, u.username, u.employeeId, u.email, u.phone, u.title].some((v) => v.toLowerCase().includes(needle)));

  return (
    <div className="space-y-4">
      <Section
        title="Users"
        description={data ? `${users.filter((u) => u.active).length} active accounts · super users can create users` : "Who can sign in and what they can do."}
        actions={
          <Button onClick={() => setDrawer({ mode: "create" })}>
            <UserPlus /> Create user
          </Button>
        }
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative xl:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find by name, username or ID…" aria-label="Search users" className="pl-9" />
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]" role="group" aria-label="Filter by role">
            {(["all", ...ROLES] as const).map((r) => {
              const n = r === "all" ? users.length : users.filter((u) => u.role === r).length;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={cn(
                    "h-9 shrink-0 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap",
                    role === r ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:text-ink",
                  )}
                >
                  {r === "all" ? "All" : ROLE_LABEL[r]} <span className="tabular">({n})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          {error ? (
            <ErrorState error={error} title="Couldn't load users." onRetry={() => mutate()} />
          ) : isLoading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skel key={i} className="h-14" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState icon={Users} title={users.length ? "Nobody matches this search." : "No users yet."} className="py-8" />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {list.map((u) => {
                const editable = can.editUser(me, u);
                return (
                  <li key={u.id} className={cn("flex flex-col gap-3 p-3 sm:flex-row sm:items-center", !u.active && "bg-background")}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar className="size-10">
                        <AvatarFallback className={cn("text-sm font-semibold", u.active ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")}>{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                          {u.name}
                          <RoleBadge role={u.role} />
                          {isSuperUser(u) && <SuperUserTag />}
                          {!u.active && <span className="text-xs font-medium text-muted-foreground">· Turned off</span>}
                        </p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          <span className="font-medium text-ink">@{u.username}</span> · <span className="tabular">{u.employeeId}</span>
                          {u.title && u.title !== ROLE_LABEL[u.role] && ` · ${u.title}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 pl-[52px] sm:pl-0">
                      <div className="text-xs sm:text-right">
                        <p className="text-ink">{deptText(u)}</p>
                        <p className="text-muted-foreground">Active {formatRelative(u.lastActiveAt)}</p>
                      </div>
                      <DisabledReason reason={!editable && (u.id === me.id ? "You can't change your own account here." : "Only an admin can change an admin account.")}>
                        <Button variant="secondary" size="sm" onClick={() => setDrawer({ mode: "edit", user: u })} disabled={!editable}>
                          Change
                        </Button>
                      </DisabledReason>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Section>

      <Section title="What each role can do" description="Admin, Merchandiser and Production Manager are super users. Supervisors work only in their own departments.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap gap-1.5">
                <RoleBadge role={r} />
                {isSuperUser({ role: r }) && <SuperUserTag />}
              </div>
              <ul className="mt-3 space-y-1.5 text-[13px]">
                {ROLE_SUMMARY[r].can.map((c) => (
                  <li key={c} className="flex gap-2 text-ink">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                    {c}
                  </li>
                ))}
                {ROLE_SUMMARY[r].cannot.map((c) => (
                  <li key={c} className="flex gap-2 text-muted-foreground">
                    <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>
                      <span className="sr-only">Cannot: </span>
                      {c}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <UserDrawer key={drawer?.mode === "edit" ? drawer.user.id : (drawer?.mode ?? "closed")} state={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

/** Readable temporary password, e.g. "tf-k7m2qd". Generated on click (not during render). */
function makePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return `tf-${Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")}`;
}

function UserDrawer({ state, onClose }: { state: DrawerState; onClose: () => void }) {
  const me = useSession();
  const refresh = useRefreshAll();
  const editing = state?.mode === "edit" ? state.user : null;
  const roles = ROLES.filter((r) => can.assignRole(me, r));
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    username: editing?.username ?? "",
    employeeId: editing?.employeeId ?? "",
    phone: editing?.phone ?? "",
    email: editing?.email ?? "",
    role: (editing?.role ?? "supervisor") as Role,
    title: editing?.title ?? "",
    departments: editing?.departments ?? ([] as StageKey[]),
    active: editing?.active ?? true,
    password: "",
  });
  const [showPassword, setShowPassword] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const floorRole = form.role === "supervisor";
  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  function toggleDept(k: StageKey, on: boolean) {
    setForm((f) => ({ ...f, departments: on ? [...f.departments, k] : f.departments.filter((d) => d !== k) }));
    setErrors((e) => ({ ...e, departments: "" }));
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Enter the full name.";
    if (!editing && !/^[a-z0-9._-]{3,30}$/.test(form.username.trim().toLowerCase())) e.username = "3–30 letters, numbers, dots or dashes. No spaces.";
    if (floorRole && form.departments.length === 0) e.departments = "Choose at least one department.";
    if (!editing && form.password.length < 6) e.password = "At least 6 characters.";
    if (editing && form.password && form.password.length < 6) e.password = "At least 6 characters, or leave empty.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const departments = floorRole ? form.departments : [];
      const title = form.title.trim() || ROLE_LABEL[form.role];
      if (editing) {
        await api.updateUser(editing.id, { name: form.name.trim(), role: form.role, title, departments, active: form.active, password: form.password || undefined });
        toast.success(form.password ? `${form.name.trim()} updated. New password set.` : `${form.name.trim()} updated.`);
      } else {
        const created = await api.createUser({
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          employeeId: form.employeeId.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          role: form.role,
          title,
          departments,
          password: form.password,
        });
        toast.success(`User ${created.name} created`, { description: `Sign in: ${me.companyName} · ${created.username} (${created.employeeId})` });
      }
      await refresh();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const msg = err.message;
        setErrors(msg.includes("Employee") ? { employeeId: msg } : msg.includes("email") ? { email: msg } : { username: msg });
      } else toast.error("Not saved", { description: err instanceof Error ? err.message : undefined, duration: Infinity, closeButton: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={!!state}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? `Change ${editing.name}` : "Create user"}
      description={editing ? "Update role, departments, reset the password or turn the account off." : "Give the person a username and a temporary password to sign in."}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            {editing ? "Save changes" : "Create user"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="Full name" required error={errors.name}>
          {(id) => <Input id={id} value={form.name} onChange={(e) => set("name")(e.target.value)} autoComplete="off" />}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" required={!editing} error={errors.username} helper={editing ? "Usernames can't be changed." : "Used to sign in, e.g. rahim.mia"}>
            {(id) => (
              <Input
                id={id}
                value={form.username}
                onChange={(e) => set("username")(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                readOnly={!!editing}
                className={cn(editing && "bg-background")}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            )}
          </Field>
          <Field label="Employee ID" error={errors.employeeId} helper={editing ? "Also accepted at sign-in." : "Leave empty to assign the next ID."}>
            {(id) => (
              <Input
                id={id}
                value={form.employeeId}
                onChange={(e) => set("employeeId")(e.target.value.toUpperCase())}
                readOnly={!!editing}
                placeholder="Auto, e.g. EMP-0019"
                className={cn("tabular", editing && "bg-background")}
              />
            )}
          </Field>
        </div>

        {!editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone (optional)">
              {(id) => <Input id={id} value={form.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="+880 1712 345678" inputMode="tel" />}
            </Field>
            <Field label="Email (optional)" error={errors.email}>
              {(id) => <Input id={id} value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="name@factory.com" inputMode="email" />}
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" required>
            {(id) => (
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
                <SelectTrigger id={id} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                      {isSuperUser({ role: r }) && " · super user"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Job title" helper="e.g. Cutting Supervisor · Line B">
            {(id) => <Input id={id} value={form.title} onChange={(e) => set("title")(e.target.value)} />}
          </Field>
        </div>

        {floorRole && (
          <div className="grid gap-2" role="group" aria-labelledby="dept-access">
            <p id="dept-access" className="text-[13px] font-medium text-ink">
              Department access <span className="text-danger" aria-hidden>*</span>
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
              {STAGE_KEYS.map((k) => (
                <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={form.departments.includes(k)} onCheckedChange={(c) => toggleDept(k, c === true)} />
                  {STAGE_LABEL[k]}
                </label>
              ))}
            </div>
            {errors.departments && <p className="text-xs text-st-blocked" role="alert">{errors.departments}</p>}
          </div>
        )}

        <Field
          label={editing ? "Reset password (optional)" : "Temporary password"}
          required={!editing}
          error={errors.password}
          helper={editing ? "Leave empty to keep the current password." : "Share it with the person. At least 6 characters."}
        >
          {(id) => (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id={id}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password")(e.target.value)}
                  autoComplete="new-password"
                  className="tabular pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-ink"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button type="button" variant="secondary" onClick={() => set("password")(makePassword())}>
                Generate
              </Button>
            </div>
          )}
        </Field>

        {editing && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="active" className="text-sm font-semibold">Account active</Label>
              <p className="text-xs text-muted-foreground">Turned-off accounts can&apos;t sign in. Their history stays.</p>
            </div>
            <Switch id="active" checked={form.active} onCheckedChange={(c) => setForm((f) => ({ ...f, active: c }))} />
          </div>
        )}

        {!editing && (
          <div className="rounded-lg border border-border bg-background p-4 text-[13px]">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">They will sign in with</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Company</dt>
              <dd className="font-semibold text-ink">{me.companyName}</dd>
              <dt className="text-muted-foreground">Username or ID</dt>
              <dd className="font-semibold text-ink">{form.username.trim() || "—"} {form.employeeId.trim() ? `or ${form.employeeId.trim()}` : "or the assigned employee ID"}</dd>
              <dt className="text-muted-foreground">Password</dt>
              <dd className="tabular font-semibold text-ink">{form.password ? (showPassword ? form.password : "••••••") : "—"}</dd>
            </dl>
          </div>
        )}

        <div className="rounded-lg bg-primary-soft p-4">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
            <ShieldCheck className="size-4" aria-hidden /> Permission preview
          </p>
          <p className="mt-2 text-sm font-semibold text-ink">{form.name.trim() || "This person"} will be able to:</p>
          <ul className="mt-1.5 space-y-1 text-[13px] text-ink">
            {ROLE_SUMMARY[form.role].can.map((c) => (
              <li key={c} className="flex gap-2">
                <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                {c}
                {floorRole && c.includes("their") && form.departments.length > 0 && ` (${form.departments.map((d) => STAGE_LABEL[d]).join(", ")})`}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ Buyers */

function BuyersTab() {
  const { data, error, isLoading, mutate } = useBuyers();
  const refresh = useRefreshAll();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});
  const [busy, setBusy] = useState(false);

  async function add() {
    const e: typeof errors = {};
    if (!/^[A-Za-z]{2,5}$/.test(code.trim())) e.code = "Use 2–5 letters, e.g. STD.";
    if (!name.trim()) e.name = "Enter the buyer name.";
    setErrors(e);
    if (e.code || e.name) return;
    setBusy(true);
    try {
      await api.createBuyer({ code: code.trim().toUpperCase(), name: name.trim() });
      toast.success(`Buyer ${name.trim()} added.`);
      await refresh();
      setOpen(false);
      setCode("");
      setName("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ code: err.message });
      else toast.error("Not saved", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Buyers"
      description="Buyer accounts available on the New order form."
      actions={
        <Button onClick={() => setOpen(true)}>
          <Plus /> Add buyer
        </Button>
      }
    >
      {error ? (
        <ErrorState error={error} title="Couldn't load buyers." onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Skel className="h-48" />
      ) : !data?.items.length ? (
        <EmptyState icon={Building} title="No buyers yet." description="Add your first buyer to start taking orders." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.items.map((b) => (
            <li key={b.id} className="flex items-center gap-3 p-3">
              <span className="flex h-10 min-w-12 items-center justify-center rounded-lg bg-primary-soft px-2 text-sm font-bold text-primary">{b.code}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{b.name}</p>
                <p className="tabular text-xs text-muted-foreground">
                  {b.orderCount ?? 0} {b.orderCount === 1 ? "order" : "orders"}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link href={`/orders/new?buyer=${b.id}`}>
                  New order <ArrowRight className="size-4" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={open} onOpenChange={setOpen} title="Add buyer" confirmLabel="Add buyer" onConfirm={add} busy={busy}>
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <Field label="Code" required error={errors.code}>
            {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={5} placeholder="STD" />}
          </Field>
          <Field label="Buyer name" required error={errors.name}>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="STADIUM" />}
          </Field>
        </div>
      </ConfirmDialog>
    </Section>
  );
}

/* ------------------------------------------------------------------ Departments & stages */

function DepartmentsTab() {
  const { t } = useI18n();
  const rules: Record<StageKey, string> = {
    fabric: "Marks Fabric delivered (with time) or Fabric not found. Delivered sends the order to Cutting.",
    ppm: "PPM queue: the meeting records Findings — a numbered list or an image of hard-copy findings. Completing it completes the order.",
    cutting: "Dispatches by embellishment: None → Sewing (with unit), Print → Print, Emb → Emb, Print and Emb → both at once.",
    print: "Only for orders with Print. Sends to Sewing when all embellishment is done.",
    emb: "Only for orders with Embroidery. Runs at the same time as Print when both are needed.",
    sewing: "Works per sewing unit. Completing sends the order to GPQ.",
    gpq: "Quality check. Completing it sets the PPM time and sends the order to the PP Meeting.",
  };
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Section title="Production flow" description="The order every job moves through. Changing the flow needs a new release in v1." className="xl:col-span-2">
        <ol className="space-y-2">
          {STAGE_KEYS.map((k, i) => {
            const Icon = STAGE_ICON[k];
            const optional = k === "print" || k === "emb";
            return (
              <li key={k} className={cn("flex gap-3 rounded-lg border p-3", optional ? "border-dashed border-input" : "border-border")}>
                <span className="tabular flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    <span className="tabular text-muted-foreground">{i + 1}.</span> {t(STAGE_LABEL[k])}
                    {optional && <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">Optional</span>}
                  </p>
                  <p className="text-[13px] text-muted-foreground">{rules[k]}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 rounded-lg bg-background p-3 text-[13px] text-muted-foreground">
          <b className="text-ink">Ignore embellishment:</b> Admin and Merchandiser can skip Print / Emb on an order before Cutting dispatches it. Cutting then sends it straight to Sewing.
        </p>
      </Section>
      <Section title="Sewing units" description="Cutting picks one when sending to Sewing.">
        <ul className="space-y-2">
          {SEWING_UNITS.map((u) => (
            <li key={u} className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-ink">
              {u}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ Notifications */

function NotificationsTab() {
  const { data, error, isLoading, mutate } = useNotificationSettings();
  if (error) return <ErrorState error={error} title="Couldn't load notification settings." onRetry={() => mutate()} />;
  if (isLoading || !data) return <Skel className="h-72 rounded-xl" />;
  return <NotificationsForm initial={data} />;
}

function NotificationsForm({ initial }: { initial: NotificationSettings }) {
  const refresh = useRefreshAll();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const rows: { key: keyof NotificationSettings; label: string; hint: string }[] = [
    { key: "handoff", label: "Hand-offs", hint: "When an order arrives in your department." },
    { key: "blocked", label: "Problems", hint: "When someone reports a problem on an order." },
    { key: "fabricNotFound", label: "Fabric not found", hint: "When Fabric flags missing fabric." },
    { key: "dailySummary", label: "Daily summary", hint: "One message at the end of each shift." },
    { key: "sms", label: "Also send by SMS", hint: "For people without the app open. Carrier charges may apply." },
  ];

  async function save() {
    setBusy(true);
    try {
      await api.saveNotifications(form);
      toast.success("Notification settings saved.");
      await refresh();
    } catch (err) {
      toast.error("Not saved", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Notifications" description="What the bell (and SMS) tells people about.">
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <Label htmlFor={`n-${r.key}`} className="text-sm font-semibold text-ink">{r.label}</Label>
              <p className="text-[13px] text-muted-foreground">{r.hint}</p>
            </div>
            <Switch id={`n-${r.key}`} checked={form[r.key]} onCheckedChange={(c) => setForm((f) => ({ ...f, [r.key]: c }))} />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={() => setForm(initial)} disabled={!dirty || busy}>
          <X /> Reset
        </Button>
        <Button onClick={save} loading={busy} disabled={!dirty}>
          Save changes
        </Button>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ Language */

function LanguageTab() {
  const { lang, setLang } = useI18n();
  const opts: { value: Lang; label: string; sample: string }[] = [
    { value: "en", label: "English", sample: "My Work · In progress · Completed" },
    { value: "bn", label: "বাংলা (Bangla)", sample: "আমার কাজ · চলমান · সম্পন্ন" },
  ];
  return (
    <Section title="Language" description="Saved on this device. Order codes and numbers stay in English digits.">
      <RadioGroup
        value={lang}
        onValueChange={(v) => {
          setLang(v as Lang);
          toast.success(v === "bn" ? "ভাষা বাংলা করা হয়েছে।" : "Language set to English.");
        }}
        className="grid gap-2 md:grid-cols-2"
        aria-label="Language"
      >
        {opts.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border p-4",
              lang === o.value ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50",
            )}
          >
            <RadioGroupItem value={o.value} />
            <span>
              <span className="block font-semibold text-ink">{o.label}</span>
              <span className="block text-[13px] text-muted-foreground">{o.sample}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </Section>
  );
}
