'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, Lock, CheckCircle2, Eye, Trash2, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PreviewRow {
  year: number;
  kecamatan: string;
  desa: string;
  fishType: string;
  containerType: string;
  businessType: string;
  farmerName: string;
  groupName: string;
  productionQty: number;
  rtpCount: number;
  farmerCount: number;
  groupCount: number;
  targetQty: number;
  productionValue: number;
  latitude: number;
  longitude: number;
  kusuka: string | number;
  cpib: boolean;
  cbib: boolean;
}

const REQUIRED_HEADERS = [
  'year', 'kecamatan', 'desa', 'fishType', 'containerType', 'businessType',
  'farmerName', 'groupName',
  'productionQty', 'rtpCount', 'farmerCount', 'groupCount', 'targetQty',
  'productionValue', 'latitude', 'longitude',
];

const OPTIONAL_HEADERS = ['kusuka', 'cpib', 'cbib'];

// Normalize container type names from Excel to match system constants
const CONTAINER_TYPE_ALIASES: Record<string, string> = {
  'kja': 'KJA',
  'kjt': 'KJT',
  'kolam': 'Kolam',
  'kolam air tenang': 'Kolam Air Tenang',
  'kolam terpal': 'Kolam Terpal',
  'bak semen': 'Bak Semen',
  'bak terpal': 'Bak Terpal',
  'tambak': 'Tambak',
  'bioflok': 'Bioflok',
  'bioflock': 'Bioflok',
  'jaring tancap': 'KJA',
  'keramba': 'KJA',
  'sawah': 'Sawah',
};

function normalizeContainerType(value: string): string {
  const lower = value.toLowerCase().trim();
  return CONTAINER_TYPE_ALIASES[lower] || value.trim();
}

function normalizeKusuka(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER) {
      return String(value);
    }
    return String(value).replace(/[^0-9]/g, '');
  }
  
  let str = String(value).trim();
  if (/^\d{16}$/.test(str)) return str;
  
  if (/\d+\.?\d*[eE][+\-]?\d+/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      return num.toFixed(0);
    }
  }
  
  return str.replace(/[^0-9]/g, '');
}

// Chunk size for sending import data (smaller = more stable but slower)
const CHUNK_SIZE = 10;

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ success: boolean; count: number; deletedCount: number; skippedCount?: number; skippedReasons?: string[]; autoFilledInfo?: string[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [replaceAll, setReplaceAll] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const resetState = useCallback(() => {
    setPassword('');
    setIsVerified(false);
    setFile(null);
    setPreviewData([]);
    setImportResult(null);
    setReplaceAll(true);
    setImportProgress({ current: 0, total: 0 });
  }, []);

  const refreshAllData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['fish-farms'] });
    queryClient.invalidateQueries({ queryKey: ['fish-farms-stats'] });
    queryClient.invalidateQueries({ queryKey: ['fish-farms-all'] });
    queryClient.invalidateQueries({ queryKey: ['fish-farms-years'] });
  }, [queryClient]);

  const handleVerifyPassword = async () => {
    if (!password.trim()) {
      toast.error('Masukkan password terlebih dahulu');
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.valid) {
        setIsVerified(true);
        toast.success('Password benar');
      } else {
        toast.error('Password salah');
      }
    } catch {
      toast.error('Gagal memverifikasi password');
    } finally {
      setVerifying(false);
    }
  };

  const parseExcelFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = e.target?.result;
        if (!result) return;
        // Dynamic import to avoid bundling xlsx in SSR (crashes on Vercel)
        const XLSX = await import('xlsx');
        const wb = XLSX.read(result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        // Fix KUSUKA column
        if (jsonData.length > 0 && Object.keys(jsonData[0]).includes('kusuka')) {
          const headerRow: Record<string, number> = {};
          const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
          for (let c = range.s.c; c <= range.e.c; c++) {
            const headerCell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
            if (headerCell && String(headerCell.v).trim().toLowerCase() === 'kusuka') {
              headerRow.kusukaCol = c;
              break;
            }
          }
          if (headerRow.kusukaCol !== undefined) {
            const kusukaValues: string[] = [];
            for (let r = range.s.r + 1; r <= range.e.r; r++) {
              const cell = ws[XLSX.utils.encode_cell({ r, c: headerRow.kusukaCol })];
              if (cell) {
                const text = cell.w || String(cell.v || '');
                kusukaValues.push(text.replace(/[^0-9]/g, ''));
              } else {
                kusukaValues.push('');
              }
            }
            if (kusukaValues.length === jsonData.length) {
              jsonData.forEach((row, i) => {
                (row as Record<string, unknown>).kusuka = kusukaValues[i];
              });
            } else {
              jsonData.forEach((row) => {
                const raw = row.kusuka;
                (row as Record<string, unknown>).kusuka = normalizeKusuka(raw as string | number);
              });
            }
          }
        }

        if (jsonData.length === 0) {
          toast.error('File Excel kosong');
          return;
        }

        const headers = Object.keys(jsonData[0]);
        const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
        if (missingHeaders.length > 0) {
          toast.error(`Kolom tidak ditemukan: ${missingHeaders.join(', ')}`);
          return;
        }

        const parsed = jsonData.map((row) => ({
          year: Number(row.year) || 0,
          kecamatan: String(row.kecamatan || '').trim() || 'Tidak Diketahui',
          desa: String(row.desa || '').trim() || 'Tidak Diketahui',
          fishType: String(row.fishType || '').trim() || 'Lainnya',
          containerType: normalizeContainerType(String(row.containerType || '')),
          businessType: String(row.businessType || ''),
          farmerName: String(row.farmerName || ''),
          groupName: String(row.groupName || ''),
          productionQty: Number(row.productionQty) || 0,
          rtpCount: Number(row.rtpCount) || 0,
          farmerCount: Number(row.farmerCount) || 0,
          groupCount: Number(row.groupCount) || 0,
          targetQty: Number(row.targetQty) || 0,
          productionValue: Number(row.productionValue) || 0,
          latitude: Number(row.latitude) || 0,
          longitude: Number(row.longitude) || 0,
          kusuka: normalizeKusuka(row.kusuka),
          cpib: typeof row.cpib === 'boolean' ? row.cpib : String(row.cpib || '').toLowerCase() === 'ya',
          cbib: typeof row.cbib === 'boolean' ? row.cbib : String(row.cbib || '').toLowerCase() === 'ya',
        }));

        setPreviewData(parsed);
        setFile(f);
        toast.success(`${parsed.length} baris data ditemukan`);
      } catch {
        toast.error('Gagal membaca file Excel');
      }
    };
    reader.readAsBinaryString(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!isVerified) {
        toast.error('Verifikasi password terlebih dahulu');
        return;
      }
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
        parseExcelFile(droppedFile);
      } else {
        toast.error('Hanya file Excel (.xlsx, .xls) yang didukung');
      }
    },
    [isVerified, parseExcelFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isVerified) {
        toast.error('Verifikasi password terlebih dahulu');
        return;
      }
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        parseExcelFile(selectedFile);
      }
    },
    [isVerified, parseExcelFile]
  );

  /**
   * Import using file upload (FormData) for better reliability.
   * Sends the Excel file directly to the server for processing,
   * avoiding large JSON payloads that can crash the server.
   */
  const handleImport = async () => {
    if (!file || previewData.length === 0) return;
    setImporting(true);
    setImportResult(null);
    setImportProgress({ current: previewData.length, total: previewData.length });

    try {
      // Send the file via FormData (much more stable than JSON payload)
      const formData = new FormData();
      formData.append('password', password);
      formData.append('file', file);
      formData.append('replaceAll', String(replaceAll));

      const res = await fetch('/api/fish-farms/import-file', {
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
          autoFilledInfo: result.autoFilledInfo || [],
        });

        const skippedInfo = result.skippedCount > 0 ? ` (${result.skippedCount} baris dilewati)` : '';
        if (replaceAll && result.deletedCount > 0) {
          toast.success(`Berhasil! ${result.deletedCount} data lama dihapus, ${result.count} data baru diimpor${skippedInfo}`);
        } else {
          toast.success(`Berhasil mengimpor ${result.count} data${skippedInfo}`);
        }
        refreshAllData();
      } else {
        toast.error(result.error || 'Gagal mengimpor data');
      }
    } catch {
      toast.error('Gagal mengimpor data. Server mungkin sedang restart. Coba lagi dalam beberapa detik.');
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const handleDeleteAll = async () => {
    if (!isVerified) {
      toast.error('Verifikasi password terlebih dahulu');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/fish-farms/delete-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(`Berhasil menghapus ${result.deletedCount} data`);
        refreshAllData();
      } else {
        toast.error(result.error || 'Gagal menghapus data');
      }
    } catch {
      toast.error('Gagal menghapus data');
    } finally {
      setDeleting(false);
    }
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
  const progressPercent = importProgress.total > 0 
    ? Math.round((importProgress.current / importProgress.total) * 100) 
    : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-teal-600" />
            Import Data Excel
          </DialogTitle>
          <DialogDescription>
            Import data perikanan budidaya dari file Excel. Memerlukan password untuk keamanan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Step 1: Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              1. Verifikasi Password
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Masukkan password admin..."
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
                <CheckCircle2 className="h-3 w-3" /> Password telah diverifikasi
              </p>
            )}
          </div>

          {/* Delete All Data Section */}
          {isVerified && (
            <div className="border border-red-200 dark:border-red-900 rounded-lg p-3 bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">Hapus Semua Data</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={deleting}
                    >
                      {deleting ? 'Menghapus...' : 'Hapus Semua'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Hapus Semua Data?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Tindakan ini akan menghapus <strong>SEMUA data perikanan</strong> dari database.
                        Data yang sudah dihapus tidak dapat dikembalikan.
                        Pastikan Anda sudah mem-backup data dengan melakukan Export terlebih dahulu.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAll}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Ya, Hapus Semua Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
                Menghapus semua data tidak dapat dibatalkan. Export data terlebih dahulu jika diperlukan.
              </p>
            </div>
          )}

          {/* Step 2: File upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" />
              2. Upload File Excel
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30'
                  : isVerified
                  ? 'border-muted hover:border-teal-400'
                  : 'border-muted opacity-50'
              }`}
              onDragOver={(e) => { e.preventDefault(); if (isVerified) setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                disabled={!isVerified}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="cursor-pointer block">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {file ? file.name : 'Klik atau seret file Excel ke sini'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Format: .xlsx, .xls
                </p>
              </label>
            </div>
          </div>

          {/* Import Mode */}
          {previewData.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <Checkbox
                id="replace-all"
                checked={replaceAll}
                onCheckedChange={(checked) => setReplaceAll(!!checked)}
                className="h-4 w-4"
              />
              <label htmlFor="replace-all" className="text-sm cursor-pointer">
                <span className="font-medium">Ganti semua data</span>
                <span className="text-xs text-muted-foreground block mt-0.5">
                  {replaceAll
                    ? 'Semua data lama akan dihapus dan diganti dengan data baru'
                    : 'Hanya data dengan key yang sama yang akan ditimpa (data lama lainnya tetap ada)'}
                </span>
              </label>
            </div>
          )}

          {/* Step 3: Preview */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                3. Preview Data ({previewData.length} baris)
              </label>
              <div className="border rounded-lg overflow-auto max-h-48 custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Tahun</th>
                      <th className="px-2 py-1.5 text-left font-medium">Kecamatan</th>
                      <th className="px-2 py-1.5 text-left font-medium">Desa</th>
                      <th className="px-2 py-1.5 text-left font-medium">Ikan</th>
                      <th className="px-2 py-1.5 text-left font-medium">Wadah</th>
                      <th className="px-2 py-1.5 text-left font-medium">Usaha</th>
                      <th className="px-2 py-1.5 text-left font-medium">Pembudidaya</th>
                      <th className="px-2 py-1.5 text-left font-medium">Kelompok</th>
                      <th className="px-2 py-1.5 text-right font-medium">Produksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{row.year}</td>
                        <td className="px-2 py-1">{row.kecamatan}</td>
                        <td className="px-2 py-1">{row.desa}</td>
                        <td className="px-2 py-1">{row.fishType}</td>
                        <td className="px-2 py-1">{row.containerType}</td>
                        <td className="px-2 py-1">{row.businessType}</td>
                        <td className="px-2 py-1">{row.farmerName || '-'}</td>
                        <td className="px-2 py-1">{row.groupName || '-'}</td>
                        <td className="px-2 py-1 text-right">{formatNumber(row.productionQty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ...dan {previewData.length - 20} baris lainnya
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Import progress */}
          {importing && (
            <div className="space-y-2 p-4 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                <span className="text-sm font-medium text-teal-700 dark:text-teal-400">
                  Mengimpor data... {progressPercent}%
                </span>
              </div>
              <div className="w-full bg-teal-200 dark:bg-teal-800 rounded-full h-2">
                <div 
                  className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-teal-600/70 dark:text-teal-400/70">
                {importProgress.current} dari {importProgress.total} baris diproses
              </p>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">
                  Berhasil mengimpor {importResult.count} data
                </span>
              </div>
              {importResult.deletedCount > 0 && (
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 ml-6">
                  {importResult.deletedCount} data lama dihapus
                </p>
              )}
              {importResult.autoFilledInfo && importResult.autoFilledInfo.length > 0 && (
                <div className="ml-6 mt-1">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Kolom kosong diisi otomatis:
                  </p>
                  <ul className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1 ml-4 list-disc">
                    {importResult.autoFilledInfo.map((info, i) => (
                      <li key={i}>{info}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importResult.skippedCount && importResult.skippedCount > 0 && (
                <div className="ml-6 mt-1">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    {importResult.skippedCount} baris dilewati (data tidak valid)
                  </p>
                  {importResult.skippedReasons && importResult.skippedReasons.length > 0 && (
                    <ul className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1 ml-4 list-disc">
                      {importResult.skippedReasons.slice(0, 5).map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                      {importResult.skippedReasons.length > 5 && (
                        <li>...dan {importResult.skippedReasons.length - 5} alasan lainnya</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
              <div className="ml-6 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    refreshAllData();
                    toast.success('Data diperbarui');
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh Data
                </Button>
              </div>
            </div>
          )}

          {/* Import button */}
          {previewData.length > 0 && !importResult && !importing && (
            <Button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {replaceAll
                ? `Hapus Semua & Import ${previewData.length} Data`
                : `Import ${previewData.length} Data (Gabung)`
              }
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
