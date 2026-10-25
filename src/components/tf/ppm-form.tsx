"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { CalendarClock, CircleCheck, ClipboardList, ImagePlus, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { formatDateTime, formatDayTime, fromDateTimeLocal, toDateTimeLocal } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Order, PPMFinding } from "@/lib/types";
import { ConfirmDialog, DisabledReason, Field } from "./drawer";
import { useSession } from "./session";
import { ActionBar, FormBlock, nowLocal, SummaryList, useRun } from "./stage-actions";

const MAX_IMAGE = 2 * 1024 * 1024;

/**
 * PP Meeting (PPM queue) — the last step of test cutting.
 * GPQ sets the PPM time; the meeting records Findings as a numbered list, or an uploaded image of
 * hard-copy findings. Completing the PP Meeting completes the order.
 */
export function PpmForm({ order, onDone, sticky }: { order: Order; onDone?: () => void; sticky?: boolean }) {
  const user = useSession();
  const { busy, run } = useRun();
  const fileRef = useRef<HTMLInputElement>(null);
  const meeting = order.ppMeeting;
  const rec = order.stages.ppm;
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const [editTime, setEditTime] = useState(false);
  const [ppmAt, setPpmAt] = useState(meeting ? toDateTimeLocal(meeting.ppmAt) : nowLocal());

  if (!meeting || rec.state === "not_reached") {
    return <p className="text-sm text-muted-foreground">The PP Meeting starts after GPQ completes and sets the PPM time.</p>;
  }

  const open = rec.state === "waiting";
  const denied = !can.actInStage(user, "ppm") && "Only super users and the PP Meeting team can record findings.";
  const canChangeTime = open && (can.actInStage(user, "gpq") || can.actInStage(user, "ppm"));
  const nextNo = meeting.findings.length + 1;

  async function addFinding(imageUrl?: string) {
    if (!text.trim() && !imageUrl) return setError("Write the finding, or upload an image of the findings.");
    await run(
      async () => {
        const saved = await api.addPpmFinding(order.id, { text: text.trim() || undefined, imageUrl });
        // Clear as soon as the server has it, so the next finding can't reuse this text.
        setText("");
        setError(undefined);
        return saved;
      },
      imageUrl ? `${order.orderNumber} · image of findings added (finding ${nextNo}).` : `${order.orderNumber} · finding ${nextNo} added.`,
    );
  }

  function pickImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file (JPG, PNG or WebP).");
    if (file.size > MAX_IMAGE) return setError("Image must be 2 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => void addFinding(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function saveTime() {
    if (!ppmAt) return;
    const ok = await run(() => api.setPpmTime(order.id, fromDateTimeLocal(ppmAt)), `${order.orderNumber} · PPM time set to ${formatDateTime(fromDateTimeLocal(ppmAt))}.`);
    if (ok) setEditTime(false);
  }

  async function complete() {
    const ok = await run(() => api.completePpm(order.id, new Date().toISOString()), `${order.orderNumber} · PP Meeting completed. The order is completed.`, onDone);
    if (ok) setConfirm(false);
  }

  return (
    <div className="grid gap-4">
      {/* PPM time — set by GPQ */}
      <FormBlock icon={CalendarClock} title="PPM time">
        {editTime ? (
          <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Field label="New PPM time" required>
              {(id) => <Input id={id} type="datetime-local" className="tabular" value={ppmAt} onChange={(e) => setPpmAt(e.target.value)} />}
            </Field>
            <Button variant="secondary" onClick={() => setEditTime(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={saveTime} loading={busy}>
              Save time
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="tabular text-lg font-semibold text-ink">{formatDateTime(meeting.ppmAt)}</p>
              <p className="text-xs text-muted-foreground">
                Set by {meeting.setBy.name} · {formatDayTime(meeting.setAt)}
              </p>
            </div>
            {canChangeTime && (
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => setEditTime(true)}>
                Change time
              </Button>
            )}
          </div>
        )}
      </FormBlock>

      {/* Findings — like comments, numbered */}
      <FormBlock
        icon={ClipboardList}
        title="Findings"
        badge={<span className="tabular text-xs text-muted-foreground">{meeting.findings.length} recorded</span>}
      >
        <p className="text-[13px] text-muted-foreground">
          The meeting notes — the final output of test cutting. Write them as a numbered list, or upload an image of hard-copy findings.
        </p>
        <FindingsList findings={meeting.findings} />

        {open && (
          <div className="grid gap-2 rounded-lg border border-border bg-surface p-3">
            <Field label={`Finding ${nextNo}`} error={error}>
              {(id) => (
                <Textarea
                  id={id}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(undefined);
                  }}
                  rows={2}
                  placeholder="e.g. Pocket bag stitching to be reinforced with bartack."
                  disabled={!!denied}
                />
              )}
            </Field>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Findings image file" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <DisabledReason reason={denied}>
                <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={!!denied || busy} className="w-full sm:w-auto">
                  <ImagePlus /> Upload image of findings
                </Button>
              </DisabledReason>
              <DisabledReason reason={denied}>
                <Button variant="secondary" onClick={() => addFinding()} loading={busy && !confirm} disabled={!!denied} className="w-full sm:w-auto">
                  <ListPlus /> Add finding
                </Button>
              </DisabledReason>
            </div>
          </div>
        )}
      </FormBlock>

      {open ? (
        <ActionBar sticky={sticky}>
          <DisabledReason reason={denied || (meeting.findings.length === 0 && "Add at least one finding first.")}>
            <Button onClick={() => setConfirm(true)} disabled={!!denied || meeting.findings.length === 0} className="w-full sm:w-auto">
              <CircleCheck /> Complete PP Meeting
            </Button>
          </DisabledReason>
        </ActionBar>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-st-done-bg px-3 py-2 text-sm font-semibold text-st-done">
          <CircleCheck className="size-4" aria-hidden /> PPM completed
          {rec.doneAt && <span className="tabular font-normal">· {formatDateTime(rec.doneAt)}</span>}
        </p>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Complete the PP Meeting for ${order.orderNumber}?`}
        description="The findings are locked and the order is marked Completed."
        confirmLabel="Complete PP Meeting"
        onConfirm={complete}
        busy={busy}
      >
        <SummaryList
          rows={[
            ["PPM time", formatDateTime(meeting.ppmAt)],
            ["Findings", String(meeting.findings.length)],
          ]}
        />
      </ConfirmDialog>
    </div>
  );
}

/** Numbered findings: text, an image of hard-copy findings, or both. */
export function FindingsList({ findings }: { findings: PPMFinding[] }) {
  if (findings.length === 0) {
    return <p className="rounded-lg border border-dashed border-input px-3 py-4 text-center text-sm text-muted-foreground">No findings yet.</p>;
  }
  return (
    <ol className="grid gap-2" aria-label="Findings">
      {findings.map((f) => (
        <li key={f.id} className="flex gap-3 rounded-lg border border-border bg-surface p-3">
          <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white" aria-hidden>
            {f.no}
          </span>
          <div className="min-w-0 flex-1">
            <span className="sr-only">Finding {f.no}: </span>
            {f.text && <p className="text-sm break-words text-ink">{f.text}</p>}
            {f.imageUrl && (
              <a href={f.imageUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block" aria-label={`Open image of finding ${f.no}`}>
                <Image src={f.imageUrl} alt={`Findings image ${f.no}`} width={160} height={200} className="h-40 w-auto rounded-md border border-border bg-background object-contain" />
              </a>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {f.by.name} · {formatDayTime(f.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
