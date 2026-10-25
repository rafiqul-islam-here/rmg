"use client";

import { useState } from "react";
import {
  CircleCheck,
  CirclePlay,
  Layers,
  OctagonAlert,
  PackageX,
  Play,
  Printer,
  Route,
  SkipForward,
  Sparkles,
  Shirt,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { useRefreshAll } from "@/lib/api/hooks";
import { formatDateTime, fromDateTimeLocal, toDateTimeLocal } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import {
  EMBELLISHMENT_LABEL,
  embellishmentStages,
  nextStageName,
  PROBLEM_REASONS,
  SEWING_UNITS,
  STAGE_LABEL,
  STATUS_WORDS,
} from "@/lib/stages";
import type { Order, StageKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog, DisabledReason, Field } from "./drawer";
import { PpmForm } from "./ppm-form";
import { useSession } from "./session";
import { StatusBadge } from "./status-badge";

/* ---------------------------------------------------------------- helpers */

export function useRun() {
  const refresh = useRefreshAll();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, success: string, onDone?: () => void) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await refresh();
      onDone?.();
      return true;
    } catch (err) {
      toast.error("Not saved", {
        description: err instanceof Error ? err.message : "Please try again.",
        duration: Infinity,
        closeButton: true,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

export const nowLocal = () => toDateTimeLocal(new Date().toISOString());

/** Footer that sticks to the bottom of the drawer body. */
export function ActionBar({ children, sticky }: { children: React.ReactNode; sticky?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end",
        sticky && "sticky -bottom-4 z-10 -mx-4 mt-4 border-t border-border bg-surface px-4 pb-4 xl:-mx-6 xl:px-6",
      )}
    >
      {children}
    </div>
  );
}

export function FormBlock({ icon: Icon, title, badge, children, tone = "default" }: { icon: LucideIcon; title: string; badge?: React.ReactNode; children: React.ReactNode; tone?: "default" | "print" | "emb" }) {
  return (
    <section className={cn("rounded-lg border border-border p-4", tone === "default" ? "bg-background" : "bg-surface")}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon className="size-4 text-primary" aria-hidden />
          {title}
        </h4>
        {badge}
      </header>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

/** Read-only "Status" field: the status this action sets (as shown in the UI documentation). */
function StatusField({ label }: { label: string }) {
  return (
    <Field label="Status">
      {(id) => (
        <div id={id} className="flex h-11 items-center rounded-md border border-border bg-background px-3 xl:h-10" aria-readonly>
          <StatusBadge tone="ready" label={label} size="sm" />
        </div>
      )}
    </Field>
  );
}

/* ---------------------------------------------------------------- Fabric */

export function FabricForm({ order, onDone, sticky }: { order: Order; onDone?: () => void; sticky?: boolean }) {
  const user = useSession();
  const { t } = useI18n();
  const { busy, run } = useRun();
  const rec = order.stages.fabric;
  const [result, setResult] = useState<"delivered" | "not_found">("delivered");
  const [time, setTime] = useState(nowLocal);
  const [comment, setComment] = useState(rec.state === "blocked" ? "" : (rec.comment ?? ""));
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();

  const denied = !can.actInStage(user, "fabric") && "Only the Fabric team can update fabric.";
  if (rec.state === "done") {
    return <DoneNote label={STATUS_WORDS.fabricDelivered} at={rec.actionAt} comment={rec.comment} />;
  }

  function submit() {
    if (result === "delivered" && !time) return setError("Enter the delivered time.");
    if (result === "delivered") return setConfirm(true);
    void save();
  }

  async function save() {
    const ok = await run(
      () =>
        api.updateFabric(order.id, {
          result,
          deliveredAt: result === "delivered" ? fromDateTimeLocal(time) : undefined,
          comment: comment.trim() || undefined,
        }),
      result === "delivered"
        ? `${order.orderNumber} · fabric delivered. Cutting has been notified.`
        : `${order.orderNumber} · marked "Fabric not found".`,
      onDone,
    );
    if (ok) setConfirm(false);
  }

  return (
    <div className="grid gap-4">
      {rec.state === "blocked" && (
        <p className="rounded-lg bg-st-blocked-bg px-3 py-2 text-sm text-st-blocked">
          Marked <b>Fabric not found</b>
          {rec.comment ? ` — ${rec.comment.replace(/[.\s]+$/, "")}` : ""}. Update it once the fabric arrives.
        </p>
      )}
      <p id="fabric-status" className="-mb-2 text-[13px] font-medium text-ink">
        Status <span className="text-danger" aria-hidden>*</span>
      </p>
      <RadioGroup value={result} onValueChange={(v) => setResult(v as typeof result)} className="grid gap-2 sm:grid-cols-2" aria-labelledby="fabric-status">
        <ChoiceCard value="delivered" checked={result === "delivered"} icon={CircleCheck} title={t("Fabric delivered")} hint="Send the order to Cutting" />
        <ChoiceCard value="not_found" checked={result === "not_found"} icon={PackageX} title={t("Fabric not found")} hint="Keep it in Fabric and flag it" />
      </RadioGroup>
      {result === "delivered" && (
        <Field label="Fabric Delivered Time" required error={error}>
          {(id) => <Input id={id} type="datetime-local" value={time} onChange={(e) => { setTime(e.target.value); setError(undefined); }} className="tabular" />}
        </Field>
      )}
      <Field label="Comments (Optional)">
        {(id) => <Textarea id={id} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={result === "delivered" ? "e.g. Checked and approved by QA" : "e.g. Supplier truck delayed, new ETA tomorrow"} />}
      </Field>
      <ActionBar sticky={sticky}>
        <DisabledReason reason={denied}>
          <Button onClick={submit} loading={busy && !confirm} disabled={!!denied} className="w-full sm:w-auto">
            {result === "delivered" ? "Save · send to Cutting" : "Save · fabric not found"}
          </Button>
        </DisabledReason>
      </ActionBar>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Send ${order.orderNumber} to Cutting?`}
        description="Cutting will be notified and the order moves to their queue."
        confirmLabel="Send to Cutting"
        onConfirm={save}
        busy={busy}
      >
        <SummaryList rows={[["Fabric delivered", formatDateTime(fromDateTimeLocal(time))], ["Comment", comment.trim() || "—"]]} />
      </ConfirmDialog>
    </div>
  );
}

function ChoiceCard({ value, checked, icon: Icon, title, hint }: { value: string; checked: boolean; icon: LucideIcon; title: string; hint: string }) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border bg-surface p-3 transition-colors",
        checked ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50",
      )}
    >
      <RadioGroupItem value={value} />
      <Icon className={cn("size-5 shrink-0", checked ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

/* ---------------------------------------------------------------- Cutting dispatch */

export function CuttingDispatchForm({ order, onDone, sticky }: { order: Order; onDone?: () => void; sticky?: boolean }) {
  const user = useSession();
  const { busy, run } = useRun();
  const rec = order.stages.cutting;
  const route = embellishmentStages(order);
  const [values, setValues] = useState({
    sewingAt: nowLocal(),
    unit: "",
    sewingComment: "",
    printAt: nowLocal(),
    printComment: "",
    embAt: nowLocal(),
    embComment: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<"dispatch" | "ignore" | null>(null);
  const set = (k: keyof typeof values) => (v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  if (rec.state === "done") return <DoneNote label={`Dispatched to ${nextStageName(order, "cutting")}`} at={rec.doneAt} />;
  if (rec.state === "not_reached") return <p className="text-sm text-muted-foreground">Cutting can start after Fabric is delivered.</p>;

  const denied = !can.actInStage(user, "cutting")
    ? "Only the Cutting team can dispatch this order."
    : rec.state === "blocked"
      ? "Resolve the problem first."
      : null;
  const canIgnore = can.ignoreEmbellishment(user) && order.embellishment !== "none" && !order.ignoreEmbellishment;
  const target = nextStageName(order, "cutting");

  function validate() {
    const e: Record<string, string> = {};
    if (route.length === 0) {
      if (!values.sewingAt) e.sewingAt = "Enter the sewing sent time.";
      if (!values.unit) e.unit = "Choose a sewing unit.";
    }
    if (route.includes("print") && !values.printAt) e.printAt = "Enter the print sent time.";
    if (route.includes("emb") && !values.embAt) e.embAt = "Enter the EMB sent time.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function dispatch() {
    const ok = await run(
      () =>
        api.dispatchCutting(order.id, {
          sewing: route.length === 0 ? { sentAt: fromDateTimeLocal(values.sewingAt), unit: values.unit, comment: values.sewingComment || undefined } : undefined,
          print: route.includes("print") ? { sentAt: fromDateTimeLocal(values.printAt), comment: values.printComment || undefined } : undefined,
          emb: route.includes("emb") ? { sentAt: fromDateTimeLocal(values.embAt), comment: values.embComment || undefined } : undefined,
        }),
      `${order.orderNumber} · Cutting dispatched. ${target} has been notified.`,
      onDone,
    );
    if (ok) setConfirm(null);
  }

  async function ignore() {
    const ok = await run(() => api.ignoreEmbellishment(order.id), `${order.orderNumber} · embellishment ignored. Cutting will send it to Sewing.`);
    if (ok) setConfirm(null);
  }

  const routeLabel = order.ignoreEmbellishment ? "None (ignored)" : EMBELLISHMENT_LABEL[order.embellishment];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <Route className="size-4" aria-hidden /> Embellishment action route: <span className="text-primary normal-case">{routeLabel}</span>
        </p>
        {canIgnore && (
          <Button variant="secondary" size="sm" onClick={() => setConfirm("ignore")}>
            <SkipForward /> Ignore embellishment
          </Button>
        )}
      </div>

      {/* Option 1 — no embellishment: sewing sent time + one sewing unit + "Sent to Sewing" */}
      {route.length === 0 && (
        <FormBlock icon={Shirt} title="Sewing Action">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sewing Sent Time" required error={errors.sewingAt}>
              {(id) => <Input id={id} type="datetime-local" className="tabular" value={values.sewingAt} onChange={(e) => set("sewingAt")(e.target.value)} />}
            </Field>
            <Field label="Sewing Unit" required error={errors.unit}>
              {(id) => (
                <Select value={values.unit} onValueChange={set("unit")}>
                  <SelectTrigger id={id} className="w-full" aria-invalid={!!errors.unit}>
                    <SelectValue placeholder="Select one sewing unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEWING_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <StatusField label={STATUS_WORDS.sentToSewing} />
          </div>
          <Field label="Comments (Optional)">
            {(id) => <Input id={id} value={values.sewingComment} onChange={(e) => set("sewingComment")(e.target.value)} placeholder="e.g. 42 bundles, sizes S–XL" />}
          </Field>
        </FormBlock>
      )}

      {/* Options 2 & 3 — only print or only emb: sent time + status + comments */}
      {route.length === 1 && route[0] === "print" && (
        <FormBlock icon={Printer} title="Print Action">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Print Sent Time" required error={errors.printAt}>
              {(id) => <Input id={id} type="datetime-local" className="tabular" value={values.printAt} onChange={(e) => set("printAt")(e.target.value)} />}
            </Field>
            <StatusField label={STATUS_WORDS.sentToPrint} />
          </div>
          <Field label="Comments (Optional)">
            {(id) => <Input id={id} value={values.printComment} onChange={(e) => set("printComment")(e.target.value)} placeholder="e.g. Front chest print, 6 colours" />}
          </Field>
        </FormBlock>
      )}
      {route.length === 1 && route[0] === "emb" && (
        <FormBlock icon={Sparkles} title="Embroidery Action">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="EMB Sent Time" required error={errors.embAt}>
              {(id) => <Input id={id} type="datetime-local" className="tabular" value={values.embAt} onChange={(e) => set("embAt")(e.target.value)} />}
            </Field>
            <StatusField label={STATUS_WORDS.sentToEmb} />
          </div>
          <Field label="Comments (Optional)">
            {(id) => <Input id={id} value={values.embComment} onChange={(e) => set("embComment")(e.target.value)} placeholder="e.g. Sent to Tajima multi-head EMB machine" />}
          </Field>
        </FormBlock>
      )}

      {/* Option 4 — print and emb: both shown at once, done simultaneously */}
      {route.length === 2 && (
        <>
          <p className="flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-2 text-[13px] text-primary">
            <Layers className="size-4 shrink-0" aria-hidden />
            <span><b>Print &amp; Emb Dual Embellishment:</b> both operations can be performed simultaneously.</span>
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <FormBlock icon={Printer} title="a) Print Operation" tone="print" badge={<StatusBadge tone="ready" label={STATUS_WORDS.sentToPrint} size="sm" />}>
              <Field label="Print Sent Time" required error={errors.printAt}>
                {(id) => <Input id={id} type="datetime-local" className="tabular" value={values.printAt} onChange={(e) => set("printAt")(e.target.value)} />}
              </Field>
              <Field label="Print Comments">
                {(id) => <Input id={id} value={values.printComment} onChange={(e) => set("printComment")(e.target.value)} placeholder="Print notes…" />}
              </Field>
            </FormBlock>
            <FormBlock icon={Sparkles} title="b) Embroidery Operation" tone="emb" badge={<StatusBadge tone="ready" label={STATUS_WORDS.sentToEmb} size="sm" />}>
              <Field label="EMB Sent Time" required error={errors.embAt}>
                {(id) => <Input id={id} type="datetime-local" className="tabular" value={values.embAt} onChange={(e) => set("embAt")(e.target.value)} />}
              </Field>
              <Field label="EMB Comments">
                {(id) => <Input id={id} value={values.embComment} onChange={(e) => set("embComment")(e.target.value)} placeholder="EMB notes…" />}
              </Field>
            </FormBlock>
          </div>
        </>
      )}

      <ActionBar sticky={sticky}>
        <ProblemButton order={order} stage="cutting" />
        <DisabledReason reason={denied}>
          <Button onClick={() => validate() && setConfirm("dispatch")} disabled={!!denied} className="w-full sm:w-auto">
            Send to {target}
          </Button>
        </DisabledReason>
      </ActionBar>

      <ConfirmDialog
        open={confirm === "dispatch"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Send ${order.orderNumber} to ${target}?`}
        description={`${target} will be notified. Cutting will be marked as dispatched.`}
        confirmLabel={`Send to ${target}`}
        onConfirm={dispatch}
        busy={busy}
      >
        <SummaryList
          rows={[
            ...(route.length === 0 ? ([["Sewing sent", formatDateTime(fromDateTimeLocal(values.sewingAt))], ["Sewing unit", values.unit]] as [string, string][]) : []),
            ...(route.includes("print") ? ([["Print sent", formatDateTime(fromDateTimeLocal(values.printAt))]] as [string, string][]) : []),
            ...(route.includes("emb") ? ([["EMB sent", formatDateTime(fromDateTimeLocal(values.embAt))]] as [string, string][]) : []),
          ]}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "ignore"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Ignore embellishment on ${order.orderNumber}?`}
        description={`This order is marked "${EMBELLISHMENT_LABEL[order.embellishment]}". Cutting will send it straight to Sewing and skip Print / Emb.`}
        confirmLabel="Ignore embellishment"
        onConfirm={ignore}
        busy={busy}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- Print / Emb / Sewing / GPQ */

export function StageWorkForm({ order, stage, onDone, sticky }: { order: Order; stage: Exclude<StageKey, "fabric" | "ppm" | "cutting">; onDone?: () => void; sticky?: boolean }) {
  const user = useSession();
  const { t } = useI18n();
  const { busy, run } = useRun();
  const rec = order.stages[stage];
  const [doneAt, setDoneAt] = useState(nowLocal);
  const [comment, setComment] = useState("");
  const [unit, setUnit] = useState("");
  // GPQ sets when the PP Meeting will be held (default: tomorrow, same time).
  const [ppmAt, setPpmAt] = useState(() => toDateTimeLocal(new Date(Date.now() + 86_400_000).toISOString()));
  const [error, setError] = useState<string>();
  const [ppmError, setPpmError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const isGpq = stage === "gpq";

  const label = STAGE_LABEL[stage];
  const isEmbStage = stage === "print" || stage === "emb";
  const otherEmb = embellishmentStages(order).filter((k) => k !== stage);
  const sendsToSewing = isEmbStage && otherEmb.every((k) => order.stages[k].state === "done");
  const next = isEmbStage && !sendsToSewing ? null : nextStageName(order, stage);
  const denied = !can.actInStage(user, stage) && `Only the ${label} team can update this.`;

  if (rec.state === "done") return <DoneNote label={`${label} completed`} at={rec.doneAt} comment={rec.comment} />;
  if (rec.state === "skipped") return <p className="text-sm text-muted-foreground">{label} is not needed for this order.</p>;
  if (rec.state === "not_reached")
    return <p className="text-sm text-muted-foreground">{label} can start after the previous stage hands off.</p>;

  if (rec.state === "waiting" || rec.state === "blocked") {
    const resume = rec.state === "blocked";
    return (
      <div className="grid gap-3">
        {resume && (
          <p className="rounded-lg bg-st-blocked-bg px-3 py-2 text-sm text-st-blocked">
            <b>Problem:</b> {rec.problem}
            {rec.comment ? ` — ${rec.comment}` : ""}
          </p>
        )}
        <ActionBar sticky={sticky}>
          {!resume && <ProblemButton order={order} stage={stage} />}
          <DisabledReason reason={denied}>
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={!!denied}
              loading={busy}
              onClick={() =>
                run(
                  () => (resume ? api.resumeStage(order.id, stage) : api.startStage(order.id, stage)),
                  `${order.orderNumber} · ${label} ${resume ? "resumed" : "started"}.`,
                )
              }
            >
              {resume ? <Play /> : <CirclePlay />} {t(resume ? "Resume" : "Start")} {label.toLowerCase()}
            </Button>
          </DisabledReason>
        </ActionBar>
      </div>
    );
  }

  function submit() {
    if (!doneAt) return setError("Enter the completed time.");
    if (sendsToSewing && !unit) return setError("Choose a sewing unit.");
    if (isGpq && !ppmAt) return setPpmError("Set the PPM time.");
    setConfirm(true);
  }

  async function complete() {
    const ok = await run(
      () =>
        api.completeStage(order.id, stage, {
          doneAt: fromDateTimeLocal(doneAt),
          comment: comment || undefined,
          sewingUnit: sendsToSewing ? unit : undefined,
          ppmAt: isGpq ? fromDateTimeLocal(ppmAt) : undefined,
        }),
      next ? `${order.orderNumber} · ${label} completed. ${next} has been notified.` : `${order.orderNumber} · ${label} completed.`,
      onDone,
    );
    if (ok) setConfirm(false);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`${label} completed time`} required error={!sendsToSewing ? error : undefined}>
          {(id) => <Input id={id} type="datetime-local" className="tabular" value={doneAt} onChange={(e) => { setDoneAt(e.target.value); setError(undefined); }} />}
        </Field>
        {sendsToSewing && (
          <Field label="Send to sewing unit" required error={error}>
            {(id) => (
              <Select value={unit} onValueChange={(v) => { setUnit(v); setError(undefined); }}>
                <SelectTrigger id={id} className="w-full">
                  <SelectValue placeholder="Choose a unit" />
                </SelectTrigger>
                <SelectContent>
                  {SEWING_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        )}
        {isGpq && (
          <Field label="PPM time" required error={ppmError} helper="When the PP Meeting will be held.">
            {(id) => <Input id={id} type="datetime-local" className="tabular" value={ppmAt} onChange={(e) => { setPpmAt(e.target.value); setPpmError(undefined); }} />}
          </Field>
        )}
      </div>
      {isEmbStage && !sendsToSewing && (
        <p className="text-[13px] text-muted-foreground">
          {STAGE_LABEL[otherEmb[0]]} is still running. The order goes to Sewing when both are completed.
        </p>
      )}
      <Field label="Comment (optional)">
        {(id) => <Textarea id={id} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything the next team should know" />}
      </Field>
      <ActionBar sticky={sticky}>
        <ProblemButton order={order} stage={stage} />
        <DisabledReason reason={denied}>
          <Button onClick={submit} disabled={!!denied} className="w-full sm:w-auto">
            <CircleCheck /> {next ? `Complete & send to ${next}` : `Complete ${label.toLowerCase()}`}
          </Button>
        </DisabledReason>
      </ActionBar>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Complete ${label} for ${order.orderNumber}?`}
        description={next ? `${next} will be notified.` : "The order waits for the other embellishment to finish."}
        confirmLabel={next ? `Complete & send to ${next}` : "Complete"}
        onConfirm={complete}
        busy={busy}
      >
        <SummaryList rows={[["Completed", formatDateTime(fromDateTimeLocal(doneAt))], ...(sendsToSewing ? ([["Sewing unit", unit]] as [string, string][]) : []), ["Comment", comment || "—"]]} />
      </ConfirmDialog>
    </div>
  );
}

/* ---------------------------------------------------------------- Report a problem */

export function ProblemButton({ order, stage }: { order: Order; stage: StageKey }) {
  const user = useSession();
  const { t } = useI18n();
  const { busy, run } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  if (stage === "fabric" || stage === "ppm" || !can.actInStage(user, stage)) return null;
  const rec = order.stages[stage];
  if (rec.state !== "waiting" && rec.state !== "in_progress") return null;

  async function submit() {
    if (!reason) return setError("Choose a reason.");
    const ok = await run(
      () => api.reportProblem(order.id, stage, { reason, note: note.trim() || undefined }),
      `${order.orderNumber} · problem reported in ${STAGE_LABEL[stage]}.`,
    );
    if (ok) {
      setOpen(false);
      setReason("");
      setNote("");
    }
  }

  return (
    <>
      <Button variant="danger-outline" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <OctagonAlert /> {t("Report a problem")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Report a problem · ${STAGE_LABEL[stage]}`}
        description={`${order.orderNumber} will show as Blocked until someone resumes it.`}
        confirmLabel="Report problem"
        onConfirm={submit}
        busy={busy}
        danger
      >
        <div className="grid gap-3">
          <Field label="Reason" required error={error}>
            {(id) => (
              <Select value={reason} onValueChange={(v) => { setReason(v); setError(undefined); }}>
                <SelectTrigger id={id} className="w-full">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {PROBLEM_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Note (optional)">
            {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" />}
          </Field>
        </div>
      </ConfirmDialog>
    </>
  );
}

/* ---------------------------------------------------------------- shared bits */

function DoneNote({ label, at, comment }: { label: string; at?: string; comment?: string }) {
  return (
    <div className="rounded-lg bg-st-done-bg px-3 py-2 text-sm text-st-done">
      <p className="flex items-center gap-2 font-semibold">
        <CircleCheck className="size-4" aria-hidden /> {label}
        {at && <span className="tabular font-normal">· {formatDateTime(at)}</span>}
      </p>
      {comment && <p className="mt-0.5 text-st-done/90">{comment}</p>}
    </div>
  );
}

export function SummaryList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-2 rounded-lg bg-background p-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="tabular text-right font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Picks the right form for a stage. */
export function StageActionPanel({ order, stage, onDone, sticky }: { order: Order; stage: StageKey; onDone?: () => void; sticky?: boolean }) {
  if (stage === "fabric") return <FabricForm order={order} onDone={onDone} sticky={sticky} />;
  if (stage === "ppm") return <PpmForm order={order} onDone={onDone} sticky={sticky} />;
  if (stage === "cutting") return <CuttingDispatchForm order={order} onDone={onDone} sticky={sticky} />;
  return <StageWorkForm order={order} stage={stage} onDone={onDone} sticky={sticky} />;
}
