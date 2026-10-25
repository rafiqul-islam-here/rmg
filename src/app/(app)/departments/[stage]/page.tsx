import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { STAGE_KEYS, STAGE_LABEL } from "@/lib/stages";
import type { StageKey } from "@/lib/types";
import { DepartmentView } from "./department-view";
import Loading from "./loading";

type Props = { params: Promise<{ stage: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { stage } = await params;
  return { title: STAGE_LABEL[stage as StageKey] ?? "Department" };
}

/** One reusable workspace for every department — only the stage changes. */
export default async function DepartmentPage({ params }: Props) {
  const { stage } = await params;
  if (!(STAGE_KEYS as string[]).includes(stage)) notFound();
  return (
    <Suspense fallback={<Loading />}>
      <DepartmentView stage={stage as StageKey} />
    </Suspense>
  );
}
