import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Button — UI guideline §5.
 * 44px tall on touch (mobile/tablet), 40px on desktop. 6px radius, 14/600 text.
 * Only ONE `default` (blue) button per page.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover",
        secondary: "border border-border bg-surface text-ink hover:bg-background active:bg-secondary",
        outline: "border border-border bg-surface text-ink hover:bg-background active:bg-secondary",
        ghost: "text-ink hover:bg-secondary active:bg-secondary",
        /** Card-level actions (queue cards). Keeps solid blue for the page's main action. */
        soft: "bg-primary-soft text-primary hover:bg-primary/15 active:bg-primary/20",
        destructive: "bg-danger text-white hover:bg-danger/90",
        "danger-outline": "border border-danger/40 bg-surface text-st-blocked hover:bg-st-blocked-bg",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 xl:h-10",
        sm: "h-9 px-3 text-[13px]",
        lg: "h-12 px-5 text-base",
        icon: "size-11 xl:size-10",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner and keeps the label. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
