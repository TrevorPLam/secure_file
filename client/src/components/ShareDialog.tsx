// AI-META-BEGIN
// AI-META: Share link management dialog - create, view, copy, and delete share links with password and expiration options
// OWNERSHIP: client/components
// ENTRYPOINTS: Opened from FileList component when user clicks share action on a file
// DEPENDENCIES: @tanstack/react-query (data fetching/mutations), @/components/ui/* (dialog, form controls), @/hooks/use-toast, @/lib/queryClient, @shared/schema (types), lucide-react (icons)
// DANGER: Share links are permanent URLs with optional password/expiry; copy to clipboard requires user interaction; delete is immediate
// CHANGE-SAFETY: Safe to add new sharing options, unsafe to change token format or share URL structure without server coordination
// TESTS: Manual testing with password-protected and time-limited shares, verify copy functionality
// AI-META-END

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { File, ShareLink } from "@shared/schema";
import { 
  Share2, 
  Link2, 
  Copy, 
  Check, 
  Lock, 
  Calendar, 
  Loader2,
  Trash2,
  ExternalLink,
  Download
} from "lucide-react";
import { format } from "date-fns";

interface ShareDialogProps {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ file, open, onOpenChange }: ShareDialogProps) {
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [useExpiry, setUseExpiry] = useState(false);
  const [expiryDays, setExpiryDays] = useState("7");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: existingLinks = [], isLoading } = useQuery<ShareLink[]>({
    queryKey: ["/api/files", file?.id, "shares"],
    queryFn: async () => {
      const res = await fetch(`/api/files/${file?.id}/shares`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!file,
  });

  const createShareMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      
      const data: any = { fileId: file.id };
      if (usePassword && password.trim()) {
        data.password = password;
      }
      if (useExpiry && expiryDays) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + parseInt(expiryDays));
        data.expiresAt = expiry.toISOString();
      }
      
      return await apiRequest("POST", "/api/shares", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files", file?.id, "shares"] });
      toast({ title: "Share link created" });
      setPassword("");
      setUsePassword(false);
      setUseExpiry(false);
    },
    onError: () => {
      toast({ title: "Failed to create share link", variant: "destructive" });
    },
  });

  const deleteShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      await apiRequest("DELETE", `/api/shares/${shareId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files", file?.id, "shares"] });
      toast({ title: "Share link deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete share link", variant: "destructive" });
    },
  });

  const getShareUrl = (token: string) => {
    return `${window.location.origin}/share/${token}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!open) {
      setPassword("");
      setUsePassword(false);
      setUseExpiry(false);
      setCopied(false);
    }
  }, [open]);

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Share File</DialogTitle>
              <DialogDescription className="truncate max-w-[300px]">
                {file.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Create new share link</h4>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="use-password">Password protection</Label>
              </div>
              <Switch
                id="use-password"
                checked={usePassword}
                onCheckedChange={setUsePassword}
                data-testid="switch-password"
              />
            </div>
            
            {usePassword && (
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-share-password"
              />
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="use-expiry">Link expiration</Label>
              </div>
              <Switch
                id="use-expiry"
                checked={useExpiry}
                onCheckedChange={setUseExpiry}
                data-testid="switch-expiry"
              />
            </div>
            
            {useExpiry && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="w-20"
                  data-testid="input-expiry-days"
                />
                <span className="text-sm text-muted-foreground">days from now</span>
              </div>
            )}

            <Button
              onClick={() => createShareMutation.mutate()}
              disabled={createShareMutation.isPending}
              className="w-full"
              data-testid="button-create-share"
            >
              {createShareMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Create Share Link
            </Button>
          </div>

          {existingLinks.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Active share links</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {existingLinks.map((link) => {
                    const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                    
                    return (
                      <div
                        key={link.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-background px-2 py-1 rounded truncate max-w-[200px]">
                              {getShareUrl(link.token)}
                            </code>
                            {link.password && (
                              <Badge variant="secondary" className="text-xs">
                                <Lock className="w-3 h-3 mr-1" />
                                Protected
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>
                              <Download className="w-3 h-3 inline mr-1" />
                              {link.downloadCount} downloads
                            </span>
                            {link.expiresAt && (
                              <span className={isExpired ? "text-destructive" : ""}>
                                {isExpired ? "Expired" : `Expires ${format(new Date(link.expiresAt), "MMM d")}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyToClipboard(getShareUrl(link.token))}
                            data-testid={`button-copy-${link.id}`}
                          >
                            {copied ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(getShareUrl(link.token), "_blank")}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteShareMutation.mutate(link.id)}
                            data-testid={`button-delete-share-${link.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-share">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
