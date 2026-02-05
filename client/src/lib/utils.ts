// AI-META-BEGIN
// AI-META: Utility functions - cn() helper for merging Tailwind classes with conflict resolution
// OWNERSHIP: client/lib
// ENTRYPOINTS: Used throughout components for conditional styling
// DEPENDENCIES: clsx (class concatenation), tailwind-merge (Tailwind conflict resolution)
// DANGER: None - pure utility function
// CHANGE-SAFETY: Safe to add new utilities
// TESTS: Unit tests for class merging logic
// AI-META-END

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
