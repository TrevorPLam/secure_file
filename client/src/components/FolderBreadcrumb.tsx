// AI-META-BEGIN
// AI-META: Folder breadcrumb navigation - displays folder path from root to current with clickable navigation
// OWNERSHIP: client/components
// ENTRYPOINTS: Rendered by dashboard page above file list
// DEPENDENCIES: @/components/ui/button, lucide-react (icons), @shared/schema (Folder type)
// DANGER: Navigation callback triggers query param updates and data refetch
// CHANGE-SAFETY: Safe to modify styling and truncation behavior
// TESTS: Manual testing with nested folder navigation
// AI-META-END

import { Button } from "@/components/ui/button";
import { ChevronRight, Home } from "lucide-react";
import type { Folder } from "@shared/schema";

interface FolderBreadcrumbProps {
  path: Folder[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}

export function FolderBreadcrumb({ path, currentFolderId, onNavigate }: FolderBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm flex-wrap" aria-label="Breadcrumb">
      <Button
        variant={currentFolderId === null ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onNavigate(null)}
        className="gap-1.5"
        data-testid="breadcrumb-root"
      >
        <Home className="w-4 h-4" />
        <span>My Files</span>
      </Button>
      
      {path.map((folder, index) => (
        <div key={folder.id} className="flex items-center">
          <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
          <Button
            variant={index === path.length - 1 ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onNavigate(folder.id)}
            className="max-w-[150px]"
            data-testid={`breadcrumb-${folder.id}`}
          >
            <span className="truncate">{folder.name}</span>
          </Button>
        </div>
      ))}
    </nav>
  );
}
