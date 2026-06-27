const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        WidthType, AlignmentType, HeadingLevel, BorderStyle, 
        PageBreak, ShadingType, TableLayoutType } = require('docx');
const fs = require('fs');

// ─── Colors ──────────────────────────────────────────────────────────────────
const CYAN_DARK = '0891B2';
const CYAN = '06B6D4';
const CYAN_LIGHT = 'E0F7FA';
const GREEN = '22C55E';
const AMBER = 'EAB308';
const GRAY_DARK = '1E293B';
const GRAY_MED = '64748B';
const GRAY_LIGHT = 'F1F5F9';

// ─── Helper: Create a styled paragraph ──────────────────────────────────────

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, color: CYAN_DARK, font: 'Calibri' })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 28, color: GRAY_DARK, font: 'Calibri' })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: CYAN, font: 'Calibri' })],
  });
}

function bodyText(text) {
  return new Paragraph({
    spacing: { after: 120, line: 312 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, size: 20, color: GRAY_DARK, font: 'Calibri' })],
  });
}

function bulletItem(text) {
  return new Paragraph({
    spacing: { after: 80, line: 312 },
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 20, color: GRAY_DARK, font: 'Calibri' })],
  });
}

function numberedItem(num, text) {
  return new Paragraph({
    spacing: { after: 80, line: 312 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: `${num}. `, bold: true, size: 20, color: GRAY_DARK, font: 'Calibri' }),
      new TextRun({ text, size: 20, color: GRAY_DARK, font: 'Calibri' }),
    ],
  });
}

function noteBox(text) {
  return new Paragraph({
    spacing: { after: 150 },
    indent: { left: 180, right: 180 },
    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
    children: [
      new TextRun({ text: 'Catatan: ', bold: true, italics: true, size: 18, color: GRAY_MED, font: 'Calibri' }),
      new TextRun({ text, italics: true, size: 18, color: GRAY_MED, font: 'Calibri' }),
    ],
  });
}

function captionText(text) {
  return new Paragraph({
    spacing: { before: 60, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, italics: true, size: 18, color: GRAY_MED, font: 'Calibri' })],
  });
}

function spacer(pts = 100) {
  return new Paragraph({ spacing: { before: pts } });
}

// ─── Helper: Styled table ───────────────────────────────────────────────────

function createTable(headers, rows, colWidths) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: colWidths ? { size: colWidths[i], type: WidthType.PERCENTAGE } : undefined,
      shading: { type: ShadingType.CLEAR, fill: CYAN_DARK },
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, size: 18, color: 'FFFFFF', font: 'Calibri' })],
      })],
    })),
  });

  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      width: colWidths ? { size: colWidths[ci], type: WidthType.PERCENTAGE } : undefined,
      shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? 'FFFFFF' : GRAY_LIGHT },
      children: [new Paragraph({
        children: [new TextRun({ text: String(cell), size: 18, color: GRAY_DARK, font: 'Calibri' })],
      })],
    })),
  }));

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  });
}

// ─── Build Document ─────────────────────────────────────────────────────────

const doc = new Document({
  creator: 'SIPBD',
  title: 'Workflow Disagregasi Distribusi',
  description: 'Panduan Lengkap Alur Kerja Sistem Disagregasi Data',
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 20, color: GRAY_DARK },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  sections: [
    // ═══════════════════════════════════════════════════════════════════════
    // COVER PAGE
    // ═══════════════════════════════════════════════════════════════════════
    {
      properties: {},
      children: [
        spacer(3000),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: 'Workflow Disagregasi Distribusi', bold: true, size: 56, color: CYAN_DARK, font: 'Calibri' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [new TextRun({ text: 'Panduan Lengkap Alur Kerja Sistem Disagregasi Data', size: 28, color: GRAY_MED, font: 'Calibri' })],
        }),
        spacer(200),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '\u2500'.repeat(50), size: 20, color: CYAN, font: 'Calibri' })],
        }),
        spacer(200),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: 'SIPBD - Sistem Informasi Perikanan Budidaya', size: 24, color: GRAY_DARK, font: 'Calibri' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: 'Kabupaten Mempawah', size: 24, color: GRAY_DARK, font: 'Calibri' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: 'Dinas Pertanian, Ketahanan Pangan, dan Perikanan', size: 22, color: GRAY_MED, font: 'Calibri' })],
        }),
        spacer(600),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Versi 1.0  |  Maret 2026', size: 18, color: GRAY_MED, font: 'Calibri' })],
        }),
      ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    // BODY
    // ═══════════════════════════════════════════════════════════════════════
    {
      properties: {},
      children: [
        // 1. PENDAHULUAN
        heading1('1. Pendahuluan'),
        bodyText('Disagregasi data adalah proses penguraian data agregat (data bersifat kumpulan/total) menjadi data yang lebih rinci pada level individu atau kelompok kecil. Dalam konteks perikanan budidaya di Kabupaten Mempawah, disagregasi data produksi digunakan untuk mendistribusikan total produksi agregat yang bersumber dari BPS atau dinas terkait ke dalam data per-pembudidaya yang lebih detail dan akurat.'),
        bodyText('Sistem Disagregasi Data pada SIPBD (Sistem Informasi Perikanan Budidaya) menyediakan alur kerja terstruktur yang memungkinkan administrator untuk memasukkan data agregat, mendistribusikannya secara proporsional ke pembudidaya yang ada, menyesuaikan distribusi menggunakan berbagai dimensi (Kecamatan, Desa, Kelompok, Jenis Ikan, Jenis Wadah), memastikan keseimbangan (balance) antara total agregat dan distribusi, serta menyimpan hasil akhir ke database.'),
        bodyText('Dokumen ini menjelaskan secara lengkap dan detail setiap langkah dalam alur kerja disagregasi distribusi, termasuk fitur Hierarki Balance Editor yang memungkinkan distribusi top-down dengan kontrol penuh pada setiap level dimensi.'),

        // 2. GAMBARAN UMUM
        heading1('2. Gambaran Umum Workflow'),
        bodyText('Alur kerja disagregasi distribusi terdiri dari 4 tahap utama yang harus dilalui secara berurutan. Setiap tahap memiliki fungsi dan validasi tersendiri untuk memastikan integritas data. Alur utama: Password Gate \u2192 Input Agregat \u2192 Distribusi & Balance \u2192 Simpan.'),
        createTable(
          ['Tahap', 'Nama', 'Fungsi'],
          [
            ['0', 'Gerbang Password', 'Verifikasi akses admin sebelum masuk ke sistem'],
            ['1', 'Input Agregat', 'Memasukkan parameter dan total produksi agregat'],
            ['2', 'Distribusi', 'Mendistribusikan nilai ke pembudidaya dengan fitur balance & adjust'],
            ['3', 'Simpan', 'Konfirmasi dan penyimpanan hasil disagregasi ke database'],
          ],
          [10, 25, 65],
        ),
        captionText('Tabel 1: Ringkasan Tahapan Workflow'),

        // 3. STEP 0
        heading1('3. Step 0: Gerbang Password Admin'),
        bodyText('Sebelum dapat mengakses fitur disagregasi data, pengguna harus memasukkan sandi admin yang telah ditentukan sebelumnya. Langkah ini bertujuan untuk membatasi akses hanya kepada personil yang berwenang di Dinas Pertanian, Ketahanan Pangan, dan Perikanan Kabupaten Mempawah. Tanpa sandi yang benar, pengguna tidak dapat melanjutkan ke tahap berikutnya.'),
        bulletItem('Ketik sandi admin pada kolom yang tersedia'),
        bulletItem('Tekan tombol "Masuk" atau tekan Enter'),
        bulletItem('Jika sandi salah, pesan error "Password salah!" akan ditampilkan'),
        bulletItem('Jika sandi benar, pengguna akan masuk ke Step 1'),
        noteBox('Sandi default dapat diubah melalui tab "Pengaturan Password" di panel admin.'),

        // 4. STEP 1
        heading1('4. Step 1: Input Data Agregat'),
        bodyText('Pada tahap ini, administrator memasukkan parameter pencarian dan total produksi agregat yang akan didistribusikan. Sistem menggunakan parameter ini untuk mencari data pembudidaya yang sesuai dari database dan menghitung distribusi proporsional berdasarkan riwayat produksi.'),
        heading2('4.1 Parameter Input'),
        bodyText('Berikut adalah parameter yang harus diisi pada form input agregat:'),
        createTable(
          ['Parameter', 'Tipe', 'Keterangan'],
          [
            ['Tahun', 'Angka', 'Tahun produksi (2000-2100), contoh: 2026'],
            ['Triwulan', 'Dropdown', 'Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Okt-Des)'],
            ['Kecamatan', 'Multi-select', 'Pilih satu atau lebih kecamatan di Mempawah'],
            ['Jenis Usaha', 'Radio', 'Pembesaran atau Pembenihan'],
            ['Jenis Ikan', 'Multi-select', 'Pilih satu atau lebih jenis ikan'],
            ['Wadah Budidaya', 'Multi-select', 'Pilih satu atau lebih jenis wadah'],
            ['Kelompok', 'Multi-select', 'Opsional - filter per kelompok'],
            ['Total Produksi', 'Angka', 'Total produksi agregat (Kg/Ekor)'],
          ],
          [20, 18, 62],
        ),
        captionText('Tabel 2: Parameter Input Agregat'),
        heading2('4.2 Proses Distribusi Awal'),
        bodyText('Setelah semua parameter terisi, klik tombol "Cari Pembudidaya & Distribusikan". Sistem akan: (1) Mencari pembudidaya di database yang sesuai dengan filter; (2) Menghitung proporsi masing-masing pembudidaya berdasarkan riwayat produksi dari periode referensi; (3) Mendistribusikan total produksi agregat secara proporsional ke setiap pembudidaya; (4) Menampilkan tabel distribusi di Step 2.'),

        // 5. STEP 2
        heading1('5. Step 2: Distribusi & Balance'),
        bodyText('Tahap ini merupakan inti dari proses disagregasi. Di sini administrator dapat melihat, menyesuaikan, dan memastikan keseimbangan distribusi sebelum disimpan.'),
        heading2('5.1 Indikator Balance'),
        bodyText('Indikator balance menampilkan perbandingan antara total nilai yang terdistribusi dengan total agregat. Status balance: Hijau (\u2713) = Seimbang (selisih < 0.01); Kuning (\u26A0) = Tidak Seimbang (menampilkan nilai selisih). Di sebelah indikator terdapat tombol "Hierarki Balance" untuk membuka editor distribusi top-down.'),
        heading2('5.2 Hierarki Balance Editor'),
        bodyText('Hierarki Balance Editor memungkinkan distribusi nilai agregat secara top-down berdasarkan dimensi-dimensi yang dapat dipilih secara bebas. Fitur ini diakses dengan mengklik tombol "Hierarki Balance" pada indikator balance. Penjelasan detail mengenai fitur ini tersedia di Bab 7.'),
        heading2('5.3 Adjust By: Kecamatan / Desa / Kelompok / Ikan / Wadah'),
        bodyText('Fitur "Adjust By" memungkinkan administrator untuk menerapkan penyesuaian persentase (%) secara selektif berdasarkan dimensi tertentu:'),
        numberedItem(1, 'Pilih mode "Adjust by" - tersedia 6 pilihan: Semua, Kecamatan, Desa, Kelompok, Jenis Ikan, Jenis Wadah'),
        numberedItem(2, 'Jika memilih selain "Semua", pilih target spesifik dari dropdown'),
        numberedItem(3, 'Masukkan nilai persentase penyesuaian (misalnya: +5 atau -10)'),
        numberedItem(4, 'Klik "Terapkan" untuk menerapkan penyesuaian'),
        bodyText('Baris yang terkena adjustment akan ditandai dengan warna latar belakang cyan dan dot indicator. Sistem otomatis menghitung ulang distribusi agar tetap balance.'),
        heading2('5.4 Tabel Distribusi Petani'),
        bodyText('Tabel distribusi menampilkan seluruh pembudidaya dengan kolom: No, Nama, Kelompok, Kecamatan, Desa, Ikan, Wadah, Riwayat, Proporsi, Alokasi (editable), Adj % (editable), dan Nilai Akhir. Kolom Alokasi dan Adj % dapat diedit langsung di tabel.'),
        heading2('5.5 Tambah Pembudidaya Baru'),
        bodyText('Administrator dapat menambahkan pembudidaya baru yang tidak ada di database dengan mengklik tombol "Tambah Pembudidaya Baru". Form inline akan muncul untuk mengisi nama, kelompok, desa, dan alokasi. Pembudidaya baru ditandai dengan badge "BARU" berwarna cyan.'),

        // 6. STEP 3
        heading1('6. Step 3: Simpan ke Database'),
        bodyText('Tahap akhir adalah konfirmasi dan penyimpanan hasil disagregasi. Halaman ini menampilkan ringkasan distribusi yang mencakup periode, jenis usaha, total agregat, jumlah pembudidaya, total terdistribusi, dan selisih (balance).'),
        bodyText('Untuk menyimpan, administrator harus:'),
        numberedItem(1, 'Meninjau ringkasan distribusi yang ditampilkan'),
        numberedItem(2, 'Opsional: menambahkan catatan di kolom "Catatan"'),
        numberedItem(3, 'Memasukkan kembali sandi admin untuk konfirmasi'),
        numberedItem(4, 'Mengklik "Simpan ke Database"'),
        bodyText('Selain menyimpan, administrator juga dapat mengekspor data ke format Excel (.xlsx) pada tahap ini.'),

        // 7. FITUR HIERARKI BALANCE
        heading1('7. Fitur Hierarki Balance (Detail)'),
        bodyText('Hierarki Balance Editor adalah fitur canggih yang memungkinkan distribusi nilai agregat secara top-down dengan kontrol penuh. Berbeda dengan metode "Adjust By" yang bekerja bottom-up, Hierarki Balance bekerja top-down (membagi nilai dari total ke dimensi-dimensi).'),
        heading2('7.1 Konsep Distribusi Top-Down'),
        bodyText('Konsep utama: membagi total agregat secara bertahap melalui dimensi-dimensi yang dapat dipilih secara bebas. Contoh: Total Q1 = 1.800 Kg \u2192 Kec. A = 500, Kec. B = 700, Kec. C = 600 \u2192 Kec. A: Ikan Nila = 200, Ikan Mas = 300 \u2192 Kec. A, Nila: Kolam = 120, Karamba = 80.'),
        bodyText('Dimensi yang tersedia: Kecamatan, Desa, Kelompok, Jenis Ikan, dan Jenis Wadah. Urutan dimensi tidak harus berurutan - administrator dapat memulai dari dimensi mana saja, melewati dimensi tertentu, atau mengubah urutan sesuai kebutuhan.'),
        heading2('7.2 Menambahkan Dimensi'),
        bodyText('Gunakan dropdown "+ Tambah Dimensi" di bagian atas tabel. Saat dimensi ditambahkan, sistem akan otomatis mendistribusikan nilai secara proporsional berdasarkan data riwayat produksi. Dimensi dapat dihapus dengan tombol "Hapus Dimensi" atau mengklik chip dimensi dengan tanda "\u00D7".'),
        heading2('7.3 Drill-Down & Breadcrumb Navigation'),
        bodyText('Klik pada baris di tabel untuk drill-down ke level lebih dalam. Jika baris sudah memiliki sub-dimensi, muncul ikon panah kanan (>). Jika belum, muncul ikon plus (+). Breadcrumb di bagian atas menampilkan jalur dari root hingga level saat ini. Klik breadcrumb untuk kembali ke level sebelumnya.'),
        heading2('7.4 Edit Nilai Manual (Kg & %)'),
        bodyText('Nilai di setiap level dapat diedit secara manual melalui dua cara: (1) Klik kolom "Nilai (Kg)" untuk mengedit langsung dalam satuan Kilogram/Ekor; (2) Klik kolom "% Proporsi" untuk mengedit persentase - sistem akan otomatis menghitung ulang nilai Kg berdasarkan persentase baru (Nilai Kg = % \u00D7 Total Parent). Baris yang diedit manual ditandai dengan dot indicator cyan.'),
        heading2('7.5 Force Balance Proporsional'),
        bodyText('Ketika nilai children tidak sama dengan parent, indikator balance berubah kuning dan tombol "Force Balance (Proporsional)" muncul. Sistem akan mendistribusikan selisih secara proporsional berdasarkan nilai yang sudah ada. Tombol "Force Balance Semua" melakukan hal yang sama untuk seluruh tree.'),
        heading2('7.6 Save Sementara & Apply ke Tabel Petani'),
        bodyText('"Save Sementara" menyimpan state hierarki ke localStorage browser untuk melanjutkan nanti. Draft otomatis di-restore saat editor dibuka kembali. "Apply ke Tabel Petani" menerapkan seluruh nilai hierarki ke tabel distribusi petani dengan memetakan leaf node ke pembudidaya yang sesuai.'),

        // 8. SKENARIO
        heading1('8. Skenario Penggunaan'),
        heading2('Skenario 1: Distribusi Sederhana'),
        bodyText('Admin memasukkan Total Produksi Q1 = 10.000 Kg untuk Pembesaran di seluruh kecamatan. Sistem mendistribusikan secara proporsional ke 11 pembudidaya berdasarkan riwayat produksi. Tidak ada penyesuaian yang diperlukan. Langsung simpan ke database.'),
        heading2('Skenario 2: Distribusi dengan Hierarki Balance'),
        bodyText('Admin ingin memastikan distribusi per kecamatan sesuai target. Langkah: (1) Buka Hierarki Balance, tambah dimensi Kecamatan; (2) Sesuaikan nilai per kecamatan; (3) Force Balance; (4) Drill-down, tambah dimensi Jenis Ikan; (5) Sesuaikan distribusi ikan; (6) Apply ke Tabel Petani; (7) Simpan ke database.'),
        heading2('Skenario 3: Adjust Berdasarkan Dimensi'),
        bodyText('Admin ingin menaikkan produksi kelompok tertentu sebesar 10%. Langkah: (1) Pilih Adjust By: Kelompok; (2) Pilih target kelompok; (3) Masukkan +10%; (4) Klik Terapkan; (5) Sistem otomatis menghitung ulang distribusi agar tetap balance.'),

        // 9. RINGKASAN
        heading1('9. Ringkasan'),
        bodyText('Sistem disagregasi distribusi SIPBD menyediakan alur kerja yang lengkap dan terstruktur untuk menguraikan data agregat menjadi data per-pembudidaya. Dengan fitur-fitur seperti Hierarki Balance Editor, Adjust By multi-dimensi, dan Force Balance proporsional, administrator memiliki kontrol penuh atas proses distribusi sambil tetap memastikan integritas dan keseimbangan data.'),
        createTable(
          ['Fitur', 'Fungsi'],
          [
            ['Gerbang Password', 'Keamanan akses admin'],
            ['Input Agregat', 'Parameter pencarian dan total produksi'],
            ['Distribusi Proporsional', 'Otomatis berdasarkan riwayat produksi'],
            ['Hierarki Balance', 'Distribusi top-down via 5 dimensi'],
            ['Edit Manual (Kg & %)', 'Penyesuaian nilai langsung'],
            ['Force Balance', 'Otomatisasi keseimbangan proporsional'],
            ['Adjust By', 'Penyesuaian selektif per dimensi'],
            ['Save Sementara', 'Penyimpanan draft di localStorage'],
            ['Apply ke Tabel', 'Penerapan nilai hierarki ke petani'],
            ['Export Excel', 'Ekspor data distribusi ke .xlsx'],
            ['Simpan ke Database', 'Penyimpanan permanen dengan konfirmasi sandi'],
          ],
          [35, 65],
        ),
        captionText('Tabel 3: Ringkasan Fitur Disagregasi Distribusi'),
      ],
    },
  ],
});

// ─── Generate DOCX ───────────────────────────────────────────────────────────

async function main() {
  const buffer = await Packer.toBuffer(doc);
  const outputPath = '/home/z/my-project/docs/workflow-disagregasi-distribusi.docx';
  fs.writeFileSync(outputPath, buffer);
  console.log(`DOCX generated: ${outputPath}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
