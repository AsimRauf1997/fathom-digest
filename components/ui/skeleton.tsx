import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "mb-2.5 h-[11px] rounded-[3px] bg-[linear-gradient(90deg,var(--rule)_0%,var(--paper-2)_50%,var(--rule)_100%)] bg-[length:200%_100%] [animation:shimmer_1.4s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
