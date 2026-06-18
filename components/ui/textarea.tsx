import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-[84px] w-full resize-y rounded-[var(--radius-sm)] border border-input bg-[var(--paper-3)] px-3.5 py-2.5 font-sans text-[14px] leading-[1.55] text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent-wash disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
