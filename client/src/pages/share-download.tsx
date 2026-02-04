import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { apiRequest } from "@/lib/queryClient";
import {
  Cloud,
  Download,
  FileIcon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Lock,
  Loader2,
  AlertCircle,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";

interface ShareInfo {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  hasPassword: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  downloadCount: number;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("zip") || mimeType.includes("rar")) return FileArchive;
  return FileIcon;
};

const getFileColor = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400";
  if (mimeType.startsWith("video/")) return "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400";
  if (mimeType.startsWith("audio/")) return "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400";
  if (mimeType.includes("pdf")) return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400";
  return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export default function ShareDownloadPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [downloadStarted, setDownloadStarted] = useState(false);

  const { data: shareInfo, isLoading, error } = useQuery<ShareInfo>({
    queryKey: ["/api/shares/info", token],
    queryFn: async () => {
      const res = await fetch(`/api/shares/info/${token}`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    retry: false,
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/shares/${token}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Download failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setDownloadStarted(true);
      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  });

  const handleDownload = (e: React.FormEvent) => {
    e.preventDefault();
    downloadMutation.mutate();
  };

  const Icon = shareInfo ? getFileIcon(shareInfo.mimeType) : FileIcon;
  const colorClass = shareInfo ? getFileColor(shareInfo.mimeType) : "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Cloud className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">CloudVault</span>
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          {isLoading ? (
            <CardContent className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">Loading file info...</p>
            </CardContent>
          ) : error ? (
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="mb-2">Link Not Found</CardTitle>
              <CardDescription>
                This share link is invalid or has been deleted.
              </CardDescription>
            </CardContent>
          ) : shareInfo?.isExpired ? (
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="mb-2">Link Expired</CardTitle>
              <CardDescription>
                This share link has expired and is no longer available.
              </CardDescription>
            </CardContent>
          ) : shareInfo ? (
            <>
              <CardHeader className="text-center">
                <div className={`w-16 h-16 rounded-xl mx-auto flex items-center justify-center mb-4 ${colorClass}`}>
                  <Icon className="w-8 h-8" />
                </div>
                <CardTitle className="break-all">{shareInfo.fileName}</CardTitle>
                <CardDescription>
                  {formatBytes(shareInfo.fileSize)}
                  {shareInfo.expiresAt && (
                    <span className="block mt-1">
                      Expires {format(new Date(shareInfo.expiresAt), "MMM d, yyyy")}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {downloadStarted ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto flex items-center justify-center mb-3">
                      <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="font-medium">Download Started</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your file should begin downloading shortly.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setDownloadStarted(false);
                        downloadMutation.mutate();
                      }}
                    >
                      Download Again
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleDownload} className="space-y-4">
                    {shareInfo.hasPassword && (
                      <div className="space-y-2">
                        <Label htmlFor="password" className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          Password Required
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          data-testid="input-download-password"
                        />
                      </div>
                    )}
                    
                    {downloadMutation.error && (
                      <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                        {downloadMutation.error.message}
                      </div>
                    )}
                    
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={downloadMutation.isPending}
                      data-testid="button-download"
                    >
                      {downloadMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Preparing...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Download File
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
              <CardFooter className="justify-center">
                <p className="text-xs text-muted-foreground">
                  Downloaded {shareInfo.downloadCount} time{shareInfo.downloadCount !== 1 ? "s" : ""}
                </p>
              </CardFooter>
            </>
          ) : null}
        </Card>
      </main>

      <footer className="border-t py-4">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Shared via <a href="/" className="text-primary hover:underline">CloudVault</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
