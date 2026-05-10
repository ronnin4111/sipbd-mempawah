'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2, FileText, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useFilterStore } from '@/store/filter-store';
import { useFishFarmStats } from '@/hooks/use-fish-farms';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas-pro';

/* eslint-disable @typescript-eslint/no-explicit-any */

const SECTION_OPTIONS = [
  { id: 'tabel-tren', label: 'Tabel Tren Produksi', type: 'table' as const },
  { id: 'tabel-jenis-ikan', label: 'Laporan Produksi per Jenis Ikan', type: 'table' as const },
  { id: 'tabel-target', label: 'Tabel Target vs Realisasi', type: 'table' as const },
  { id: 'tabel-kecamatan', label: 'Tabel Produksi per Kecamatan', type: 'table' as const },
  { id: 'data-produksi', label: 'Data Pembudidaya Perikanan', type: 'table' as const },
  { id: 'chart-tren', label: 'Grafik Tren Produksi', type: 'chart' as const },
  { id: 'chart-produksi', label: 'Grafik Produksi', type: 'chart' as const },
  { id: 'chart-produksi-kecamatan', label: 'Grafik Produksi per Kecamatan', type: 'chart' as const },
] as const;

type SectionId = typeof SECTION_OPTIONS[number]['id'];

function fmtNum(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
}

function fmtCur(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

interface PdfExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfExportDialog({ open, onOpenChange }: PdfExportDialogProps) {
  const [selectedSections, setSelectedSections] = useState<Set<SectionId>>(
    new Set(SECTION_OPTIONS.map(s => s.id))
  );
  const [isExporting, setIsExporting] = useState(false);
  const { data: stats } = useFishFarmStats();
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const filterStore = useFilterStore;

  const toggleSection = (id: SectionId) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedSections(new Set(SECTION_OPTIONS.map(s => s.id)));
  const selectNone = () => setSelectedSections(new Set());

  const generatePdf = useCallback(async () => {
    if (selectedSections.size === 0) {
      toast.error('Pilih minimal satu bagian untuk di-export');
      return;
    }

    setIsExporting(true);

    try {
      // Fetch data for tables
      const state = filterStore.getState();
      const params = new URLSearchParams();
      if (state.years.length > 0) params.set('year', state.years.join(','));
      if (state.kecamatan.length > 0) params.set('kecamatan', state.kecamatan.join(','));
      if (state.desa.length > 0) params.set('desa', state.desa.join(','));
      if (state.fishType.length > 0) params.set('fishType', state.fishType.join(','));
      if (state.containerType.length > 0) params.set('containerType', state.containerType.join(','));
      if (state.businessType.length > 0) params.set('businessType', state.businessType.join(','));
      if (state.search) params.set('search', state.search);
      params.set('pageSize', '1000');

      const [statsRes, dataRes] = await Promise.all([
        fetch(`/api/fish-farms/stats?${params.toString()}`),
        fetch(`/api/fish-farms?${params.toString()}`),
      ]);

      const statsData: any = await statsRes.json();
      const dataData: any = await dataRes.json();
      const records: any[] = dataData.data || [];

      // Wait for PDF charts to be fully rendered in the viewport
      await new Promise(r => setTimeout(r, 800));

      // Capture charts as images from always-rendered PDF chart container
      const chartImages: Record<string, string> = {};
      const chartIdMap: Record<string, string> = {
        'chart-tren': 'pdf-chart-tren-produksi',
        'chart-produksi': 'pdf-chart-produksi',
        'chart-produksi-kecamatan': 'pdf-chart-produksi-kecamatan',
      };

      for (const sectionId of selectedSections) {
        const domId = chartIdMap[sectionId];
        if (domId) {
          const el = document.getElementById(domId);
          if (el) {
            // Retry logic: attempt capture up to 3 times
            let captured = false;
            for (let attempt = 1; attempt <= 3 && !captured; attempt++) {
              try {
                // Small delay before each capture to ensure SVG rendering is complete
                if (attempt > 1) {
                  await new Promise(r => setTimeout(r, 500));
                }
                const canvas = await html2canvas(el, {
                  backgroundColor: '#FFFFFF',
                  scale: 2,
                  useCORS: true,
                  allowTaint: true,
                  logging: false,
                  width: el.scrollWidth,
                  height: el.scrollHeight,
                });
                const dataUrl = canvas.toDataURL('image/png');
                // Verify the canvas actually has content (not blank)
                if (canvas.width > 0 && canvas.height > 0) {
                  chartImages[sectionId] = dataUrl;
                  captured = true;
                }
              } catch (err) {
                console.error(`Failed to capture chart ${sectionId} (attempt ${attempt}):`, err);
              }
            }
            if (!captured) {
              console.warn(`Could not capture chart ${sectionId} after 3 attempts`);
            }
          }
        }
      }

      // Build PDF
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const usableWidth = pageWidth - 2 * margin;

      const addHeader = () => {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text('DINAS PERTANIAN KETAHANAN PANGAN DAN PERIKANAN KABUPATEN MEMPAWAH', pageWidth / 2, 15, { align: 'center' });

        doc.setFontSize(11);
        doc.setTextColor(80, 80, 80);
        doc.text('Laporan Sistem Informasi Perikanan Budidaya', pageWidth / 2, 22, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        const now = new Date();
        const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(`Tanggal: ${dateStr}`, margin, 30);

        const filterParts: string[] = [];
        if (state.years.length > 0) filterParts.push(`Tahun: ${state.years.join(', ')}`);
        if (state.kecamatan.length > 0) filterParts.push(`Kecamatan: ${state.kecamatan.join(', ')}`);
        if (state.fishType.length > 0) filterParts.push(`Jenis Ikan: ${state.fishType.join(', ')}`);
        if (state.businessType.length > 0) filterParts.push(`Jenis Usaha: ${state.businessType.join(', ')}`);
        const filterText = filterParts.length > 0 ? `Filter: ${filterParts.join(' | ')}` : 'Filter: Semua data';
        doc.text(filterText, margin, 35);
        doc.text(`Total Data: ${records.length} record`, margin, 40);
      };

      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Halaman ${pageNum} dari ${totalPages} | SIPBD Kab. Mempawah`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      };

      const getAutoTableY = () => {
        return (doc as any).lastAutoTable?.finalY || 45;
      };

      const setAutoTableY = (y: number) => {
        (doc as any).lastAutoTable = { finalY: y };
      };

      // Page 1 with header
      addHeader();
      let currentY = 45;
      let isFirstSection = true;

      const addSectionTitle = (title: string, y: number) => {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text(title, margin, y);
        return y + 5;
      };

      const sections = SECTION_OPTIONS.filter(s => selectedSections.has(s.id));

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];

        if (!isFirstSection) {
          if (currentY > pageHeight - 60) {
            doc.addPage();
            addHeader();
            currentY = 45;
          } else {
            currentY = getAutoTableY() + 12;
          }
        }

        if (section.type === 'chart') {
          const imgData = chartImages[section.id];
          if (imgData) {
            if (currentY > pageHeight - 100) {
              doc.addPage();
              addHeader();
              currentY = 45;
            }
            currentY = addSectionTitle(section.label, currentY);
            const maxImgHeight = 100;
            doc.addImage(imgData, 'PNG', margin, currentY, usableWidth, maxImgHeight);
            currentY += maxImgHeight + 10;
            setAutoTableY(currentY);
          }
        } else {
          switch (section.id) {
            case 'tabel-tren': {
              if (!statsData.trend5Year) break;

              if (currentY > pageHeight - 60) {
                doc.addPage();
                addHeader();
                currentY = 45;
              }
              currentY = addSectionTitle(section.label, currentY);

              const trendDataWithPct: any[][] = [];
              const rawEntries: any[] = Object.entries(statsData.trend5Year)
                .sort(([a]: any, [b]: any) => a.localeCompare(b))
                .map(([year, val]: any) => ({
                  year,
                  pembesaran: val.pembesaran as number,
                  pembenihan: val.pembenihan as number,
                }));

              rawEntries.forEach((row: any, idx: number) => {
                let trendPembesaranStr = '-';
                let trendPembenihanStr = '-';

                if (idx > 0) {
                  const prev = rawEntries[idx - 1];
                  // Pembesaran trend
                  if (prev.pembesaran > 0) {
                    const pct = ((row.pembesaran - prev.pembesaran) / prev.pembesaran) * 100;
                    const arrow = pct > 0.5 ? '[^]' : pct < -0.5 ? '[v]' : '[>]';
                    trendPembesaranStr = `${arrow} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
                  } else if (row.pembesaran > 0) {
                    trendPembesaranStr = '[^] +100%';
                  }
                  // Pembenihan trend
                  if (prev.pembenihan > 0) {
                    const pct = ((row.pembenihan - prev.pembenihan) / prev.pembenihan) * 100;
                    const arrow = pct > 0.5 ? '[^]' : pct < -0.5 ? '[v]' : '[>]';
                    trendPembenihanStr = `${arrow} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
                  } else if (row.pembenihan > 0) {
                    trendPembenihanStr = '[^] +100%';
                  }
                }
                trendDataWithPct.push([row.year, fmtNum(row.pembesaran), trendPembesaranStr, fmtNum(row.pembenihan), trendPembenihanStr]);
              });

              const yearRange = rawEntries.length >= 2
                ? `${rawEntries[0].year} - ${rawEntries[rawEntries.length - 1].year}`
                : rawEntries.length === 1 ? rawEntries[0].year : '-';

              autoTable(doc, {
                startY: currentY,
                head: [[`Tahun: ${yearRange}`, 'Pembesaran (Kg)', 'Tren Pembesaran', 'Pembenihan (Ekor)', 'Tren Pembenihan']],
                body: trendDataWithPct,
                theme: 'grid',
                headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 8, cellPadding: 2 },
                margin: { left: margin, right: margin },
                columnStyles: {
                  0: { halign: 'center', fontStyle: 'bold' },
                  1: { halign: 'right' },
                  2: { halign: 'center', fontStyle: 'bold' },
                  3: { halign: 'right' },
                  4: { halign: 'center', fontStyle: 'bold' },
                },
                didParseCell: (data: any) => {
                  // Color the Tren columns (2 and 4) based on trend direction
                  if ((data.column.index === 2 || data.column.index === 4) && data.row.section === 'body') {
                    const val = String(data.cell.raw || '');
                    if (val.startsWith('[^]')) {
                      data.cell.styles.textColor = [22, 163, 74]; // green for up
                    } else if (val.startsWith('[v]')) {
                      data.cell.styles.textColor = [220, 38, 38]; // red for down
                    } else if (val.startsWith('[>]')) {
                      data.cell.styles.textColor = [217, 119, 6]; // amber for flat
                    }
                  }
                },
              });
              break;
            }

            case 'tabel-jenis-ikan': {
              if (!statsData.productionByFishTypeDetail) break;

              if (currentY > pageHeight - 60) {
                doc.addPage();
                addHeader();
                currentY = 45;
              }
              currentY = addSectionTitle(section.label, currentY);

              const fishTypeEntries = Object.entries(statsData.productionByFishTypeDetail);
              const fishTypeData: any[][] = fishTypeEntries
                .map(([fishType, val]: any) => [
                  fishType,
                  fmtNum(val.pembesaranProduction),
                  fmtNum(val.pembesaranRtp || 0),
                  fmtNum(val.pembesaranGroup || 0),
                  fmtNum(val.pembenihanProduction),
                  fmtNum(val.pembenihanRtp || 0),
                  fmtNum(val.pembenihanGroup || 0),
                  fmtCur(val.value),
                ]);

              const fishTypeTotals = fishTypeEntries.reduce((acc: any, [, val]: any) => ({
                pembesaranProduction: acc.pembesaranProduction + (val.pembesaranProduction as number),
                pembenihanProduction: acc.pembenihanProduction + (val.pembenihanProduction as number),
                pembesaranRtp: acc.pembesaranRtp + (val.pembesaranRtp || 0),
                pembenihanRtp: acc.pembenihanRtp + (val.pembenihanRtp || 0),
                pembesaranGroup: acc.pembesaranGroup + (val.pembesaranGroup || 0),
                pembenihanGroup: acc.pembenihanGroup + (val.pembenihanGroup || 0),
                value: acc.value + (val.value as number),
              }), { pembesaranProduction: 0, pembenihanProduction: 0, pembesaranRtp: 0, pembenihanRtp: 0, pembesaranGroup: 0, pembenihanGroup: 0, value: 0 });

              fishTypeData.push([
                'TOTAL',
                fmtNum(fishTypeTotals.pembesaranProduction), fmtNum(fishTypeTotals.pembesaranRtp), fmtNum(fishTypeTotals.pembesaranGroup),
                fmtNum(fishTypeTotals.pembenihanProduction), fmtNum(fishTypeTotals.pembenihanRtp), fmtNum(fishTypeTotals.pembenihanGroup),
                fmtCur(fishTypeTotals.value),
              ]);

              autoTable(doc, {
                startY: currentY,
                head: [[
                  { content: 'Jenis Ikan', rowSpan: 2 },
                  { content: 'Pembesaran', colSpan: 3, styles: { halign: 'center' } },
                  { content: 'Pembenihan', colSpan: 3, styles: { halign: 'center' } },
                  { content: 'Nilai (Rp)', rowSpan: 2 },
                ], [
                  'Produksi (Kg)', 'RTP', 'Kelompok',
                  'Produksi (Ekor)', 'RTP', 'Kelompok',
                ]],
                body: fishTypeData,
                theme: 'grid',
                headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 6 },
                styles: { fontSize: 6, cellPadding: 2 },
                margin: { left: margin, right: margin },
                columnStyles: {
                  0: { fontStyle: 'bold' },
                  1: { halign: 'right' },
                  2: { halign: 'right' },
                  3: { halign: 'right' },
                  4: { halign: 'right' },
                  5: { halign: 'right' },
                  6: { halign: 'right' },
                  7: { halign: 'right' },
                },
                didParseCell: (data: any) => {
                  if (data.row.section === 'body' && data.row.index === fishTypeData.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                  }
                },
              });
              break;
            }

            case 'tabel-target': {
              if (!statsData.targetVsRealisasiPembesaran) break;

              const pembesaranData: any[][] = Object.entries(statsData.targetVsRealisasiPembesaran)
                .map(([fish, d]: any, i: number) => [
                  i + 1, fish, 'Pembesaran',
                  fmtNum(d.target), fmtNum(d.realisasi), 'Kg',
                  d.target > 0 ? `${((d.realisasi / d.target) * 100).toFixed(1)}%` : '0%',
                ]);
              const pembenihanData: any[][] = Object.entries(statsData.targetVsRealisasiPembenihan)
                .map(([fish, d]: any, i: number) => [
                  pembesaranData.length + i + 1, fish, 'Pembenihan',
                  fmtNum(d.target), fmtNum(d.realisasi), 'Ekor',
                  d.target > 0 ? `${((d.realisasi / d.target) * 100).toFixed(1)}%` : '0%',
                ]);

              if (currentY > pageHeight - 60) {
                doc.addPage();
                addHeader();
                currentY = 45;
              }
              currentY = addSectionTitle(section.label, currentY);

              autoTable(doc, {
                startY: currentY,
                head: [['No', 'Jenis Ikan', 'Jenis Usaha', 'Target', 'Realisasi', 'Satuan', 'Persentase (%)']],
                body: [...pembesaranData, ...pembenihanData],
                theme: 'grid',
                headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 8, cellPadding: 2 },
                margin: { left: margin, right: margin },
                columnStyles: {
                  0: { halign: 'center' },
                  1: {},
                  2: {},
                  3: { halign: 'right' },
                  4: { halign: 'right' },
                  5: { halign: 'center' },
                  6: { halign: 'right' },
                },
              });
              break;
            }

            case 'tabel-kecamatan': {
              if (!statsData.productionByKecamatanDetail) break;

              if (currentY > pageHeight - 60) {
                doc.addPage();
                addHeader();
                currentY = 45;
              }
              currentY = addSectionTitle(section.label, currentY);

              const kecEntries = Object.entries(statsData.productionByKecamatanDetail);
              const kecData: any[][] = kecEntries
                .map(([kec, val]: any, i: number) => [
                  i + 1, kec,
                  fmtNum(val.pembesaranProduction),
                  fmtNum(val.pembesaranRtp || 0),
                  fmtNum(val.pembesaranGroup || 0),
                  fmtNum(val.pembenihanProduction),
                  fmtNum(val.pembenihanRtp || 0),
                  fmtNum(val.pembenihanGroup || 0),
                  fmtCur(val.value),
                ]);

              // Calculate totals
              const kecTotals = kecEntries.reduce((acc: any, [, val]: any) => ({
                pembesaranProduction: acc.pembesaranProduction + (val.pembesaranProduction as number),
                pembenihanProduction: acc.pembenihanProduction + (val.pembenihanProduction as number),
                pembesaranRtp: acc.pembesaranRtp + (val.pembesaranRtp || 0),
                pembenihanRtp: acc.pembenihanRtp + (val.pembenihanRtp || 0),
                pembesaranGroup: acc.pembesaranGroup + (val.pembesaranGroup || 0),
                pembenihanGroup: acc.pembenihanGroup + (val.pembenihanGroup || 0),
                value: acc.value + (val.value as number),
              }), { pembesaranProduction: 0, pembenihanProduction: 0, pembesaranRtp: 0, pembenihanRtp: 0, pembesaranGroup: 0, pembenihanGroup: 0, value: 0 });

              // Add total row
              kecData.push([
                '', 'TOTAL',
                fmtNum(kecTotals.pembesaranProduction), fmtNum(kecTotals.pembesaranRtp), fmtNum(kecTotals.pembesaranGroup),
                fmtNum(kecTotals.pembenihanProduction), fmtNum(kecTotals.pembenihanRtp), fmtNum(kecTotals.pembenihanGroup),
                fmtCur(kecTotals.value),
              ]);

              autoTable(doc, {
                startY: currentY,
                head: [[
                  { content: 'No', rowSpan: 2 },
                  { content: 'Kecamatan', rowSpan: 2 },
                  { content: 'Pembesaran', colSpan: 3, styles: { halign: 'center' } },
                  { content: 'Pembenihan', colSpan: 3, styles: { halign: 'center' } },
                  { content: 'Nilai (Rp)', rowSpan: 2 },
                ], [
                  'Produksi (Kg)', 'RTP', 'Kelompok',
                  'Produksi (Ekor)', 'RTP', 'Kelompok',
                ]],
                body: kecData,
                theme: 'grid',
                headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 6 },
                styles: { fontSize: 6, cellPadding: 2 },
                margin: { left: margin, right: margin },
                columnStyles: {
                  0: { halign: 'center' },
                  1: {},
                  2: { halign: 'right' },
                  3: { halign: 'right' },
                  4: { halign: 'right' },
                  5: { halign: 'right' },
                  6: { halign: 'right' },
                  7: { halign: 'right' },
                  8: { halign: 'right' },
                },
                didParseCell: (data: any) => {
                  // Bold the TOTAL row
                  if (data.row.section === 'body' && data.row.index === kecData.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                  }
                },
              });
              break;
            }

            case 'data-produksi': {
              if (currentY > pageHeight - 60) {
                doc.addPage();
                addHeader();
                currentY = 45;
              }
              currentY = addSectionTitle(section.label, currentY);

              // Read column visibility from localStorage (same key as DataTable)
              let colVis: Record<string, boolean> = {};
              try {
                const saved = localStorage.getItem('fishFarm_columnVisibility');
                if (saved) colVis = JSON.parse(saved);
              } catch {}

              // Define all possible columns with their accessorKey, header, and data extractor
              const allPdfCols: { key: string; header: string; extract: (r: any, i: number) => any; align?: 'left' | 'center' | 'right'; width?: number }[] = [
                { key: 'no', header: 'No', extract: (_r: any, i: number) => i + 1, align: 'center', width: 8 },
                { key: 'year', header: 'Tahun', extract: (r: any) => r.year, align: 'center', width: 12 },
                { key: 'kecamatan', header: 'Kecamatan', extract: (r: any) => r.kecamatan },
                { key: 'desa', header: 'Desa', extract: (r: any) => r.desa },
                { key: 'fishType', header: 'Jenis Ikan', extract: (r: any) => r.fishType },
                { key: 'containerType', header: 'Wadah', extract: (r: any) => r.containerType, width: 22 },
                { key: 'businessType', header: 'Usaha', extract: (r: any) => r.businessType, width: 20 },
                { key: 'farmerName', header: 'Nama Pembudidaya', extract: (r: any) => r.farmerName || '-' },
                { key: 'groupName', header: 'Nama Kelompok', extract: (r: any) => r.groupName || '-' },
                { key: 'productionQty', header: 'Produksi', extract: (r: any) => fmtNum(r.productionQty), align: 'right' },
                { key: 'targetQty', header: 'Target', extract: (r: any) => fmtNum(r.targetQty || 0), align: 'right' },
                { key: 'productionValue', header: 'Nilai (Rp)', extract: (r: any) => fmtCur(r.productionValue), align: 'right' },
                { key: 'rtpCount', header: 'RTP', extract: (r: any) => fmtNum(r.rtpCount), align: 'right' },
                { key: 'farmerCount', header: 'Pembudidaya', extract: (r: any) => fmtNum(r.farmerCount), align: 'right' },
                { key: 'groupCount', header: 'Kelompok', extract: (r: any) => fmtNum(r.groupCount || 0), align: 'right' },
                { key: 'kusuka', header: 'KUSUKA', extract: (r: any) => r.kusuka || '-' },
                { key: 'cpib', header: 'CPIB', extract: (r: any) => r.cpib ? 'Ya' : '-' },
                { key: 'cbib', header: 'CBIB', extract: (r: any) => r.cbib ? 'Ya' : '-' },
              ];

              // Filter columns based on visibility (colVis[key] === false means hidden)
              const visibleCols = allPdfCols.filter(col => colVis[col.key] !== false);

              const headRow = [visibleCols.map(c => c.header)];
              const bodyRows: any[][] = records.map((r: any, i: number) =>
                visibleCols.map(c => c.extract(r, i))
              );

              // Build columnStyles dynamically based on visible columns
              const colStyles: Record<number, any> = {};
              visibleCols.forEach((col, idx) => {
                if (col.align) colStyles[idx] = { halign: col.align };
                if (col.width) colStyles[idx] = { ...colStyles[idx], cellWidth: col.width };
              });

              autoTable(doc, {
                startY: currentY,
                head: headRow,
                body: bodyRows,
                theme: 'grid',
                headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 6 },
                styles: { fontSize: 6, cellPadding: 1.5 },
                margin: { left: margin, right: margin },
                columnStyles: colStyles,
              });
              break;
            }
          }
        }

        isFirstSection = false;
      }

      // Add footer to all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        addFooter(i, pageCount);
      }

      // Generate and download
      const buffer = Buffer.from(doc.output('arraybuffer'));
      const now = new Date();
      const dateFileStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-perikanan-${dateFileStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`PDF berhasil di-export (${selectedSections.size} bagian)`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Gagal meng-export PDF. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  }, [selectedSections, stats, years, kecamatan, filterStore, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            Export PDF - Pilih Bagian
          </DialogTitle>
          <DialogDescription>
            Pilih bagian-bagian yang ingin dimasukkan ke dalam file PDF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Select All / None */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={selectAll}
            >
              <CheckSquare className="h-3 w-3" />
              Pilih Semua
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={selectNone}
            >
              Tidak Ada
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {selectedSections.size} dari {SECTION_OPTIONS.length} dipilih
            </span>
          </div>

          {/* Section Checklist */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
            {SECTION_OPTIONS.map((section) => (
              <label
                key={section.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-accent/50"
              >
                <Checkbox
                  checked={selectedSections.has(section.id)}
                  onCheckedChange={() => toggleSection(section.id)}
                  className="h-4 w-4"
                />
                <span className="text-sm flex-1">{section.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  section.type === 'chart'
                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}>
                  {section.type === 'chart' ? 'Grafik' : 'Tabel'}
                </span>
              </label>
            ))}
          </div>

          {/* Filter info */}
          <div className="text-xs text-muted-foreground italic border-t pt-2">
            * Export mengikuti filter yang aktif saat ini
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 gap-2"
              onClick={generatePdf}
              disabled={isExporting || selectedSections.size === 0}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Membuat PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
