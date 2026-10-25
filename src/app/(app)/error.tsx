"use client";

import { ErrorState } from "@/components/tf/states";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState error={error} title="This page could not be shown." onRetry={reset} />;
}
