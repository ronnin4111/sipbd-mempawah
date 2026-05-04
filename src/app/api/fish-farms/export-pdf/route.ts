import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const maxDuration = 60;

// Case-insensitive contains filter
const ciContains = (value: string) => {
  const isPostgres = process.env.DATABASE_URL?.includes('postgres');
  return isPostgres
    ? { contains: value, mode: 'insensitive' as const }
    : { contains: value };
};

// Helper to build filter
function buildWhere(searchParams: URLSearchParams) {
  const where: Record<string, unknown> = {};

  const yearParam = searchParams.get('year');
  if (yearParam) {
    const years = yearParam.split(',').map(Number).filter(n => !isNaN(n));
    if (years.length > 0) where.year = { in: years };
  }

  const kecamatanParam = searchParams.get('kecamatan');
  if (kecamatanParam) {
    const list = kecamatanParam.split(',').filter(Boolean);
    if (list.length > 0) where.kecamatan = { in: list };
  }

  const desaParam = searchParams.get('desa');
  if (desaParam) {
    const list = desaParam.split(',').filter(Boolean);
    if (list.length > 0) where.desa = { in: list };
  }

  const fishTypeParam = searchParams.get('fishType');
  if (fishTypeParam) {
    const list = fishTypeParam.split(',').filter(Boolean);
    if (list.length > 0) where.fishType = { in: list };
  }

  const containerTypeParam = searchParams.get('containerType');
  if (containerTypeParam) {
    const list = containerTypeParam.split(',').filter(Boolean);
    if (list.length > 0) where.containerType = { in: list };
  }

  const businessTypeParam = searchParams.get('businessType');
  if (businessTypeParam) {
    const list = businessTypeParam.split(',').filter(Boolean);
    if (list.length > 0) where.businessType = { in: list };
  }

  const searchParam = searchParams.get('search');
  if (searchParam) {
    where.OR = [
      { kecamatan: ciContains(searchParam) },
      { desa: ciContains(searchParam) },
      { fishType: ciContains(searchParam) },
      { containerType: ciContains(searchParam) },
      { farmerName: ciContains(searchParam) },
      { groupName: ciContains(searchParam) },
    ];
  }

  return where;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const where = buildWhere(searchParams);

    const records = await db.fishFarm.findMany({
      where,
      orderBy: [{ year: 'desc' }, { kecamatan: 'asc' }, { desa: 'asc' }],
    });

    // Compute stats - separated by business type
    const pembesaranProduction = records
      .filter(r => r.businessType === 'Pembesaran')
      .reduce((s, r) => s + r.productionQty, 0);
    const pembenihanProduction = records
      .filter(r => r.businessType === 'Pembenihan')
      .reduce((s, r) => s + r.productionQty, 0);
    const totalRtp = records.reduce((s, r) => s + r.rtpCount, 0);
    const totalFarmer = records.reduce((s, r) => s + r.farmerCount, 0);
    const totalValue = records.reduce((s, r) => s + r.productionValue, 0);
    const totalKusuka = records.filter(r => /^\d{16}$/.test(String(r.kusuka || '').trim())).length;

    // Unique group names (case-insensitive)
    const groupNamesGlobal = new Set<string>();
    const groupNamesByBusinessType: Record<string, Set<string>> = {};
    records.forEach(r => {
      if (r.groupName && r.groupName.trim()) {
        const normalized = r.groupName.trim().toLowerCase();
        groupNamesGlobal.add(normalized);
        if (!groupNamesByBusinessType[r.businessType]) {
          groupNamesByBusinessType[r.businessType] = new Set();
        }
        groupNamesByBusinessType[r.businessType].add(normalized);
      }
    });
    const totalGroup = groupNamesGlobal.size;

    // By kecamatan - separated by business type
    const kecDetail: Record<string, {
      pembesaranProduction: number; pembenihanProduction: number;
      value: number; rtp: number; farmer: number; group: Set<string>;
    }> = {};
    records.forEach(r => {
      if (!kecDetail[r.kecamatan]) kecDetail[r.kecamatan] = {
        pembesaranProduction: 0, pembenihanProduction: 0,
        value: 0, rtp: 0, farmer: 0, group: new Set(),
      };
      if (r.businessType === 'Pembesaran') {
        kecDetail[r.kecamatan].pembesaranProduction += r.productionQty;
      } else {
        kecDetail[r.kecamatan].pembenihanProduction += r.productionQty;
      }
      kecDetail[r.kecamatan].value += r.productionValue;
      kecDetail[r.kecamatan].rtp += r.rtpCount;
      kecDetail[r.kecamatan].farmer += r.farmerCount;
      if (r.groupName && r.groupName.trim()) {
        kecDetail[r.kecamatan].group.add(r.groupName.trim().toLowerCase());
      }
    });

    // Target vs Realisasi - separated by business type
    const targetPembesaran: Record<string, { target: number; realisasi: number }> = {};
    const targetPembenihan: Record<string, { target: number; realisasi: number }> = {};
    records.forEach(r => {
      if (r.businessType === 'Pembesaran') {
        if (!targetPembesaran[r.fishType]) targetPembesaran[r.fishType] = { target: 0, realisasi: 0 };
        targetPembesaran[r.fishType].target += r.targetQty;
        targetPembesaran[r.fishType].realisasi += r.productionQty;
      } else {
        if (!targetPembenihan[r.fishType]) targetPembenihan[r.fishType] = { target: 0, realisasi: 0 };
        targetPembenihan[r.fishType].target += r.targetQty;
        targetPembenihan[r.fishType].realisasi += r.productionQty;
      }
    });

    // Create PDF
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const usableWidth = pageWidth - 2 * margin;

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DINAS PERIKANAN KABUPATEN MEMPAWAH', pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(12);
    doc.text('LAPORAN SISTEM INFORMASI PERIKANAN BUDIDAYA', pageWidth / 2, 22, { align: 'center' });

    // Date and filter summary
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Tanggal: ${dateStr}`, margin, 30);

    const filterParts: string[] = [];
    const yearParam = searchParams.get('year');
    const kecamatanParam = searchParams.get('kecamatan');
    if (yearParam) filterParts.push(`Tahun: ${yearParam.replace(/,/g, ', ')}`);
    if (kecamatanParam) filterParts.push(`Kecamatan: ${kecamatanParam.replace(/,/g, ', ')}`);
    const filterText = filterParts.length > 0 ? `Filter: ${filterParts.join(' | ')}` : 'Filter: Semua data';
    doc.text(filterText, margin, 35);
    doc.text(`Total Data: ${records.length} record`, margin, 40);

    // Table 1: Iktisar (Summary) - separated by business type
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Iktisar', margin, 48);

    autoTable(doc, {
      startY: 50,
      head: [['Indikator', 'Nilai']],
      body: [
        ['Produksi Pembesaran (Kg)', formatNumber(pembesaranProduction)],
        ['Produksi Pembenihan (Ekor)', formatNumber(pembenihanProduction)],
        ['Total Nilai Produksi (Rp)', formatNumber(totalValue)],
        ['Total RTP', formatNumber(totalRtp)],
        ['Total Pembudidaya', formatNumber(totalFarmer)],
        ['Total Kelompok', formatNumber(totalGroup)],
        ['Jumlah KUSUKA', formatNumber(totalKusuka)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: margin, right: margin },
      tableWidth: usableWidth * 0.6,
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    });

    // Table 2: Produksi Per Kecamatan - separated by business type
    const currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Produksi Per Kecamatan', margin, currentY);

    autoTable(doc, {
      startY: currentY + 2,
      head: [['No', 'Kecamatan', 'Pembesaran (Kg)', 'Pembenihan (Ekor)', 'Nilai (Rp)', 'RTP', 'Pembudidaya', 'Kelompok']],
      body: Object.entries(kecDetail).map(([kec, d], i) => [
        i + 1,
        kec,
        formatNumber(d.pembesaranProduction),
        formatNumber(d.pembenihanProduction),
        formatNumber(d.value),
        formatNumber(d.rtp),
        formatNumber(d.farmer),
        formatNumber(d.group.size),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2 },
      margin: { left: margin, right: margin },
      tableWidth: usableWidth,
      columnStyles: {
        0: { halign: 'center' },
        1: {},
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
      },
    });

    // Table 3: Target vs Realisasi - separated by business type (new page)
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DINAS PERIKANAN KABUPATEN MEMPAWAH', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Target vs Realisasi Produksi Per Jenis Ikan', pageWidth / 2, 22, { align: 'center' });

    autoTable(doc, {
      startY: 30,
      head: [['No', 'Jenis Ikan', 'Jenis Usaha', 'Target', 'Realisasi', 'Satuan', 'Persentase (%)']],
      body: [
        ...Object.entries(targetPembesaran).map(([fish, d], i) => [
          i + 1, fish, 'Pembesaran',
          formatNumber(d.target), formatNumber(d.realisasi), 'Kg',
          d.target > 0 ? `${((d.realisasi / d.target) * 100).toFixed(2)}%` : '0%',
        ]),
        ...Object.entries(targetPembenihan).map(([fish, d], i) => [
          Object.keys(targetPembesaran).length + i + 1, fish, 'Pembenihan',
          formatNumber(d.target), formatNumber(d.realisasi), 'Ekor',
          d.target > 0 ? `${((d.realisasi / d.target) * 100).toFixed(2)}%` : '0%',
        ]),
      ],
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: margin, right: margin },
      tableWidth: usableWidth * 0.85,
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

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Halaman ${i} dari ${pageCount} | Sistem Informasi Perikanan Budidaya Kab. Mempawah`,
        pageWidth / 2,
        doc.internal.pageSize.height - 8,
        { align: 'center' }
      );
    }

    // Generate buffer
    const buffer = Buffer.from(doc.output('arraybuffer'));
    const dateFileStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="laporan-perikanan-${dateFileStr}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error exporting fish farms to PDF:', error);
    return NextResponse.json(
      { error: 'Failed to export PDF' },
      { status: 500 }
    );
  }
}
