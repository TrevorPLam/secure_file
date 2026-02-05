// AI-META-BEGIN
// AI-META: shadcn/ui tooltip component - reusable UI primitive from shadcn component library
// OWNERSHIP: client/components/ui (shadcn/ui)
// ENTRYPOINTS: Imported by various pages and components throughout the application
// DEPENDENCIES: @radix-ui/* (headless UI primitives), class-variance-authority (styling variants), @/lib/utils (cn utility)
// DANGER: Radix UI components have accessibility requirements - maintain ARIA attributes; variant changes affect all consumers
// CHANGE-SAFETY: Safe to add new variants or style tweaks, unsafe to change component API or remove existing variants without auditing usage
// TESTS: Visual testing via Storybook or component usage, verify accessibility with screen readers
// AI-META-END

'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]',
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
