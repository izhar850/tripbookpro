'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Download, 
  Loader2, 
  Paperclip,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { uploadTripFile, fetchTripFiles, deleteTripFile, type TripFile } from '@/firebase/storage/storage-service';
import { Progress } from '@/components/ui/progress';
import { normalizeVehicleNo } from '@/lib/transport-utils';
import { getSubscriptionBlockMessage, isSubscriptionActive } from '@/lib/account-utils';

interface TripFilesModalProps {
  trip: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FILE_TYPES = [
  { label: 'POD / Delivery Proof', value: 'POD' },
  { label: 'Signed LR Receipt', value: 'SignedLR' },
  { label: 'Unloading Photo', value: 'UnloadingPhoto' },
  { label: 'Invoice Copy', value: 'InvoiceCopy' },
  { label: 'Other Trip Document', value: 'Other' },
];

export function TripFilesModal({ trip, open, onOpenChange }: TripFilesModalProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [files, setFiles] = useState<TripFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('POD');
  const [notes, setNotes] = useState('');
  const subscriptionActive = isSubscriptionActive(profile);
  const subscriptionBlockMessage = getSubscriptionBlockMessage(profile);

  useEffect(() => {
    if (open && trip && profile) {
      loadFiles();
    }
  }, [open, trip, profile]);

  const loadFiles = async () => {
    if (!profile || !trip) return;
    setLoading(true);
    try {
      const data = await fetchTripFiles(profile.companyId, trip.id);
      setFiles(data);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load trip files.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 5MB.',
          variant: 'destructive',
        });
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!profile || !trip || !selectedFile) return;
    if (!subscriptionActive) {
      toast({
        title: 'Subscription Required',
        description: subscriptionBlockMessage || 'Subscription expired. Please contact admin to renew.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      await uploadTripFile({
        companyId: profile.companyId,
        userId: profile.uid,
        tripId: trip.id,
        lrNo: trip.lrNo,
        file: selectedFile,
        fileType,
        notes
      }, (p) => setProgress(p));

      toast({
        title: 'Success',
        description: 'File uploaded successfully.',
      });
      
      setSelectedFile(null);
      setNotes('');
      // Reset file input
      const fileInput = document.getElementById('trip-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      loadFiles();
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'An error occurred during upload.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: TripFile) => {
    if (!subscriptionActive) {
      toast({
        title: 'Subscription Required',
        description: subscriptionBlockMessage || 'Subscription expired. Please contact admin to renew.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await deleteTripFile(file);
      toast({
        title: 'Deleted',
        description: 'File removed successfully.',
      });
      loadFiles();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete file.',
        variant: 'destructive',
      });
    }
  };

  const getFileTypeLabel = (type: string) => {
    return FILE_TYPES.find(t => t.value === type)?.label || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline font-bold flex items-center gap-2">
            <Paperclip className="w-6 h-6 text-primary" /> Trip Documents / POD
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            LR No: <span className="font-bold text-foreground">{trip?.lrNo}</span> | 
            Vehicle: <span className="font-bold text-foreground">{normalizeVehicleNo(trip?.vehicleNo)}</span> | 
            Party: <span className="font-bold text-foreground">{trip?.partyName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Upload Section */}
          <div className="p-4 rounded-xl border border-border/50 bg-secondary/20 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload New Document
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fileType">File Type</Label>
                <Select value={fileType} onValueChange={setFileType}>
                  <SelectTrigger id="fileType" className="bg-background">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trip-file-input">Select File (Max 5MB)</Label>
                <Input 
                  id="trip-file-input" 
                  type="file" 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="bg-background cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input 
                id="notes" 
                placeholder="Reference number or description..." 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="bg-background"
              />
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>Uploading...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <Button 
              className="w-full bg-gradient-primary font-bold shadow-lg"
              disabled={!selectedFile || uploading || files.length >= 10 || !subscriptionActive}
              title={!subscriptionActive ? subscriptionBlockMessage : 'Upload Document'}
              onClick={handleUpload}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              {files.length >= 10 ? 'Maximum Limit Reached (10)' : 'Upload Document'}
            </Button>
            
            {files.length >= 10 && (
              <p className="text-[10px] text-destructive flex items-center gap-1 font-bold">
                <AlertCircle className="w-3 h-3" /> Max 10 files allowed per trip.
              </p>
            )}
          </div>

          {/* Files List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Uploaded Documents ({files.length})
            </h3>
            
            {loading ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : files.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center border border-dashed rounded-xl text-muted-foreground">
                <FileText className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file) => (
                      <TableRow key={file.id} className="hover:bg-secondary/30">
                        <TableCell>
                          <Badge variant={file.fileType === 'POD' ? 'default' : 'outline'} className="text-[10px]">
                            {getFileTypeLabel(file.fileType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate" title={file.fileName}>
                          {file.fileName}
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {file.uploadedAt?.toDate ? file.uploadedAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-500">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </a>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-destructive"
                              disabled={!subscriptionActive}
                              title={!subscriptionActive ? subscriptionBlockMessage : 'Delete'}
                              onClick={() => handleDelete(file)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
