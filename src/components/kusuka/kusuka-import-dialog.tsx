'use client';

import { useState, useCallback } from 'react';
import { Upload, CreditCard, Lock, CheckCircle2, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface KusukaImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KusukaImportDialog({ open, onOpenChange }: KusukaImportDialogProps) {
  const [password, setPassword] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    count: number;
    deletedCount: number;
    skippedCount?: number;
    skippedReasons?: string[];
  } | null>(null);
  const [replaceAll, setReplaceAll] = useState(true);

  const resetState = useCallback(() => {
    setPassword('');
    setIsVerified(false);
    setFile(null);
    setImportResult(null);
    setReplaceAll(true);
  }, []);

  const handleVerifyPassword = async () => {
    if (!password.trim()) {
      toast.error('Masukkan sandi terlebih dahulu');
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, type: 'admin' }),
      });
      const data = await res.json();
      if (data.valid) {
        setIsVerified(true);
        toast.success('Sandi benar');
      } else {
        toast.error('Sandi salah');
      }
    } catch {
      toast.error('Gagal memverifikasi sandi');
    } finally {
      setVerifying(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isVerified) {
      toast.error('Verifikasi sandi terlebih dahulu');
      return;
    }
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error('Hanya file Excel (.xlsx, .xls) yang didukung');
        return;
      }
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('password', password);
      formData.append('file', file);
      formData.append('replaceAll', String(replaceAll));

      const res = await fetch('/api/kusuka/import', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();

      if (res.ok) {
        setImportResult({
          success: true,
          count: result.count,
          deletedCount: result.deletedCount || 0,
          skippedCount: result.skippedCount || 0,
          skippedReasons: result.skippedReasons || [],
        });
        const skippedInfo = result.skippedCount > 0 ? ` (${result.skippedCount} dilewati)` : '';
        if (replaceAll && result.deletedCount > 0) {
          toast.success(`Berhasil! ${result.deletedCount} data lama dihapus, ${result.count} data baru diimpor${skippedInfo}`);
        } else {
          toast.success(`Berhasil mengimpor ${result.count} data KUSUKA${skippedInfo}`);
        }
      } else {
        toast.error(result.error || 'Gagal mengimpor data KUSUKA');
      }
    } catch {
      toast.error('Gagal mengimpor data. Coba lagi dalam beberapa detik.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-teal-600" />
            Import Data KUSUKA
          </DialogTitle>
          <DialogDescription>
            Import data registrasi KUSUKA perorangan dari file Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Step 1: Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              1. Verifikasi Sandi
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Masukkan sandi admin..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                disabled={isVerified}
                className="text-sm"
              />
              <Button
                onClick={handleVerifyPassword}
                disabled={isVerified || verifying}
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 shrink-0"
              >
                {isVerified ? 'Terverifikasi' : verifying ? 'Memverifikasi...' : 'Verifikasi'}
              </Button>
            </div>
            {isVerified && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Sandi telah diverifikasi
              </p>
            )}
          </div>

          {/* Step 2: File upload */}
          {isVerified && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" />
                2. Upload File Excel KUSUKA
              </label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center transition-colors border-muted hover:border-teal-400 cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="kusuka-excel-upload"
                />
                <label htmlFor="kusuka-excel-upload" className="cursor-pointer block">
                  <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {file ? file.name : 'Klik untuk pilih file Excel KUSUKA'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Kolom: NAMA, KECAMATAN, KEL/DESA, NO KUSUKA, dst.
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Replace mode */}
          {file && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <Checkbox
                id="kusuka-replace-all"
                checked={replaceAll}
                onCheckedChange={(checked) => setReplaceAll(!!checked)}
                className="h-4 w-4"
              />
              <label htmlFor="kusuka-replace-all" className="text-sm cursor-pointer">
                <span className="font-medium">Ganti semua data</span>
                <span className="text-xs text-muted-foreground block mt-0.5">
                  {replaceAll
                    ? 'Semua data KUSUKA lama akan dihapus dan diganti data baru'
                    : 'Data baru akan ditambahkan ke data yang sudah ada'}
                </span>
              </label>
            </div>
          )}

          {/* Import progress */}
          {importing && (
            <div className="space-y-2 p-4 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                <span className="text-sm font-medium text-teal-700 dark:text-teal-400">
                  Mengimpor data KUSUKA...
                </span>
              </div>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">
                  Berhasil mengimpor {importResult.count} data KUSUKA
                </span>
              </div>
              {importResult.deletedCount > 0 && (
                <p className="text-xs text-emerald-600/70 ml-6">
                  {importResult.deletedCount} data lama dihapus
                </p>
              )}
              {importResult.skippedCount && importResult.skippedCount > 0 && (
                <p className="text-xs text-amber-600 ml-6">
                  {importResult.skippedCount} baris dilewati (data tidak valid)
                </p>
              )}
            </div>
          )}

          {/* Import button */}
          {file && !importResult && !importing && (
            <Button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {replaceAll
                ? `Ganti Semua & Import Data KUSUKA`
                : `Tambah Data KUSUKA`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
