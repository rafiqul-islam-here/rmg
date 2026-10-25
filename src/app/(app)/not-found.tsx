import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <SearchX className="size-12 text-muted-foreground/70" strokeWidth={1.5} aria-hidden />
      <p className="text-base font-semibold text-ink">We couldn&apos;t find that page.</p>
      <Button asChild variant="secondary">
        <Link href="/">Go to home</Link>
      </Button>
    </div>
  );
}
