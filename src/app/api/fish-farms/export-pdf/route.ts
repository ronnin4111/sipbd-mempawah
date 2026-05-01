import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
      { kecamatan: { contains: searchParam } },
      { desa: { contains: searchParam } },
      { fishType: { contains: searchParam } },
      { containerType: { contains: searchParam } },
      { farmerName: { contains: searchParam } },
      { groupName: { contains: searchParam } },
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

    // Compute stats
    const totalProduction = records.reduce((s, r) => s + r.productionQty, 0);
    const totalRtp = records.reduce((s, r) => s + r.rtpCount, 0);
    const totalFarmer = records.reduce((s, r) => s + r.farmerCount, 0);
    const totalGroup = records.reduce((s, r) => s + r.groupCount, 0);
    const totalValue = records.reduce((s, r) => s + r.productionValue, 0);

    // By kecamatan
    const kecDetail: Record<string, { production: number; value: number; rtp: number; farmer: number; group: number }> = {};
    records.forEach(r => {
      if (!kecDetail[r.kecamatan]) kecDetail[r.kecamatan] = { production: 0, value: 0, rtp: 0, farmer: 0, group: 0 };
      kecDetail[r.kecamatan].production += r.productionQty;
      kecDetail[r.kecamatan].value += r.productionValue;
      kecDetail[r.kecamatan].rtp += r.rtpCount;
      kecDetail[r.kecamatan].farmer += r.farmerCount;
      kecDetail[r.kecamatan].group += r.groupCount;
    });

    // Target vs Realisasi
    const targetRealisasi: Record<string, { target: number; realisasi: number }> = {};
    records.forEach(r => {
      if (!targetRealisasi[r.fishType]) targetRealisasi[r.fishType] = { target: 0, realisasi: 0 };
      targetRealisasi[r.fishType].target += r.targetQty;
      targetRealisasi[r.fishType].realisasi += r.productionQty;
    });

    // Create PDF (A4, landscape for better table fit)
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

    // Filter summary
    const filterParts: string[] = [];
    const yearParam = searchParams.get('year');
    const kecamatanParam = searchParams.get('kecamatan');
    if (yearParam) filterParts.push(`Tahun: ${yearParam.replace(/,/g, ', ')}`);
    if (kecamatanParam) filterParts.push(`Kecamatan: ${kecamatanParam.replace(/,/g, ', ')}`);
    const filterText = filterParts.length > 0 ? `Filter: ${filterParts.join(' | ')}` : 'Filter: Semua data';
    doc.text(filterText, margin, 35);
    doc.text(`Total Data: ${records.length} record`, margin, 40);

    // Table 1: Iktisar (Summary)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Iktisar', margin, 48);

    autoTable(doc, {
      startY: 50,
      head: [['Indikator', 'Nilai']],
      body: [
        ['Total Produksi (Kg)', formatNumber(totalProduction)],
        ['Total Nilai Produksi (Rp)', formatNumber(totalValue)],
        ['Total RTP', formatNumber(totalRtp)],
        ['Total Pembudidaya', formatNumber(totalFarmer)],
        ['Total Kelompok', formatNumber(totalGroup)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: margin, right: margin },
      tableWidth: usableWidth * 0.6,
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    });

    // Table 2: Produksi Per Kecamatan
    const currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Produksi Per Kecamatan', margin, currentY);

    autoTable(doc, {
      startY: currentY + 2,
      head: [['No', 'Kecamatan', 'Produksi (Kg)', 'Nilai (Rp)', 'RTP', 'Pembudidaya', 'Kelompok']],
      body: Object.entries(kecDetail).map(([kec, d], i) => [
        i + 1,
        kec,
        formatNumber(d.production),
        formatNumber(d.value),
        formatNumber(d.rtp),
        formatNumber(d.farmer),
        formatNumber(d.group),
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
      },
    });

    // Table 3: Target vs Realisasi (new page)
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DINAS PERIKANAN KABUPATEN MEMPAWAH', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Target vs Realisasi Produksi Per Jenis Ikan', pageWidth / 2, 22, { align: 'center' });

    autoTable(doc, {
      startY: 30,
      head: [['No', 'Jenis Ikan', 'Target (Kg)', 'Realisasi (Kg)', 'Persentase (%)']],
      body: Object.entries(targetRealisasi).map(([fish, d], i) => [
        i + 1,
        fish,
        formatNumber(d.target),
        formatNumber(d.realisasi),
        d.target > 0 ? `${((d.realisasi / d.target) * 100).toFixed(2)}%` : '0%',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: margin, right: margin },
      tableWidth: usableWidth * 0.7,
      columnStyles: {
        0: { halign: 'center' },
        1: {},
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
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
