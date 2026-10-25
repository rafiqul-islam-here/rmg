"use client";

import { useState } from "react";
import { CalendarCheck, CircleCheck, ClipboardPen, Play, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useRefreshAll } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { nextActionFor, STAGE_LABEL } from "@/lib/stages";
import type { Order, StageKey } from "@/lib/types";
import { DisabledReason } from "./drawer";
import { useSession } from "./session";

/**
 * The ONE big contextual button on a queue card (44px+, full width).
 * Start / Resume act in one tap; Update fabric / Dispatch / Complete open the drawer.
 */
export function QueueAction({ order, stage, onOpen }: { order: Order; stage: StageKey; onOpen: () => void }) {
  const user = useSession();
  const { t } = useI18n();
  const refresh = useRefreshAll();
  const [busy, setBusy] = useState(false);
  const action = nextActionFor(order, stage);
  const label = STAGE_LABEL[stage];

  if (action === "none") return null;

  const denied = !can.actInStage(user, stage) && `Only the ${label} team can update this.`;

  async function quick(kind: "start" | "resume") {
    setBusy(true);
    try {
      await (kind === "start" ? api.startStage(order.id, stage) : api.resumeStage(order.id, stage));
      toast.success(`${order.orderNumber} · ${label} ${kind === "start" ? "started" : "resumed"}.`);
      await refresh();
    } catch (err) {
      toast.error("Not saved", { description: err instanceof Error ? err.message : undefined, duration: Infinity, closeButton: true });
    } finally {
      setBusy(false);
    }
  }

  const cls = "h-12 w-full text-[15px]";
  const button =
    action === "start" ? (
      <Button variant="soft" className={cls} loading={busy} disabled={!!denied} onClick={() => quick("start")}>
        <Play /> {t("Start")}
      </Button>
    ) : action === "resume" ? (
      <Button variant="soft" className={cls} loading={busy} disabled={!!denied} onClick={() => quick("resume")}>
        <Play /> {t("Resume")}
      </Button>
    ) : action === "ppm" ? (
      <Button variant="soft" className={cls} disabled={!!denied} onClick={onOpen}>
        <CalendarCheck /> {order.ppMeeting?.findings.length ? "Add findings" : "Open PP Meeting"}
      </Button>
    ) : action === "update_fabric" ? (
      <Button variant="soft" className={cls} disabled={!!denied} onClick={onOpen}>
        <ClipboardPen /> {t("Update fabric")}
      </Button>
    ) : action === "dispatch" ? (
      <Button variant="soft" className={cls} disabled={!!denied} onClick={onOpen}>
        <Send /> {t("Dispatch")}
      </Button>
    ) : (
      <Button variant="soft" className={cls} disabled={!!denied} onClick={onOpen}>
        <CircleCheck /> {t("Complete")}
      </Button>
    );

  return <DisabledReason reason={denied}>{button}</DisabledReason>;
}
