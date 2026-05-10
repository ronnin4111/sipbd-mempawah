'use client';

import dynamic from 'next/dynamic';
import { Download, FileSpreadsheet, FileText, Lock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useFilterStore } from '@/store/filter-store';
import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// Dynamic import with ssr:false to prevent html2canvas-pro from crashing SSR on Vercel
const PdfExportDialog = dynamic(
  () => import('./pdf-export-dialog').then((m) => ({ default: m.PdfExportDialog })),
  { ssr: false }
);

function buildFilterString() {
  const state = useFilterStore.getState();
  const params = new URLSearchParams();
  if (state.years.length > 0) params.set('year', state.years.join(','));
  if (state.kecamatan.length > 0) params.set('kecamatan', state.kecamatan.join(','));
  if (state.desa.length > 0) params.set('desa', state.desa.join(','));
  if (state.fishType.length > 0) params.set('fishType', state.fishType.join(','));
  if (state.containerType.length > 0) params.set('containerType', state.containerType.join(','));
  if (state.businessType.length > 0) params.set('businessType', state.businessType.join(','));
  if (state.search) params.set('search', state.search);
  const str = params.toString();
  return str ? `?${str}` : '';
}

export function ExportSection() {
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);

  // Password verification for export
  const [exportPassword, setExportPassword] = useState('');
  const [exportVerified, setExportVerified] = useState(false);
  const [exportVerifying, setExportVerifying] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [pendingExportType, setPendingExportType] = useState<'excel' | 'pdf' | null>(null);

  const handleVerifyExportPassword = async () => {
    if (!exportPassword.trim()) {
      toast.error('Masukkan sandi terlebih dahulu');
      return;
    }
    setExportVerifying(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: exportPassword }),
      });
      const data = await res.json();
      if (data.valid) {
        setExportVerified(true);
        toast.success('Sandi benar');
        setTimeout(() => {
          if (pendingExportType === 'excel') handleExportExcel();
          else if (pendingExportType === 'pdf') setPdfDialogOpen(true);
          setExportDialogOpen(false);
          resetExportPassword();
        }, 300);
      } else {
        toast.error('Sandi salah');
      }
    } catch {
      toast.error('Gagal memverifikasi sandi');
    } finally {
      setExportVerifying(false);
    }
  };

  const resetExportPassword = () => {
    setExportPassword('');
    setExportVerified(false);
    setPendingExportType(null);
  };

  const requestExport = (type: 'excel' | 'pdf') => {
    if (type === 'pdf') {
      // PDF export tidak perlu sandi, langsung buka dialog
      setPdfDialogOpen(true);
    } else {
      // Excel export perlu verifikasi sandi
      setPendingExportType(type);
      setExportDialogOpen(true);
    }
  };

  const handleExportExcel = () => {
    const queryStr = buildFilterString();
    const a = document.createElement('a');
    a.href = `/api/fish-farms/export${queryStr}`;
    a.download = 'data-perikanan-budidaya.xlsx';
    a.click();
    toast.success('Export Excel dimulai');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Export Excel */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-600 text-white">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Export Excel</CardTitle>
                <CardDescription className="text-xs">
                  Data lengkap dalam format spreadsheet
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                Data Pembudidaya (semua record)
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                Produksi per Kecamatan
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                Target vs Realisasi
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                Trend 5 Tahun
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                RTP & Pembudidaya
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                Harga Komoditas
              </li>
            </ul>
            <p className="text-xs text-muted-foreground italic">
              * Export mengikuti filter yang aktif
            </p>
            <Button
              onClick={() => requestExport('excel')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Download className="h-4 w-4" />
              Download Excel
            </Button>
          </CardContent>
        </Card>

        {/* Export PDF */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-teal-600 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Export PDF</CardTitle>
                <CardDescription className="text-xs">
                  Laporan resmi - pilih bagian yang di-export
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                Pilih tabel & grafik yang di-export
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                Tabel: Tren, Jenis Ikan, Target, Kecamatan, Data
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                Grafik: Tren, Wadah, Kecamatan
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                Header resmi Dinas Pertanian Ketahanan Pangan dan Perikanan
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-600 mt-0.5">&#x2022;</span>
                Nomor halaman
              </li>
            </ul>
            <p className="text-xs text-muted-foreground italic">
              * Laporan mengikuti filter yang aktif
            </p>
            <Button
              onClick={() => requestExport('pdf')}
              className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
            >
              <Download className="h-4 w-4" />
              Pilih & Download PDF
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Password Verification Dialog for Export */}
      <Dialog
        open={exportDialogOpen}
        onOpenChange={(v) => {
          if (!v) resetExportPassword();
          setExportDialogOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600" />
              Verifikasi Sandi Export Excel
            </DialogTitle>
            <DialogDescription>
              Masukkan sandi admin untuk melanjutkan export Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <form onSubmit={(e) => { e.preventDefault(); handleVerifyExportPassword(); }} className="flex gap-2">
              <Input
                type="password"
                placeholder="Masukkan sandi admin..."
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                disabled={exportVerified}
                className="text-sm"
                autoComplete="current-password"
                autoFocus
              />
              <Button
                type="submit"
                disabled={exportVerified || exportVerifying}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
              >
                {exportVerified ? 'Terverifikasi' : exportVerifying ? 'Memverifikasi...' : 'Verifikasi'}
              </Button>
            </form>
            {exportVerified && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Sandi telah diverifikasi, memulai export...
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PdfExportDialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen} />
    </motion.div>
  );
}
