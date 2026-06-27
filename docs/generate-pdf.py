#!/usr/bin/env python3
"""Generate PDF documentation for the Disagregasi Distribution Workflow."""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image
)
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics import renderPDF

# ─── Colors ──────────────────────────────────────────────────────────────────
CYAN_DARK = HexColor('#0891B2')
CYAN = HexColor('#06B6D4')
CYAN_LIGHT = HexColor('#E0F7FA')
GREEN = HexColor('#22C55E')
AMBER = HexColor('#EAB308')
RED = HexColor('#EF4444')
GRAY_DARK = HexColor('#1E293B')
GRAY_MED = HexColor('#64748B')
GRAY_LIGHT = HexColor('#F1F5F9')
WHITE = HexColor('#FFFFFF')

# ─── Output path ─────────────────────────────────────────────────────────────
OUTPUT = '/home/z/my-project/docs/workflow-disagregasi-distribusi.pdf'

# ─── Styles ──────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'CustomTitle', parent=styles['Title'],
    fontSize=24, leading=30, textColor=CYAN_DARK,
    spaceAfter=6, alignment=TA_CENTER,
    fontName='Helvetica-Bold',
)

subtitle_style = ParagraphStyle(
    'CustomSubtitle', parent=styles['Normal'],
    fontSize=12, leading=16, textColor=GRAY_MED,
    spaceAfter=20, alignment=TA_CENTER,
    fontName='Helvetica',
)

h1_style = ParagraphStyle(
    'H1', parent=styles['Heading1'],
    fontSize=18, leading=24, textColor=CYAN_DARK,
    spaceBefore=20, spaceAfter=10,
    fontName='Helvetica-Bold',
    borderWidth=0, borderPadding=0,
)

h2_style = ParagraphStyle(
    'H2', parent=styles['Heading2'],
    fontSize=14, leading=18, textColor=GRAY_DARK,
    spaceBefore=14, spaceAfter=8,
    fontName='Helvetica-Bold',
)

h3_style = ParagraphStyle(
    'H3', parent=styles['Heading3'],
    fontSize=12, leading=16, textColor=CYAN,
    spaceBefore=10, spaceAfter=6,
    fontName='Helvetica-Bold',
)

body_style = ParagraphStyle(
    'Body', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=GRAY_DARK,
    spaceAfter=6, alignment=TA_JUSTIFY,
    fontName='Helvetica',
)

bullet_style = ParagraphStyle(
    'Bullet', parent=body_style,
    leftIndent=20, bulletIndent=10,
    spaceAfter=4,
)

numbered_style = ParagraphStyle(
    'Numbered', parent=body_style,
    leftIndent=20, bulletIndent=10,
    spaceAfter=4,
)

note_style = ParagraphStyle(
    'Note', parent=body_style,
    fontSize=9, leading=12, textColor=GRAY_MED,
    leftIndent=10, rightIndent=10,
    backColor=GRAY_LIGHT, borderPadding=6,
    spaceAfter=8,
)

caption_style = ParagraphStyle(
    'Caption', parent=body_style,
    fontSize=9, leading=12, textColor=GRAY_MED,
    alignment=TA_CENTER, spaceAfter=12,
)

# ─── Helper functions ────────────────────────────────────────────────────────

def heading1(text):
    return Paragraph(text, h1_style)

def heading2(text):
    return Paragraph(text, h2_style)

def heading3(text):
    return Paragraph(text, h3_style)

def body(text):
    return Paragraph(text, body_style)

def bullet(text):
    return Paragraph(f'\u2022  {text}', bullet_style)

def numbered(num, text):
    return Paragraph(f'<b>{num}.</b>  {text}', numbered_style)

def note(text):
    return Paragraph(f'<i>Catatan: {text}</i>', note_style)

def spacer(h=6):
    return Spacer(1, h * mm)

def colored_box(text, bg_color, text_color=white):
    """Create a colored info box."""
    style = ParagraphStyle(
        'Box', parent=body_style,
        textColor=text_color, fontSize=10,
        alignment=TA_CENTER, fontName='Helvetica-Bold',
    )
    p = Paragraph(text, style)
    t = Table([[p]], colWidths=[160 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return t

def step_header(step_num, title):
    """Create a step header with colored background."""
    style = ParagraphStyle(
        'StepHeader', parent=body_style,
        textColor=white, fontSize=13, leading=17,
        fontName='Helvetica-Bold',
    )
    p = Paragraph(f'Step {step_num}: {title}', style)
    t = Table([[p]], colWidths=[160 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CYAN_DARK),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('ROUNDEDCORNERS', [6, 6, 0, 0]),
    ]))
    return t

def info_table(data, col_widths=None):
    """Create a styled info table."""
    if col_widths is None:
        col_widths = [40 * mm, 120 * mm]
    
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), CYAN_LIGHT),
        ('TEXTCOLOR', (0, 0), (0, -1), CYAN_DARK),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('LEADING', (0, 0), (-1, -1), 13),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t

def flow_diagram():
    """Create a simple workflow flow diagram."""
    d = Drawing(500, 60)
    
    steps = [
        ('Password\nGate', CYAN_DARK),
        ('Input\nAgregat', CYAN),
        ('Distribusi\n& Balance', GREEN),
        ('Simpan', CYAN_DARK),
    ]
    
    x = 10
    box_w = 100
    box_h = 40
    gap = 30
    
    for i, (label, color) in enumerate(steps):
        # Box
        d.add(Rect(x, 10, box_w, box_h, fillColor=color, strokeColor=None, rx=6, ry=6))
        # Text
        lines = label.split('\n')
        for j, line in enumerate(lines):
            d.add(String(x + box_w/2, 10 + box_h - 14 - j*14, line,
                        fontSize=9, fillColor=white, textAnchor='middle',
                        fontName='Helvetica-Bold'))
        
        # Arrow
        if i < len(steps) - 1:
            arrow_x = x + box_w + 4
            d.add(Line(arrow_x, 30, arrow_x + gap - 8, 30,
                      strokeColor=GRAY_MED, strokeWidth=1.5))
            # Arrowhead
            d.add(Line(arrow_x + gap - 12, 34, arrow_x + gap - 4, 30,
                      strokeColor=GRAY_MED, strokeWidth=1.5))
            d.add(Line(arrow_x + gap - 12, 26, arrow_x + gap - 4, 30,
                      strokeColor=GRAY_MED, strokeWidth=1.5))
        
        x += box_w + gap
    
    return d

# ─── Build document ──────────────────────────────────────────────────────────

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=25 * mm,
    rightMargin=25 * mm,
    topMargin=25 * mm,
    bottomMargin=25 * mm,
)

story = []

# ═══════════════════════════════════════════════════════════════════════════════
# COVER
# ═══════════════════════════════════════════════════════════════════════════════

story.append(Spacer(1, 40 * mm))

# Title block
cover_title_style = ParagraphStyle(
    'CoverTitle', parent=styles['Title'],
    fontSize=28, leading=34, textColor=CYAN_DARK,
    alignment=TA_CENTER, fontName='Helvetica-Bold',
)
story.append(Paragraph('Workflow Disagregasi Distribusi', cover_title_style))
story.append(Spacer(1, 4 * mm))

cover_sub_style = ParagraphStyle(
    'CoverSub', parent=styles['Normal'],
    fontSize=14, leading=18, textColor=GRAY_MED,
    alignment=TA_CENTER, fontName='Helvetica',
)
story.append(Paragraph('Panduan Lengkap Alur Kerja Sistem Disagregasi Data', cover_sub_style))
story.append(Spacer(1, 8 * mm))

# Separator line
d = Drawing(160 * mm, 3)
d.add(Rect(0, 0, 160 * mm, 3, fillColor=CYAN, strokeColor=None, rx=1, ry=1))
story.append(d)
story.append(Spacer(1, 8 * mm))

# Info
cover_info_style = ParagraphStyle(
    'CoverInfo', parent=styles['Normal'],
    fontSize=11, leading=16, textColor=GRAY_DARK,
    alignment=TA_CENTER, fontName='Helvetica',
)
story.append(Paragraph('SIPBD - Sistem Informasi Perikanan Budidaya', cover_info_style))
story.append(Paragraph('Kabupaten Mempawah', cover_info_style))
story.append(Spacer(1, 6 * mm))
story.append(Paragraph('Dinas Pertanian, Ketahanan Pangan, dan Perikanan', cover_info_style))
story.append(Spacer(1, 15 * mm))

# Version info
cover_meta_style = ParagraphStyle(
    'CoverMeta', parent=styles['Normal'],
    fontSize=9, leading=13, textColor=GRAY_MED,
    alignment=TA_CENTER, fontName='Helvetica',
)
story.append(Paragraph('Versi 1.0  |  Maret 2026', cover_meta_style))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# TABLE OF CONTENTS (manual)
# ═══════════════════════════════════════════════════════════════════════════════

story.append(heading1('Daftar Isi'))
story.append(spacer(4))

toc_items = [
    ('1', 'Pendahuluan'),
    ('2', 'Gambaran Umum Workflow'),
    ('3', 'Step 0: Gerbang Password Admin'),
    ('4', 'Step 1: Input Data Agregat'),
    ('5', 'Step 2: Distribusi & Balance'),
    ('5.1', '    Indikator Balance'),
    ('5.2', '    Hierarki Balance Editor'),
    ('5.3', '    Adjust By: Kecamatan/Desa/Kelompok/Ikan/Wadah'),
    ('5.4', '    Tabel Distribusi Petani'),
    ('5.5', '    Tambah Pembudidaya Baru'),
    ('6', 'Step 3: Simpan ke Database'),
    ('7', 'Fitur Hierarki Balance (Detail)'),
    ('7.1', '    Konsep Distribusi Top-Down'),
    ('7.2', '    Menambahkan Dimensi'),
    ('7.3', '    Drill-Down & Breadcrumb'),
    ('7.4', '    Edit Nilai Manual (Kg & %)'),
    ('7.5', '    Force Balance Proporsional'),
    ('7.6', '    Save Sementara & Apply'),
    ('8', 'Skenario Penggunaan'),
    ('9', 'Ringkasan'),
]

toc_style = ParagraphStyle(
    'TOC', parent=body_style,
    fontSize=10, leading=18, textColor=GRAY_DARK,
)

for num, label in toc_items:
    indent = 10 if num.count('.') > 0 else 0
    s = ParagraphStyle('toc_item', parent=toc_style, leftIndent=indent)
    bold = '<b>' if '.' not in num else ''
    bold_end = '</b>' if '.' not in num else ''
    story.append(Paragraph(f'{bold}{num}{bold_end}  {label}', s))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# 1. PENDAHULUAN
# ═══════════════════════════════════════════════════════════════════════════════

story.append(heading1('1. Pendahuluan'))
story.append(body(
    'Disagregasi data adalah proses penguraian data agregat (data bersifat kumpulan/total) menjadi data yang lebih rinci '
    'pada level individu atau kelompok kecil. Dalam konteks perikanan budidaya di Kabupaten Mempawah, disagregasi data '
    'produksi digunakan untuk mendistribusikan total produksi agregat yang bersumber dari BPS atau dinas terkait ke dalam '
    'data per-pembudidaya yang lebih detail dan akurat.'
))
story.append(body(
    'Sistem Disagregasi Data pada SIPBD (Sistem Informasi Perikanan Budidaya) menyediakan alur kerja terstruktur '
    'yang memungkinkan administrator untuk memasukkan data agregat, mendistribusikannya secara proporsional ke '
    'pembudidaya yang ada, menyesuaikan distribusi menggunakan berbagai dimensi (Kecamatan, Desa, Kelompok, '
    'Jenis Ikan, Jenis Wadah), memastikan keseimbangan (balance) antara total agregat dan distribusi, serta '
    'menyimpan hasil akhir ke database.'
))
story.append(body(
    'Dokumen ini menjelaskan secara lengkap dan detail setiap langkah dalam alur kerja disagregasi distribusi, '
    'termasuk fitur Hierarki Balance Editor yang memungkinkan distribusi top-down dengan kontrol penuh pada setiap '
    'level dimensi.'
))

# ═══════════════════════════════════════════════════════════════════════════════
# 2. GAMBARAN UMUM WORKFLOW
# ═══════════════════════════════════════════════════════════════════════════════

story.append(heading1('2. Gambaran Umum Workflow'))
story.append(body(
    'Alur kerja disagregasi distribusi terdiri dari 4 tahap utama yang harus dilalui secara berurutan. '
    'Setiap tahap memiliki fungsi dan validasi tersendiri untuk memastikan integritas data.'
))
story.append(spacer(4))
story.append(flow_diagram())
story.append(Paragraph('Gambar 1: Alur Kerja Utama Disagregasi Distribusi', caption_style))
story.append(spacer(4))

# Step overview table
overview_data = [
    [Paragraph('<b>Tahap</b>', body_style), Paragraph('<b>Nama</b>', body_style), 
     Paragraph('<b>Fungsi</b>', body_style)],
    ['0', 'Gerbang Password', 'Verifikasi akses admin sebelum masuk ke sistem'],
    ['1', 'Input Agregat', 'Memasukkan parameter dan total produksi agregat'],
    ['2', 'Distribusi', 'Mendistribusikan nilai ke pembudidaya dengan fitur balance & adjust'],
    ['3', 'Simpan', 'Konfirmasi dan penyimpanan hasil disagregasi ke database'],
]
overview_table = Table(overview_data, colWidths=[15*mm, 35*mm, 110*mm])
overview_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), CYAN_DARK),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('LEADING', (0, 0), (-1, -1), 13),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_LIGHT]),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(overview_table)
story.append(Paragraph('Tabel 1: Ringkasan Tahapan Workflow', caption_style))

# ═══════════════════════════════════════════════════════════════════════════════
# 3. STEP 0
# ═══════════════════════════════════════════════════════════════════════════════

story.append(heading1('3. Step 0: Gerbang Password Admin'))
story.append(body(
    'Sebelum dapat mengakses fitur disagregasi data, pengguna harus memasukkan sandi admin yang telah '
    'ditentukan sebelumnya. Langkah ini bertujuan untuk membatasi akses hanya kepada personil yang berwenang '
    'di Dinas Pertanian, Ketahanan Pangan, dan Perikanan Kabupaten Mempawah. Tanpa sandi yang benar, '
    'pengguna tidak dapat melanjutkan ke tahap berikutnya.'
))
story.append(bullet('Ketik sandi admin pada kolom yang tersedia'))
story.append(bullet('Tekan tombol "Masuk" atau tekan Enter'))
story.append(bullet('Jika sandi salah, pesan error "Password salah!" akan ditampilkan'))
story.append(bullet('Jika sandi benar, pengguna akan masuk ke Step 1'))
story.append(note('Sandi default dapat diubah melalui tab "Pengaturan Password" di panel admin.'))

# ═══════════════════════════════════════════════════════════════════════════════
# 4. STEP 1
# ═══════════════════════════════════════════════════════════════════════════════

story.append(heading1('4. Step 1: Input Data Agregat'))
story.append(body(
    'Pada tahap ini, administrator memasukkan parameter pencarian dan total produksi agregat yang akan '
    'didistribusikan. Sistem menggunakan parameter ini untuk mencari data pembudidaya yang sesuai dari database '
    'dan menghitung distribusi proporsional berdasarkan riwayat produksi.'
))

story.append(heading2('4.1 Parameter Input'))
story.append(body('Berikut adalah parameter yang harus diisi pada form input agregat:'))

input_data = [
    [Paragraph('<b>Parameter</b>', body_style), Paragraph('<b>Tipe</b>', body_style),
     Paragraph('<b>Keterangan</b>', body_style)],
    ['Tahun', 'Angka', 'Tahun produksi (2000-2100), contoh: 2026'],
    ['Triwulan', 'Dropdown', 'Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Okt-Des)'],
    ['Kecamatan', 'Multi-select', 'Pilih satu atau lebih kecamatan di Mempawah'],
    ['Jenis Usaha', 'Radio', 'Pembesaran atau Pembenihan'],
    ['Jenis Ikan', 'Multi-select', 'Pilih satu atau lebih jenis ikan (Nila, Mas, Lele, dll.)'],
    ['Wadah Budidaya', 'Multi-select', 'Pilih satu atau lebih jenis wadah (Kolam, Karamba, dll.)'],
    ['Kelompok', 'Multi-select', 'Opsional - filter per kelompok pembudidaya'],
    ['Total Produksi', 'Angka', 'Total produksi agregat dalam Kg (Pembesaran) atau Ekor (Pembenihan)'],
]
input_table = Table(input_data, colWidths=[35*mm, 25*mm, 100*mm])
input_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), CYAN_DARK),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('LEADING', (0, 0), (-1, -1), 13),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_LIGHT]),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
]))
story.append(input_table)
story.append(Paragraph('Tabel 2: Parameter Input Agregat', caption_style))

story.append(heading2('4.2 Proses Distribusi Awal'))
story.append(body(
    'Setelah semua parameter terisi, klik tombol "Cari Pembudidaya & Distribusikan". Sistem akan: '
    '(1) Mencari pembudidaya di database yang sesuai dengan filter kecamatan, jenis ikan, jenis wadah, '
    'dan jenis usaha; (2) Menghitung proporsi masing-masing pembudidaya berdasarkan riwayat produksi '
    'dari periode referensi (triwulan yang sama di tahun sebelumnya, atau tahun terakhir yang tersedia); '
    '(3) Mendistribusikan total produksi agregat secara proporsional ke setiap pembudidaya; '
    '(4) Menampilkan tabel distribusi di Step 2.'
))

# ═══════════════════════════════════════════════════════════════════════════════
# 5. STEP 2
# ═══════════════════════════════════════════════════════════════════════════════

story.append(heading1('5. Step 2: Distribusi & Balance'))
story.append(body(
    'Tahap ini merupakan inti dari proses disagregasi. Di sini administrator dapat melihat, menyesuaikan, '
    'dan memastikan keseimbangan distribusi sebelum disimpan. Tahap ini menyediakan berbagai fitur untuk '
    'mengontrol distribusi dengan presisi tinggi.'
))

# 5.1 Balance Indicator
story.append(heading2('5.1 Indikator Balance'))
story.append(body(
    'Indikator balance menampilkan perbandingan antara total nilai yang terdistribusi (sum of finalQty) '
    'dengan total agregat (totalQty). Status balance menentukan apakah distribusi sudah seimbang:'
))

balance_data = [
    [Paragraph('<b>Status</b>', body_style), Paragraph('<b>Kondisi</b>', body_style),
     Paragraph('<b>Indikator</b>', body_style)],
    ['Seimbang', 'Selisih < 0.01', 'Hijau dengan tanda centang'],
    ['Tidak Seimbang', 'Selisih >= 0.01', 'Kuning/amber dengan nilai selisih'],
]
balance_table = Table(balance_data, colWidths=[35*mm, 40*mm, 85*mm])
balance_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), CYAN_DARK),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('LEADING', (0, 0), (-1, -1), 13),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_LIGHT]),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(balance_table)
story.append(Paragraph('Tabel 3: Status Indikator Balance', caption_style))

story.append(body(
    'Di sebelah indikator balance terdapat tombol "Hierarki Balance" yang membuka editor hierarki '
    'untuk distribusi top-down yang lebih terstruktur (dijelaskan di Bab 7).'
))

# 5.2 Hierarki Balance Editor
story.append(heading2('5.2 Hierarki Balance Editor'))
story.append(body(
    'Hierarki Balance Editor adalah fitur yang memungkinkan distribusi nilai agregat secara top-down '
    'berdasarkan dimensi-dimensi yang dapat dipilih secara bebas. Fitur ini diakses dengan mengklik '
    'tombol "Hierarki Balance" pada indikator balance. Penjelasan detail mengenai fitur ini tersedia '
    'di Bab 7.'
))

# 5.3 Adjust By
story.append(heading2('5.3 Adjust By: Kecamatan / Desa / Kelompok / Ikan / Wadah'))
story.append(body(
    'Fitur "Adjust By" memungkinkan administrator untuk menerapkan penyesuaian persentase (%) secara '
    'selektif berdasarkan dimensi tertentu. Alur kerjanya adalah sebagai berikut:'
))

story.append(numbered(1, 'Pilih mode "Adjust by" - tersedia 6 pilihan: Semua, Kecamatan, Desa, Kelompok, Jenis Ikan, Jenis Wadah'))
story.append(numbered(2, 'Jika memilih selain "Semua", pilih target spesifik dari dropdown (misalnya: Kecamatan Anjongan)'))
story.append(numbered(3, 'Masukkan nilai persentase penyesuaian (misalnya: +5 atau -10)'))
story.append(numbered(4, 'Klik "Terapkan" untuk menerapkan penyesuaian'))
story.append(body(
    'Sistem akan menerapkan persentase adjustment hanya ke pembudidaya yang sesuai dengan target yang '
    'dipilih. Baris yang terkena adjustment akan ditandai dengan warna latar belakang cyan dan dot indicator. '
    'Setelah adjustment diterapkan, sistem otomatis menghitung ulang distribusi agar tetap balance.'
))

# 5.4 Tabel Distribusi
story.append(heading2('5.4 Tabel Distribusi Petani'))
story.append(body(
    'Tabel distribusi menampilkan seluruh pembudidaya yang menerima alokasi beserta detail berikut:'
))

table_col_data = [
    [Paragraph('<b>Kolom</b>', body_style), Paragraph('<b>Keterangan</b>', body_style)],
    ['No', 'Nomor urut'],
    ['Nama', 'Nama pembudidaya'],
    ['Kelompok', 'Nama kelompok pembudidaya'],
    ['Kecamatan / Desa', 'Lokasi administratif'],
    ['Ikan / Wadah', 'Jenis ikan dan wadah budidaya'],
    ['Riwayat', 'Produksi dari periode referensi'],
    ['Proporsi', 'Persentase alokasi dari total'],
    ['Alokasi', 'Nilai alokasi awal (editable)'],
    ['Adj (%)', 'Persentase penyesuaian (editable)'],
    ['Nilai Akhir', 'Hasil akhir setelah adjustment'],
]
table_col_table = Table(table_col_data, colWidths=[35*mm, 125*mm])
table_col_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), CYAN_DARK),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('LEADING', (0, 0), (-1, -1), 13),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_LIGHT]),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
]))
story.append(table_col_table)
story.append(Paragraph('Tabel 4: Kolom-kolom Tabel Distribusi Petani', caption_style))

# 5.5 Tambah Pembudidaya
story.append(heading2('5.5 Tambah Pembudidaya Baru'))
story.append(body(
    'Administrator dapat menambahkan pembudidaya baru yang tidak ada di database dengan mengklik tombol '
    '"Tambah Pembudidaya Baru". Form inline akan muncul di bawah tabel distribusi untuk mengisi nama, '
    'kelompok, desa, dan alokasi. Pembudidaya baru akan ditandai dengan badge "BARU" berwarna cyan. '
    'Sistem akan mengalokasikan nilai dari pembudidaya yang ada untuk memberi ruang bagi pembudidaya baru.'
))

# ═══════════════════════════════════════════════════════════════════════════════
# 6. STEP 3
# ═══════════════════════════════════════════════════════════════════════════════

story.append(heading1('6. Step 3: Simpan ke Database'))
story.append(body(
    'Tahap akhir adalah konfirmasi dan penyimpanan hasil disagregasi. Halaman ini menampilkan ringkasan '
    'distribusi yang mencakup periode, jenis usaha, total agregat, jumlah pembudidaya, total terdistribusi, '
    'dan selisih (balance). Administrator juga dapat menambahkan catatan opsional untuk batch ini.'
))
story.append(body('Untuk menyimpan, administrator harus:'))
story.append(numbered(1, 'Meninjau ringkasan distribusi yang ditampilkan'))
story.append(numbered(2, 'Opsional: menambahkan catatan di kolom "Catatan"'))
story.append(numbered(3, 'Memasukkan kembali sandi admin untuk konfirmasi'))
story.append(numbered(4, 'Mengklik "Simpan ke Database"'))
story.append(body(
    'Selain menyimpan, administrator juga dapat mengekspor data ke format Excel (.xlsx) pada tahap ini. '
    'File Excel akan berisi semua data distribusi lengkap dengan baris total di bagian bawah.'
))

# ═══════════════════════════════════════════════════════════════════════════════
# 7. FITUR HIERARKI BALANCE
# ═══════════════════════════════════════════════════════════════════════════════

story.append(heading1('7. Fitur Hierarki Balance (Detail)'))
story.append(body(
    'Hierarki Balance Editor adalah fitur canggih yang memungkinkan distribusi nilai agregat secara '
    'top-down dengan kontrol penuh. Berbeda dengan metode "Adjust By" yang bekerja bottom-up (mengubah '
    'persentase di level petani), Hierarki Balance bekerja top-down (membagi nilai dari total ke dimensi-dimensi).'
))

# 7.1 Konsep
story.append(heading2('7.1 Konsep Distribusi Top-Down'))
story.append(body(
    'Konsep utama dari Hierarki Balance adalah membagi total agregat secara bertahap melalui dimensi-dimensi '
    'yang dapat dipilih secara bebas. Sebagai contoh, jika Total Produksi Q1 = 1.800 Kg, administrator dapat '
    'membaginya berdasarkan dimensi Kecamatan terlebih dahulu, kemudian membagi masing-masing kecamatan '
    'berdasarkan Jenis Ikan, dan seterusnya.'
))

story.append(body('Contoh alur distribusi:'))
example_data = [
    ['Level', 'Dimensi', 'Nilai'],
    ['Root', 'Total Produksi Q1', '1.800 Kg'],
    ['  Level 1', 'Kec. A = 500 | Kec. B = 700 | Kec. C = 600', ''],
    ['    Level 2', 'Kec. A: Ikan Nila = 200 | Ikan Mas = 300', ''],
    ['      Level 3', 'Kec. A, Nila: Kolam = 120 | Karamba = 80', ''],
]
example_table = Table(example_data, colWidths=[20*mm, 110*mm, 30*mm])
example_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), CYAN_DARK),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('LEADING', (0, 0), (-1, -1), 13),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_LIGHT]),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(example_table)
story.append(Paragraph('Tabel 5: Contoh Alur Distribusi Top-Down', caption_style))

story.append(body(
    'Dimensi yang tersedia adalah: Kecamatan, Desa, Kelompok, Jenis Ikan, dan Jenis Wadah. '
    'Urutan dimensi tidak harus berurutan - administrator dapat memulai dari dimensi mana saja, '
    'melewati dimensi tertentu, atau mengubah urutan sesuai kebutuhan. Setiap dimensi yang sudah '
    'digunakan tidak akan muncul lagi di dropdown "Tambah Dimensi".'
))

# 7.2 Menambahkan Dimensi
story.append(heading2('7.2 Menambahkan Dimensi'))
story.append(body(
    'Untuk menambahkan dimensi ke level yang sedang aktif, gunakan dropdown "+ Tambah Dimensi" '
    'di bagian atas tabel. Saat dimensi ditambahkan, sistem akan otomatis mendistribusikan nilai '
    'secara proporsional berdasarkan data riwayat produksi pembudidaya yang ada. Dimensi juga dapat '
    'dihapus dengan mengklik tombol "Hapus Dimensi" atau mengklik chip dimensi dengan tanda "x" '
    'di bagian bawah tabel.'
))

# 7.3 Drill-Down & Breadcrumb
story.append(heading2('7.3 Drill-Down & Breadcrumb Navigation'))
story.append(body(
    'Untuk masuk ke level yang lebih dalam (drill-down), klik pada baris di tabel. Jika baris tersebut '
    'sudah memiliki sub-dimensi, akan muncul ikon panah kanan (>). Jika belum memiliki sub-dimensi, '
    'akan muncul ikon plus (+) yang menandakan baris tersebut dapat di-klik untuk menambahkan sub-dimensi. '
    'Navigasi breadcrumb di bagian atas menampilkan jalur dari root hingga level saat ini. Klik pada '
    'breadcrumb untuk kembali ke level sebelumnya.'
))

# 7.4 Edit Manual
story.append(heading2('7.4 Edit Nilai Manual (Kg & %)'))
story.append(body(
    'Nilai di setiap level dapat diedit secara manual melalui dua cara: '
    '(1) Klik pada kolom "Nilai (Kg)" untuk mengedit langsung dalam satuan Kilogram/Ekor; '
    '(2) Klik pada kolom "% Proporsi" untuk mengedit persentase proporsi, di mana sistem akan otomatis '
    'menghitung ulang nilai Kg berdasarkan persentase baru (Nilai Kg = % x Total Parent). '
    'Baris yang telah diedit manual akan ditandai dengan dot indicator berwarna cyan dan latar belakang '
    'yang sedikit berwarna cyan.'
))

# 7.5 Force Balance
story.append(heading2('7.5 Force Balance Proporsional'))
story.append(body(
    'Ketika nilai anak-anak (children) tidak sama dengan nilai parent, indikator balance akan berubah '
    'kuning dan tombol "Force Balance (Proporsional)" akan muncul. Jika diklik, sistem akan '
    'mendistribusikan selisih secara proporsional berdasarkan nilai yang sudah ada. Contoh: jika parent = 1.000 '
    'dan total children = 900 (selisih = 100), maka setiap child akan mendapatkan tambahan '
    'proporsional sesuai proporsinya terhadap total children. Tombol "Force Balance Semua" melakukan '
    'hal yang sama untuk seluruh tree dari root hingga leaf.'
))

# 7.6 Save & Apply
story.append(heading2('7.6 Save Sementara & Apply ke Tabel Petani'))
story.append(body(
    'Tombol "Save Sementara" menyimpan state hierarki ke localStorage browser, sehingga administrator '
    'dapat melanjutkan di lain waktu tanpa kehilangan progress. Draft akan otomatis di-restore saat '
    'editor dibuka kembali dengan parameter form yang sama. Tombol "Apply ke Tabel Petani" menerapkan '
    'seluruh nilai dari hierarki ke tabel distribusi petani. Sistem akan memetakan setiap leaf node '
    'ke pembudidaya yang sesuai berdasarkan dimensi-dimensi yang digunakan, kemudian membagi nilai '
    'leaf node secara proporsional di antara pembudidaya yang cocok berdasarkan riwayat produksi.'
))

# ═══════════════════════════════════════════════════════════════════════════════
# 8. SKENARIO PENGGUNAAN
# ═══════════════════════════════════════════════════════════════════════════════

story.append(heading1('8. Skenario Penggunaan'))
story.append(body(
    'Berikut adalah beberapa skenario penggunaan umum untuk fitur disagregasi distribusi:'
))

story.append(heading2('Skenario 1: Distribusi Sederhana'))
story.append(body(
    'Admin memasukkan Total Produksi Q1 = 10.000 Kg untuk Pembesaran di seluruh kecamatan. '
    'Sistem mendistribusikan secara proporsional ke 11 pembudidaya berdasarkan riwayat produksi. '
    'Tidak ada penyesuaian yang diperlukan karena distribusi sudah balance. Langsung simpan ke database.'
))

story.append(heading2('Skenario 2: Distribusi dengan Hierarki Balance'))
story.append(body(
    'Admin ingin memastikan distribusi per kecamatan sesuai dengan target. Langkah-langkah: '
    '(1) Buka Hierarki Balance, tambah dimensi Kecamatan; '
    '(2) Sesuaikan nilai per kecamatan (misal: Kec. Anjongan dari 628 menjadi 800 Kg); '
    '(3) Force Balance untuk menyesuaikan kecamatan lain secara proporsional; '
    '(4) Drill-down ke kecamatan tertentu, tambah dimensi Jenis Ikan; '
    '(5) Sesuaikan distribusi ikan per kecamatan; '
    '(6) Apply ke Tabel Petani; '
    '(7) Simpan ke database.'
))

story.append(heading2('Skenario 3: Adjust Berdasarkan Dimensi'))
story.append(body(
    'Admin ingin menaikkan produksi kelompok tertentu sebesar 10%. Langkah: '
    '(1) Pilih Adjust By: Kelompok; '
    '(2) Pilih target kelompok dari dropdown; '
    '(3) Masukkan +10 di kolom persentase; '
    '(4) Klik Terapkan; '
    '(5) Sistem otomatis menghitung ulang distribusi agar tetap balance.'
))

# ═══════════════════════════════════════════════════════════════════════════════
# 9. RINGKASAN
# ═══════════════════════════════════════════════════════════════════════════════

story.append(heading1('9. Ringkasan'))
story.append(body(
    'Sistem disagregasi distribusi SIPBD menyediakan alur kerja yang lengkap dan terstruktur untuk '
    'menguraikan data agregat menjadi data per-pembudidaya. Dengan fitur-fitur seperti Hierarki Balance '
    'Editor, Adjust By multi-dimensi, dan Force Balance proporsional, administrator memiliki kontrol '
    'penuh atas proses distribusi sambil tetap memastikan integritas dan keseimbangan data.'
))

# Feature summary table
feat_data = [
    [Paragraph('<b>Fitur</b>', body_style), Paragraph('<b>Fungsi</b>', body_style)],
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
]
feat_table = Table(feat_data, colWidths=[45*mm, 115*mm])
feat_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), CYAN_DARK),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('LEADING', (0, 0), (-1, -1), 13),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_LIGHT]),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(feat_table)
story.append(Paragraph('Tabel 6: Ringkasan Fitur Disagregasi Distribusi', caption_style))

# ─── Build PDF ───────────────────────────────────────────────────────────────

def add_page_number(canvas, doc):
    """Add page number footer."""
    page_num = canvas.getPageNumber()
    if page_num > 1:  # Skip cover page
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(GRAY_MED)
        canvas.drawCentredString(A4[0] / 2, 15 * mm, f'Halaman {page_num}')
        # Header line
        canvas.setStrokeColor(HexColor('#E2E8F0'))
        canvas.setLineWidth(0.5)
        canvas.line(25 * mm, A4[1] - 20 * mm, A4[0] - 25 * mm, A4[1] - 20 * mm)
        # Footer line
        canvas.line(25 * mm, 20 * mm, A4[0] - 25 * mm, 20 * mm)
        # Header text
        canvas.setFont('Helvetica', 7)
        canvas.drawString(25 * mm, A4[1] - 18 * mm, 'SIPBD - Workflow Disagregasi Distribusi')
        canvas.drawRightString(A4[0] - 25 * mm, A4[1] - 18 * mm, 'Kabupaten Mempawah')
        canvas.restoreState()

doc.build(story, onFirstPage=lambda c, d: None, onLaterPages=add_page_number)
print(f'PDF generated: {OUTPUT}')
print(f'Size: {os.path.getsize(OUTPUT) / 1024:.1f} KB')
