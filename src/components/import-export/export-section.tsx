'use client';

import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useFilterStore } from '@/store/filter-store';
import { useState } from 'react';
import { PdfExportDialog } from './pdf-export-dialog';

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
                Data Produksi (semua record)
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
            </ul>
            <p className="text-xs text-muted-foreground italic">
              * Export mengikuti filter yang aktif
            </p>
            <Button
              onClick={handleExportExcel}
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
                Header resmi Dinas Perikanan
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
              onClick={() => setPdfDialogOpen(true)}
              className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
            >
              <Download className="h-4 w-4" />
              Pilih & Download PDF
            </Button>
          </CardContent>
        </Card>
      </div>

      <PdfExportDialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen} />
    </motion.div>
  );
}
