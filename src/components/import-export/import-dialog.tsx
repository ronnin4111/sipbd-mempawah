'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Lock, CheckCircle2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  productionQty: number;
  rtpCount: number;
  farmerCount: number;
  groupCount: number;
  targetQty: number;
  productionValue: number;
  latitude: number;
  longitude: number;
}

const REQUIRED_HEADERS = [
  'year', 'kecamatan', 'desa', 'fishType', 'containerType', 'businessType',
  'productionQty', 'rtpCount', 'farmerCount', 'groupCount', 'targetQty',
  'productionValue', 'latitude', 'longitude',
];

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [password, setPassword] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setPassword('');
    setIsVerified(false);
    setFile(null);
    setPreviewData([]);
    setImportResult(null);
  }, []);

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
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (!result) return;
        const wb = XLSX.read(result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

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
          kecamatan: String(row.kecamatan || ''),
          desa: String(row.desa || ''),
          fishType: String(row.fishType || ''),
          containerType: String(row.containerType || ''),
          businessType: String(row.businessType || ''),
          productionQty: Number(row.productionQty) || 0,
          rtpCount: Number(row.rtpCount) || 0,
          farmerCount: Number(row.farmerCount) || 0,
          groupCount: Number(row.groupCount) || 0,
          targetQty: Number(row.targetQty) || 0,
          productionValue: Number(row.productionValue) || 0,
          latitude: Number(row.latitude) || 0,
          longitude: Number(row.longitude) || 0,
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

  const handleImport = async () => {
    if (previewData.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/fish-farms/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, data: previewData }),
      });
      const result = await res.json();
      if (res.ok) {
        setImportResult({ success: true, count: result.count });
        toast.success(`Berhasil mengimpor ${result.count} data`);
      } else {
        toast.error(result.error || 'Gagal mengimpor data');
      }
    } catch {
      toast.error('Gagal mengimpor data');
    } finally {
      setImporting(false);
    }
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

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
            Import data perikanan budidaya dari file Excel. Data yang sudah ada dengan composite key yang sama akan ditimpa.
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

          {/* Import result */}
          {importResult && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">
                Berhasil mengimpor {importResult.count} data
              </span>
            </div>
          )}

          {/* Import button */}
          {previewData.length > 0 && !importResult && (
            <Button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {importing ? 'Mengimpor...' : `Import ${previewData.length} Data`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
