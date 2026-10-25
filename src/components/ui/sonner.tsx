"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useMediaQuery } from "@/hooks/use-media-query"

/** Toasts — bottom-right on desktop, top on mobile; 4s auto-hide (UI guideline §5). */
const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = useMediaQuery("(max-width: 767px)")

  return (
    <Sonner
      theme="light"
      position={isMobile ? "top-center" : "bottom-right"}
      duration={4000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-primary" />,
        warning: <TriangleAlertIcon className="size-4 text-st-hold" />,
        error: <OctagonXIcon className="size-4 text-danger" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--border)",
          "--border-radius": "8px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
