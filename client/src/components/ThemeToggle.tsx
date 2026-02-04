// AI-META-BEGIN
// AI-META: Theme toggle button - switches between light and dark mode with icon
// OWNERSHIP: client/components
// ENTRYPOINTS: Rendered in navigation bars across landing page, dashboard, and share pages
// DEPENDENCIES: lucide-react (icons), @/components/ui/button, ./ThemeProvider (useTheme hook)
// DANGER: None - stateless UI component
// CHANGE-SAFETY: Safe to modify icon or button styling
// TESTS: Manual testing with theme toggle interaction
// AI-META-END

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  );
}
