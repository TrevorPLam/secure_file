// AI-META-BEGIN
// AI-META: Main dashboard - authenticated file/folder browser with upload, create folder, search, and user menu
// OWNERSHIP: client/pages
// ENTRYPOINTS: Rendered by App.tsx on "/dashboard" route for authenticated users
// DEPENDENCIES: @tanstack/react-query (data fetching), wouter (routing), @/hooks/use-auth (auth state), @/components/* (FileList, FolderBreadcrumb, dialogs), @shared/schema (types)
// DANGER: User state fetched from /api/auth/user - logout deletes all user data permanently; folder navigation via query params
// CHANGE-SAFETY: Safe to add new UI features, unsafe to change query keys or mutation logic without auditing cache invalidation
// TESTS: Manual testing with authenticated session, verify CRUD operations on files/folders
// AI-META-END

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FileList } from "@/components/FileList";
import { FolderBreadcrumb } from "@/components/FolderBreadcrumb";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { UploadDialog } from "@/components/UploadDialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Folder, File } from "@shared/schema";
import { 
  Cloud, 
  FolderPlus, 
  Upload, 
  Search, 
  MoreHorizontal,
  LogOut,
  Settings,
  HardDrive,
  FolderOpen,
  FileIcon,
  ChevronRight
} from "lucide-react";

export default function DashboardPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: folders = [], isLoading: foldersLoading } = useQuery<Folder[]>({
    queryKey: ["/api/folders", { parentId: currentFolderId }],
    queryFn: async () => {
      const url = currentFolderId 
        ? `/api/folders?parentId=${currentFolderId}` 
        : "/api/folders";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<File[]>({
    queryKey: ["/api/files", { folderId: currentFolderId }],
    queryFn: async () => {
      const url = currentFolderId 
        ? `/api/files?folderId=${currentFolderId}` 
        : "/api/files";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  const { data: folderPath = [] } = useQuery<Folder[]>({
    queryKey: ["/api/folders/path", currentFolderId],
    queryFn: async () => {
      const res = await fetch(`/api/folders/path/${currentFolderId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!currentFolderId,
  });

  const { data: stats } = useQuery<{ totalFiles: number; totalFolders: number; totalSize: number }>({
    queryKey: ["/api/stats"],
  });

  const filteredFolders = folders.filter(folder => 
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = foldersLoading || filesLoading;

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId);
    setSearchQuery("");
  };

  const handleNavigateUp = () => {
    if (folderPath.length > 1) {
      setCurrentFolderId(folderPath[folderPath.length - 2].id);
    } else {
      setCurrentFolderId(null);
    }
  };

  const handleBreadcrumbClick = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearchQuery("");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center animate-pulse">
            <Cloud className="w-7 h-7 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Cloud className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg hidden sm:inline">CloudVault</span>
          </div>

          <div className="flex-1 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search files and folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50"
                data-testid="input-search"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2 pr-3" data-testid="button-user-menu">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                    <AvatarFallback className="text-xs">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium">
                    {user?.firstName || "User"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/api/logout" className="flex items-center gap-2" data-testid="button-logout">
                    <LogOut className="w-4 h-4" />
                    <span>Log out</span>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:flex w-64 flex-col border-r bg-sidebar min-h-[calc(100vh-4rem)]">
          <div className="p-4 space-y-4">
            <Button 
              className="w-full gap-2" 
              onClick={() => setShowUpload(true)}
              data-testid="button-upload-sidebar"
            >
              <Upload className="w-4 h-4" />
              Upload Files
            </Button>
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => setShowCreateFolder(true)}
              data-testid="button-new-folder-sidebar"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </Button>
          </div>

          <nav className="flex-1 px-2">
            <div className="space-y-1">
              <Button
                variant={currentFolderId === null ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => setCurrentFolderId(null)}
                data-testid="button-all-files"
              >
                <HardDrive className="w-4 h-4" />
                All Files
              </Button>
            </div>
          </nav>

          <div className="p-4 border-t">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-medium">{formatBytes(stats?.totalSize || 0)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 text-primary">
                    <FileIcon className="w-4 h-4" />
                    <span className="font-semibold">{stats?.totalFiles || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Files</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 text-primary">
                    <FolderOpen className="w-4 h-4" />
                    <span className="font-semibold">{stats?.totalFolders || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Folders</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <FolderBreadcrumb 
                path={folderPath}
                currentFolderId={currentFolderId}
                onNavigate={handleBreadcrumbClick}
              />
              <div className="flex items-center gap-2 lg:hidden">
                <Button 
                  size="sm"
                  onClick={() => setShowUpload(true)}
                  data-testid="button-upload-mobile"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowCreateFolder(true)}
                  data-testid="button-new-folder-mobile"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  New Folder
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-12 w-12 rounded-lg mb-3" />
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    {currentFolderId ? (
                      <FolderOpen className="w-8 h-8 text-muted-foreground" />
                    ) : (
                      <Cloud className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    {searchQuery ? "No results found" : "No files yet"}
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    {searchQuery 
                      ? "Try a different search term"
                      : "Upload files or create folders to get started"}
                  </p>
                  {!searchQuery && (
                    <div className="flex items-center justify-center gap-3">
                      <Button onClick={() => setShowUpload(true)} data-testid="button-upload-empty">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Files
                      </Button>
                      <Button variant="outline" onClick={() => setShowCreateFolder(true)} data-testid="button-new-folder-empty">
                        <FolderPlus className="w-4 h-4 mr-2" />
                        New Folder
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <FileList
                folders={filteredFolders}
                files={filteredFiles}
                onFolderClick={handleFolderClick}
                currentFolderId={currentFolderId}
              />
            )}
          </div>
        </main>
      </div>

      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        parentFolderId={currentFolderId}
      />

      <UploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        folderId={currentFolderId}
      />
    </div>
  );
}
