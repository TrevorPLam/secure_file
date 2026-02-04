// AI-META-BEGIN
// AI-META: File upload dialog - multi-file upload with progress tracking, presigned URL requests, and database persistence
// OWNERSHIP: client/components
// ENTRYPOINTS: Opened from dashboard page when user clicks upload button
// DEPENDENCIES: @tanstack/react-query (mutations), @/components/ui/* (dialog, progress), @/hooks/use-toast, @/lib/queryClient, lucide-react (icons)
// DANGER: Presigned URLs fetched per file from /api/uploads/request-url; XMLHttpRequest for upload progress tracking; files persisted to DB after successful upload
// CHANGE-SAFETY: Safe to adjust progress UI, unsafe to change upload flow or API contract without server coordination
// TESTS: Manual testing with multiple files, large files, and upload errors
// AI-META-END

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Upload, FileIcon, X, CheckCircle2, Loader2, Cloud } from "lucide-react";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string | null;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  objectPath?: string;
}

export function UploadDialog({ open, onOpenChange, folderId }: UploadDialogProps) {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const createFileMutation = useMutation({
    mutationFn: async (data: { name: string; size: number; mimeType: string; objectPath: string; folderId: string | null }) => {
      return await apiRequest("POST", "/api/files", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).map((file) => ({
      file,
      progress: 0,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...fileArray]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;

      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f))
      );

      try {
        const response = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: files[i].file.name,
            size: files[i].file.size,
            contentType: files[i].file.type || "application/octet-stream",
          }),
        });

        if (!response.ok) throw new Error("Failed to get upload URL");

        const { uploadURL, objectPath } = await response.json();

        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, progress: 30 } : f))
        );

        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: files[i].file,
          headers: {
            "Content-Type": files[i].file.type || "application/octet-stream",
          },
        });

        if (!uploadResponse.ok) throw new Error("Failed to upload file");

        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, progress: 70 } : f))
        );

        await createFileMutation.mutateAsync({
          name: files[i].file.name,
          size: files[i].file.size,
          mimeType: files[i].file.type || "application/octet-stream",
          objectPath,
          folderId,
        });

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, progress: 100, status: "done", objectPath } : f
          )
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "error" } : f))
        );
      }
    }
  };

  const handleClose = () => {
    const hasCompleted = files.some((f) => f.status === "done");
    if (hasCompleted) {
      toast({ title: "Files uploaded successfully" });
    }
    setFiles([]);
    onOpenChange(false);
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const isUploading = uploadingCount > 0;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Upload Files</DialogTitle>
              <DialogDescription>
                Drag and drop files or click to browse
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              onChange={handleInputChange}
              className="hidden"
              id="file-upload"
              data-testid="input-file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    Drop files here or{" "}
                    <span className="text-primary">browse</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Support for all file types up to 10MB
                  </p>
                </div>
              </div>
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((uploadFile, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <FileIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {uploadFile.file.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatBytes(uploadFile.file.size)}</span>
                      {uploadFile.status === "uploading" && (
                        <Progress value={uploadFile.progress} className="h-1 w-20" />
                      )}
                    </div>
                  </div>
                  {uploadFile.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeFile(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  {uploadFile.status === "uploading" && (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                  {uploadFile.status === "done" && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                  {uploadFile.status === "error" && (
                    <span className="text-xs text-destructive">Failed</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-upload">
            {doneCount > 0 ? "Done" : "Cancel"}
          </Button>
          {pendingCount > 0 && (
            <Button
              onClick={uploadFiles}
              disabled={isUploading}
              data-testid="button-start-upload"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {pendingCount} file{pendingCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
