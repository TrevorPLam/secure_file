// AI-META-BEGIN
// AI-META: shadcn/ui textarea component - reusable UI primitive from shadcn component library
// OWNERSHIP: client/components/ui (shadcn/ui)
// ENTRYPOINTS: Imported by various pages and components throughout the application
// DEPENDENCIES: @radix-ui/* (headless UI primitives), class-variance-authority (styling variants), @/lib/utils (cn utility)
// DANGER: Radix UI components have accessibility requirements - maintain ARIA attributes; variant changes affect all consumers
// CHANGE-SAFETY: Safe to add new variants or style tweaks, unsafe to change component API or remove existing variants without auditing usage
// TESTS: Visual testing via Storybook or component usage, verify accessibility with screen readers
// AI-META-END

import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
