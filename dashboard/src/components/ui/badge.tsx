import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/[0.05] text-white/80",
        secondary: "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.05]",
        destructive: "border-red-500/20 bg-red-500/10 text-red-400",
        outline: "text-white/70 border-white/10",
        critical: "border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]",
        high: "border-orange-500/20 bg-orange-500/10 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]",
        medium: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]",
        low: "border-green-500/20 bg-green-500/10 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]",
        pass: "border-green-500/20 bg-green-500/10 text-green-400",
        fail: "border-red-500/20 bg-red-500/10 text-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
