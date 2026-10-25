import Image from "next/image";
import { Shirt } from "lucide-react";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Rough swatch for common color names, used when an order has no photo. */
const SWATCH: Record<string, string> = {
  navy: "#1F2F56", black: "#1F2328", white: "#F4F4F2", red: "#B42323", khaki: "#B59B6A",
  grey: "#8C929B", gray: "#8C929B", charcoal: "#3B3F45", olive: "#5E6B4E", green: "#3F7D58",
  blue: "#2F5DA8", azul: "#2F5DA8", ivory: "#EFE9DA", sand: "#D6C29C", mint: "#A8DCC4",
  coral: "#E67F6A", lime: "#B7D24A", burgundy: "#6E1F2E", pink: "#F2B8C6", lemon: "#F3E27A",
  peach: "#F5C1A0", sky: "#8DC3EA", verde: "#3F7D58", snow: "#F4F4F2", brown: "#6B4A33",
};

function swatchFor(color: string | undefined) {
  if (!color) return "#CBD5E1";
  const key = Object.keys(SWATCH).find((k) => color.toLowerCase().includes(k));
  return key ? SWATCH[key] : "#CBD5E1";
}

export function OrderThumb({
  order,
  size = 56,
  className,
}: {
  order: Pick<Order, "imageUrl" | "colors" | "orderNumber">;
  size?: number;
  className?: string;
}) {
  if (order.imageUrl) {
    return (
      <Image
        src={order.imageUrl}
        alt={`${order.orderNumber} product photo`}
        width={size}
        height={size}
        unoptimized
        className={cn("shrink-0 rounded-lg border border-border bg-background object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const bg = swatchFor(order.colors[0]);
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-lg border border-border bg-background", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Shirt className="size-1/2" style={{ color: bg }} strokeWidth={1.75} fill={bg} fillOpacity={0.25} />
    </div>
  );
}
