"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowRight,
  Ban,
  Building,
  Clock,
  FilePlus2,
  Hash,
  ImagePlus,
  Layers,
  Palette,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Trash,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/tf/drawer";
import { PageHeader } from "@/components/tf/page";
import { useSession } from "@/components/tf/session";
import { EmptyState, ErrorState, Skel } from "@/components/tf/states";
import { api, ApiError } from "@/lib/api/client";
import { useBuyers, useRefreshAll } from "@/lib/api/hooks";
import { formatStamp } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import type { Buyer, Embellishment } from "@/lib/types";
import { cn } from "@/lib/utils";

/** a) Print, b) Embroidery, c) Print and Emb, d) None — "None" is selected initially. */
const EMB_OPTIONS: { value: Embellishment; label: string; icon: LucideIcon }[] = [
  { value: "print", label: "a) Print", icon: Printer },
  { value: "emb", label: "b) Embroidery", icon: Sparkles },
  { value: "print_emb", label: "c) Print and Emb", icon: Layers },
  { value: "none", label: "d) None", icon: Ban },
];

const MAX_IMAGE = 2 * 1024 * 1024;
const letter = (i: number) => String.fromCharCode(97 + i);

/**
 * New order entry — UI documentation §3. Opened from a buyer (Buyer management),
 * so the buyer is fixed on the form. After creating, the order waits in the Fabric tab.
 */
export function NewOrderForm() {
  const sp = useSearchParams();
  const buyers = useBuyers();
  const buyerId = sp.get("buyer");
  const buyer = buyers.data?.items.find((b) => b.id === buyerId);

  if (buyers.error) return <ErrorState error={buyers.error} title="Couldn't load buyers." onRetry={() => buyers.mutate()} />;
  if (buyers.isLoading && !buyers.data) return <Skel className="mx-auto h-[600px] max-w-3xl rounded-xl" />;
  if (!buyer) return <BuyerPicker buyers={buyers.data?.items ?? []} />;
  return <EntryForm key={buyer.id} buyer={buyer} />;
}

/** Step before the form: choose which buyer the order belongs to. */
function BuyerPicker({ buyers }: { buyers: Buyer[] }) {
  const user = useSession();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader icon={Building} title="Buyer management" subtitle="Choose the buyer for the new order." />
      {buyers.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={Building}
            title="No buyers yet."
            description="Add a buyer before entering orders."
            action={
              user.role === "admin" && (
                <Button asChild variant="secondary">
                  <Link href="/settings?tab=buyers">Add a buyer</Link>
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {buyers.map((b) => (
            <li key={b.id}>
              <Link
                href={`/orders/new?buyer=${b.id}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex h-11 min-w-12 items-center justify-center rounded-lg bg-primary px-2 text-sm font-bold text-white">{b.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{b.name}</span>
                  <span className="tabular block text-xs text-muted-foreground">
                    {b.orderCount ?? 0} {b.orderCount === 1 ? "order" : "orders"}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Errors = Partial<Record<"orderNumber" | "colors" | "image", string>>;

function EntryForm({ buyer }: { buyer: Buyer }) {
  const router = useRouter();
  const refresh = useRefreshAll();
  const now = useNow(1000);
  const fileRef = useRef<HTMLInputElement>(null);

  const [orderNumber, setOrderNumber] = useState("");
  const [colors, setColors] = useState<string[]>(["", ""]);
  const [embellishment, setEmbellishment] = useState<Embellishment>("none");
  const [comments, setComments] = useState("");
  const [image, setImage] = useState<string>();
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string>();

  function validate(field?: keyof Errors): Errors {
    const e: Errors = {};
    if (!orderNumber.trim()) e.orderNumber = "Enter the order number.";
    if (!colors.some((c) => c.trim())) e.colors = "At least one color option is required.";
    if (field) setErrors((prev) => ({ ...prev, [field]: e[field] }));
    else setErrors(e);
    return e;
  }

  function pickImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErrors((e) => ({ ...e, image: "Choose an image file (JPG, PNG or WebP)." }));
    if (file.size > MAX_IMAGE) return setErrors((e) => ({ ...e, image: "Image must be 2 MB or smaller." }));
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setErrors((e) => ({ ...e, image: undefined }));
    };
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const found = validate();
    if (found.orderNumber || found.colors) {
      document.getElementById(found.orderNumber ? "orderNumber" : "color-0")?.focus();
      return;
    }
    setBusy(true);
    try {
      const order = await api.createOrder({
        orderNumber: orderNumber.trim(),
        buyerId: buyer.id,
        colors: colors.map((c) => c.trim()).filter(Boolean),
        embellishment,
        comments: comments.trim() || undefined,
        imageUrl: image,
      });
      toast.success(`${order.orderNumber} created. It is now in the Fabric and PP Meeting tabs.`);
      await refresh();
      // §4: after creating, the order is in the Fabric tab.
      router.push(`/departments/fabric?highlight=${order.id}`);
    } catch (err) {
      // Keep everything the user typed.
      if (err instanceof ApiError && err.status === 409) setErrors((x) => ({ ...x, orderNumber: err.message }));
      else setFormError(err instanceof Error ? err.message : "Could not create the order.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl space-y-4 pb-24">
      {/* Buyer management header */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-navy px-4 py-4 text-white xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 min-w-12 items-center justify-center rounded-lg bg-primary px-2 text-sm font-bold">{buyer.code}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-white/60 uppercase">Buyer management</p>
            <p className="truncate text-lg font-semibold">
              Buyer: <span className="text-[#5FA8FF]">{buyer.name}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 sm:inline-flex">
            <ShieldCheck className="size-3.5 text-[#5FD39A]" aria-hidden /> Active session: authorized entry
          </span>
          <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
            <Link href="/orders/new">Change buyer</Link>
          </Button>
        </div>
      </header>

      {formError && <ErrorState error={new Error(formError)} title="Order not created." />}

      <section className="divide-y divide-border rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-background/60 px-4 py-4 xl:px-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <FilePlus2 className="size-5 text-primary" aria-hidden /> New Order Entry Form
          </h1>
          <span className="tabular inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[13px] text-muted-foreground">
            <Clock className="size-4" aria-hidden /> Created Time: <b className="font-semibold text-ink">{formatStamp(new Date(now).toISOString())}</b>
          </span>
        </div>

        {/* 1. Order number + buyer designation */}
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:p-6">
          <Field label="1. Order Number" required htmlFor="orderNumber" error={errors.orderNumber} helper="Enter unique internal or buyer reference number.">
            {(id) => (
              <div className="relative">
                <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id={id}
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  onBlur={() => validate("orderNumber")}
                  placeholder={`e.g. ${buyer.code}-2026-8891`}
                  aria-invalid={!!errors.orderNumber}
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            )}
          </Field>
          <Field label="Buyer Designation" helper="Pre-configured buyer account name.">
            {(id) => (
              <div className="relative">
                <Building className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id={id} value={buyer.name} readOnly className="bg-background pl-9 font-semibold" />
              </div>
            )}
          </Field>
        </div>

        {/* 2. Colors */}
        <div role="group" aria-labelledby="colors-label" className="grid gap-3 p-4 xl:p-6">
          <div className="flex items-center justify-between gap-3">
            <p id="colors-label" className="text-[13px] font-medium text-ink">
              2. Colors <span className="text-danger" aria-hidden>*</span>
            </p>
            <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={() => setColors((c) => [...c, ""])}>
              <Plus /> Add Color Option
            </Button>
          </div>
          <ol className="grid gap-2">
            {colors.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Palette className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id={`color-${i}`}
                    value={c}
                    onChange={(e) => setColors((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                    onBlur={() => validate("colors")}
                    placeholder={`${letter(i)}) Color ${i + 1} (e.g. ${i === 0 ? "Navy Blue" : i === 1 ? "Crimson Red" : "Olive Green"})`}
                    aria-label={`Color ${letter(i)}`}
                    aria-invalid={!!errors.colors && i === 0}
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setColors((list) => list.filter((_, j) => j !== i))}
                  disabled={colors.length === 1}
                  aria-label={`Remove color ${letter(i)}`}
                  title={colors.length === 1 ? "At least one color option is required" : "Remove color"}
                >
                  <Trash className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
          <p className={cn("text-xs", errors.colors ? "text-st-blocked" : "text-muted-foreground")} role={errors.colors ? "alert" : undefined}>
            {errors.colors ?? "At least one color option is required."}
          </p>
        </div>

        {/* 3. Embellishment */}
        <div className="grid gap-3 p-4 xl:p-6">
          <p id="emb-label" className="text-[13px] font-medium text-ink">
            3. Embellishment <span className="text-danger" aria-hidden>*</span>
          </p>
          <RadioGroup aria-labelledby="emb-label" value={embellishment} onValueChange={(v) => setEmbellishment(v as Embellishment)} className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {EMB_OPTIONS.map((o) => {
              const checked = embellishment === o.value;
              return (
                <label
                  key={o.value}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border bg-surface px-3 py-2 text-sm font-medium transition-colors",
                    checked ? "border-primary bg-primary-soft text-primary" : "border-border text-ink hover:border-primary/50",
                  )}
                >
                  <RadioGroupItem value={o.value} />
                  <o.icon className="size-4 shrink-0" aria-hidden />
                  {o.label}
                </label>
              );
            })}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            {embellishment === "none"
              ? "Cutting will send this order straight to Sewing."
              : embellishment === "print_emb"
                ? "Cutting will send to Print and Embroidery at the same time."
                : `Cutting will send this order to ${embellishment === "print" ? "Print" : "Embroidery"} first.`}
          </p>
        </div>

        {/* 4. Comments */}
        <div className="p-4 xl:p-6">
          <Field label="4. Comments / Special Instructions">
            {(id) => (
              <Textarea
                id={id}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                placeholder="Add any specific color hexes, size splits, artwork notes or delivery details…"
              />
            )}
          </Field>
        </div>

        {/* Card image (§4: "There will be an image in the card") */}
        <div className="grid gap-2 p-4 xl:p-6">
          <p className="text-[13px] font-medium text-ink">5. Order image (optional)</p>
          <div className="flex flex-wrap items-center gap-4">
            {image ? (
              <div className="relative">
                <Image src={image} alt="Order image preview" width={96} height={96} unoptimized className="size-24 rounded-lg border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setImage(undefined)}
                  className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full border border-border bg-surface shadow-sm hover:bg-muted"
                  aria-label="Remove image"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-xs text-muted-foreground hover:border-primary hover:text-primary"
              >
                <ImagePlus className="size-6" aria-hidden />
                Add image
              </button>
            )}
            <p className="text-xs text-muted-foreground">Shown on the order card in every tab. JPG, PNG or WebP, up to 2 MB.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
          {errors.image && (
            <p className="text-xs text-st-blocked" role="alert">
              {errors.image}
            </p>
          )}
        </div>
      </section>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 backdrop-blur md:sticky md:bottom-0 md:rounded-xl md:border">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-4 py-3">
          <Button asChild variant="ghost">
            <Link href="/orders">Cancel</Link>
          </Button>
          <Button type="submit" loading={busy}>
            Create order
          </Button>
        </div>
      </div>
    </form>
  );
}
