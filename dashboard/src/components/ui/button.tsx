import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-white text-black hover:bg-white/90",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-white/25 bg-white/[0.05] text-white backdrop-blur-sm hover:border-white/50 hover:bg-white/[0.1]",
        secondary: "border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]",
        ghost: "text-white/70 hover:bg-white/[0.05] hover:text-white",
        link: "text-blue-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "px-7 py-3 text-sm",
        sm: "px-5 py-2 text-xs",
        lg: "px-8 py-3.5 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
