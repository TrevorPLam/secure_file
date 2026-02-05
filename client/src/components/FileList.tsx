// AI-META-BEGIN
// AI-META: File and folder list display - grid view with file type icons, actions menu (download, share, delete), and empty states
// OWNERSHIP: client/components
// ENTRYPOINTS: Rendered by dashboard page to display current folder contents
// DEPENDENCIES: @tanstack/react-query (mutations), @/components/ui/* (cards, buttons, dialogs), @/hooks/use-toast, @/lib/queryClient, @shared/schema (types), lucide-react (file type icons)
// DANGER: Delete operations are permanent and cascade to children; download triggers presigned URL generation; share opens modal
// CHANGE-SAFETY: Safe to add new file type icons or action menu items, unsafe to change delete behavior or query invalidation without testing
// TESTS: Manual testing with various file types, test delete confirmations and share flows
// AI-META-END

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ShareDialog } from '@/components/ShareDialog'
import { useToast } from '@/hooks/use-toast'
import { queryClient, apiRequest } from '@/lib/queryClient'
import type { Folder, File } from '@shared/schema'
import {
  FolderOpen,
  FileIcon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  Presentation,
  MoreHorizontal,
  Download,
  Share2,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { format } from 'date-fns'

interface FileListProps {
  folders: Folder[]
  files: File[]
  onFolderClick: (folderId: string) => void
  currentFolderId: string | null
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.startsWith('video/')) return FileVideo
  if (mimeType.startsWith('audio/')) return FileAudio
  if (mimeType.includes('pdf')) return FileText
  if (
    mimeType.includes('zip') ||
    mimeType.includes('rar') ||
    mimeType.includes('tar') ||
    mimeType.includes('gzip')
  )
    return FileArchive
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return FileSpreadsheet
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return Presentation
  return FileIcon
}

const getFileColor = (mimeType: string) => {
  if (mimeType.startsWith('image/'))
    return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
  if (mimeType.startsWith('video/'))
    return 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
  if (mimeType.startsWith('audio/'))
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
  if (mimeType.includes('pdf'))
    return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
  if (mimeType.includes('zip') || mimeType.includes('rar'))
    return 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function FileList({ folders, files, onFolderClick, currentFolderId }: FileListProps) {
  const { toast } = useToast()
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'file' | 'folder'
    id: string
    name: string
  } | null>(null)
  const [shareFile, setShareFile] = useState<File | null>(null)

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      await apiRequest('DELETE', `/api/folders/${folderId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] })
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] })
      toast({ title: 'Folder deleted' })
    },
    onError: () => {
      toast({ title: 'Failed to delete folder', variant: 'destructive' })
    },
  })

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest('DELETE', `/api/files/${fileId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] })
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] })
      toast({ title: 'File deleted' })
    },
    onError: () => {
      toast({ title: 'Failed to delete file', variant: 'destructive' })
    },
  })

  const handleDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'folder') {
      deleteFolderMutation.mutate(deleteTarget.id)
    } else {
      deleteFileMutation.mutate(deleteTarget.id)
    }
    setDeleteTarget(null)
  }

  const handleDownload = (file: File) => {
    const link = document.createElement('a')
    link.href = file.objectPath
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <div className='space-y-6'>
        {folders.length > 0 && (
          <div>
            <h3 className='text-sm font-medium text-muted-foreground mb-3'>Folders</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'>
              {folders.map(folder => (
                <Card
                  key={folder.id}
                  className='group cursor-pointer hover-elevate transition-all'
                  onClick={() => onFolderClick(folder.id)}
                  data-testid={`folder-${folder.id}`}
                >
                  <CardContent className='p-4'>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex items-center gap-3 min-w-0 flex-1'>
                        <div className='w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0'>
                          <FolderOpen className='w-5 h-5 text-primary' />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <p className='font-medium truncate'>{folder.name}</p>
                          <p className='text-xs text-muted-foreground'>
                            {folder.createdAt
                              ? format(new Date(folder.createdAt), 'MMM d, yyyy')
                              : '—'}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity'
                            data-testid={`button-folder-menu-${folder.id}`}
                          >
                            <MoreHorizontal className='w-4 h-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={e => {
                              e.stopPropagation()
                              onFolderClick(folder.id)
                            }}
                          >
                            <ExternalLink className='w-4 h-4 mr-2' />
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className='text-destructive'
                            onClick={e => {
                              e.stopPropagation()
                              setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name })
                            }}
                          >
                            <Trash2 className='w-4 h-4 mr-2' />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div>
            <h3 className='text-sm font-medium text-muted-foreground mb-3'>Files</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'>
              {files.map(file => {
                const Icon = getFileIcon(file.mimeType)
                const colorClass = getFileColor(file.mimeType)

                return (
                  <Card
                    key={file.id}
                    className='group hover-elevate transition-all'
                    data-testid={`file-${file.id}`}
                  >
                    <CardContent className='p-4'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='flex items-center gap-3 min-w-0 flex-1'>
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}
                          >
                            <Icon className='w-5 h-5' />
                          </div>
                          <div className='min-w-0 flex-1'>
                            <p className='font-medium truncate' title={file.name}>
                              {file.name}
                            </p>
                            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                              <span>{formatBytes(file.size)}</span>
                              <span>•</span>
                              <span>
                                {file.createdAt ? format(new Date(file.createdAt), 'MMM d') : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity'
                              data-testid={`button-file-menu-${file.id}`}
                            >
                              <MoreHorizontal className='w-4 h-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem onClick={() => handleDownload(file)}>
                              <Download className='w-4 h-4 mr-2' />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShareFile(file)}>
                              <Share2 className='w-4 h-4 mr-2' />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className='text-destructive'
                              onClick={() =>
                                setDeleteTarget({ type: 'file', id: file.id, name: file.name })
                              }
                            >
                              <Trash2 className='w-4 h-4 mr-2' />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
              {deleteTarget?.type === 'folder' &&
                ' All files and subfolders inside will also be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid='button-cancel-delete'>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              data-testid='button-confirm-delete'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareDialog
        file={shareFile}
        open={!!shareFile}
        onOpenChange={open => !open && setShareFile(null)}
      />
    </>
  )
}
