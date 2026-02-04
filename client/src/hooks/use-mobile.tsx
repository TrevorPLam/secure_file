// AI-META-BEGIN
// AI-META: Mobile detection hook - responsive breakpoint detection via matchMedia
// OWNERSHIP: client/hooks
// ENTRYPOINTS: Used by responsive components to adapt layout for mobile devices
// DEPENDENCIES: React (useState, useEffect), window.matchMedia
// DANGER: 768px breakpoint hardcoded - must match Tailwind md breakpoint; listener cleanup prevents memory leaks
// CHANGE-SAFETY: Safe to adjust breakpoint value, unsafe to change hook API without updating consumers
// TESTS: Manual testing with browser DevTools responsive mode
// AI-META-END

import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
