import { PrismaClient } from '@prisma/client';

// Load password from environment variable
const IMPORT_PASSWORD = process.env.ADMIN_PASSWORD || '';

const prisma = new PrismaClient();

// Indonesian month mapping
const MONTH_MAP: Record<string, number> = {
  Januari: 1,
  Februari: 2,
  Maret: 3,
  April: 4,
  Mei: 5,
  Juni: 6,
  Juli: 7,
  Agustus: 8,
  September: 9,
  Oktober: 10,
  November: 11,
  Desember: 12,
};

/**
 * Parse Indonesian date string like "13 April 2026" into a Date object.
 * Returns null if input is empty or "-".
 */
function parseIndonesianDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '-') return null;
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = MONTH_MAP[parts[1]];
  const year = parseInt(parts[2], 10);
  if (!month || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
}

interface KusukaRow {
  nama: string;
  provinsi: string;
  kabKota: string;
  kecamatan: string;
  kelDesa: string;
  noKusuka: string;
  namaKelompok: string;
  bentukUsaha: string;
  profesiUtama: string;
  alamat: string;
  tglDibuat: string;
  dibuatOleh: string;
  tglDiperbaharui: string;
  diperbaharuiOleh: string;
  divalidasiOleh: string;
  tglDivalidasi: string;
  statusKusuka: string;
}

// Tab-separated KUSUKA registration data (33 records)
const rawData: string = `
SAPTA MARGA     KALIMANTAN BARAT        MEMPAWAH        JONGKAT WAJOK HILIR     6102082004970001                Perseorangan    Subsektor Pembudidaya Ikan      Jalan Raya      13 April 2026   199512132022032003      13 April 2026   199512132022032000      hasto.priyarso  13 April 2026   Valid
HENDRI  KALIMANTAN BARAT        MEMPAWAH        JONGKAT WAJOK HILIR     6102081211000003                Perseorangan    Subsektor Pembudidaya Ikan      Komplek BTN Wajok Indah 13 April 2026   199512132022032003      13 April 2026   199512132022032000      hasto.priyarso  13 April 2026   Valid
TJHIA NJIT TJHAN        KALIMANTAN BARAT        MEMPAWAH        JONGKAT WAJOK HILIR     6102082704600004                Perseorangan    Subsektor Pembudidaya Ikan      Jl. Parit Haji Kadir    13 April 2026   199512132022032003      13 April 2026   199512132022032000      hasto.priyarso  13 April 2026   Valid
SAK PHIAU       KALIMANTAN BARAT        MEMPAWAH        JONGKAT WAJOK HILIR     6102081511840005                Perseorangan    Subsektor Pembudidaya Ikan      Jalan Raya      13 April 2026   199512132022032003      13 April 2026   199512132022032000      hasto.priyarso  13 April 2026   Valid
NANANG  KALIMANTAN BARAT        MEMPAWAH        JONGKAT WAJOK HILIR     6102080610820001                Perseorangan    Subsektor Pembudidaya Ikan      Jl. Raya Wajok Hilir    13 April 2026   199512132022032003      13 April 2026   199512132022032000      hasto.priyarso  13 April 2026   Valid
SANTO   KALIMANTAN BARAT        MEMPAWAH        JONGKAT WAJOK HILIR     6102081102880003                Perseorangan    Subsektor Pembudidaya Ikan      Jl. Komplek Wajok Indah 13 April 2026   199512132022032003      13 April 2026   199512132022032000      hasto.priyarso  13 April 2026   Valid
AGUSTONO        KALIMANTAN BARAT        MEMPAWAH        JONGKAT JUNGKAT 6102080508880004                Perseorangan    Subsektor Pembudidaya Ikan      Jl. Raya        13 April 2026   199512132022032003      13 April 2026   199512132022032000      hasto.priyarso  13 April 2026   Valid
DONI ILHAMSYAH  KALIMANTAN BARAT        MEMPAWAH        ANJONGAN        PAK BULU        6102162408980003                Perseorangan    Subsektor Pembudidaya Ikan      PERIKANAN       12 April 2026   lukman.m        12 April 2026   lukman.m        munziri.syarkawi        13 April 2026   Valid
NORMAN  KALIMANTAN BARAT        MEMPAWAH        ANJONGAN        KEPAYANG        6102162906850001                Perseorangan    Subsektor Pembudidaya Ikan      KEPAYANG        7 April 2026    lukman.m        7 April 2026    lukman.m        munziri.syarkawi        8 April 2026    Valid
BASIRUDDIN      KALIMANTAN BARAT        MEMPAWAH        JONGKAT WAJOK HILIR     6102080107700110                Perseorangan    Subsektor Pembudidaya Ikan      Jalan Simpang Empat     2 April 2026    199512132022032003      2 April 2026    199512132022032000      hasto.priyarso  2 April 2026    Valid
DESI SULASTRI   KALIMANTAN BARAT        MEMPAWAH        MEMPAWAH HILIR  TERUSAN 6109074512950001                Perseorangan    Subsektor Pemasaran Ikan        JL. ALFALAH RT 015 RW 008       29 Desember 2025        199104122022031002      29 Desember 2025        199104122022031000      munziri.syarkawi        29 Desember 2025        Valid
ROBY CANDRA     KALIMANTAN BARAT        MEMPAWAH        SUNGAI KUNYIT   SUNGAI KUNYIT LAUT      7472022303860005        POKDAKAN BERKAH BAHARI  Perseorangan    Subsektor Pembudidaya Ikan      JL. PENDIDIKAN RT 008 RW 004    17 November 2025        199104122022031002      17 November 2025        199104122022031000      munziri.syarkawi        17 November 2025        Valid
FERY    KALIMANTAN BARAT        MEMPAWAH        JONGKAT WAJOK HULU      6102081612960002        POKDAKAN WAJOK BERKARYA Perseorangan    Subsektor Pembudidaya Ikan      Jalan Teluk Dalam Gg Bersama    7 November 2025 199512132022032003      7 November 2025 199512132022032000      munziri.syarkawi        9 November 2025 Valid
DENI NURLI SANI KALIMANTAN BARAT        MEMPAWAH        SUNGAI PINYUH   SUNGAI PINYUH   6102070701780002        POKDAKAN SELIUNG PERKASA ABADI  Perseorangan    Subsektor Pembudidaya Ikan      JL. RAYA SELIUNG        31 Oktober 2025 utin.apridayani 31 Oktober 2025 utin.apridayani munziri.syarkawi        3 November 2025 Valid
JUMADI  KALIMANTAN BARAT        MEMPAWAH        JONGKAT JUNGKAT 6102082009650001        KARYA SEMULA    Perseorangan    Subsektor Penangkapan Ikan      JALAN PEJUANG RT 003 RW 002     19 Mei 2025     widy.rifhaldy   7 Juli 2025     widy.rifhaldy   susilawati.mpw  23 Juli 2025    Valid
SUHAMTO KALIMANTAN BARAT        MEMPAWAH        ANJONGAN        PAK BULU        6102161409670001        POKDAKAN MINA FAMILY    Perseorangan    Subsektor Pembudidaya Ikan      DESA PAK BULU   25 April 2025   lukman.m        25 April 2025   lukman.m        munziri.syarkawi        27 April 2025   Valid
BAHRUN  KALIMANTAN BARAT        MEMPAWAH        ANJONGAN        PAK BULU        6102161610740001        Perikanan Bersatu       Perseorangan    Subsektor Pembudidaya Ikan      PERIKANAN, RT.1, RW.1   1 Juni 2021     lukman.m        3 Desember 2025 lukman.m        munziri.syarkawi        13 April 2026   Valid
MUYYANA KALIMANTAN BARAT        MEMPAWAH        MEMPAWAH TIMUR  PASIR PALEMBANG 6102182002060001        POKDAKAN AR-RASYID      Perseorangan    Subsektor Pembudidaya Ikan      Jl. A Hamid HS Rt 12 / Rt. 06   12 Februari 2025        197510292006041010      10 Maret 2025   munziri.syarkawi        munziri.syarkawi        10 Maret 2025   Valid
Rheyhan Putra Basrendra KALIMANTAN BARAT        MEMPAWAH        SEGEDONG        PARIT BUGIS     6102152005060001                Perseorangan    Subsektor Pembudidaya Ikan      Jl. Parit Bugis Rt 007 RW 003   20 Maret 2025   widy.rifhaldy   21 Maret 2025   widy.rifhaldy   munziri.syarkawi        21 Maret 2025   Valid
BASRI KASIM     KALIMANTAN BARAT        MEMPAWAH        SEGEDONG        PARIT BUGIS     6102150707820004                Perseorangan    Subsektor Pembudidaya Ikan      Jl. Parit Bugis Rt 007 RW 003   20 Maret 2025   widy.rifhaldy   21 Maret 2025   widy.rifhaldy   munziri.syarkawi        21 Maret 2025   Valid
POKDAKAN SUKSES BERSAMA KALIMANTAN BARAT        MEMPAWAH        SUNGAI PINYUH   SUNGAI PINYUH   0210261029437773                Kelompok Masyarakat     Subsektor Pembudidaya Ikan      GANG USAHA II   6 Juni 2024     agung.laksono   6 Juni 2024     agung.laksono           -       Valid
YAYASAN AR-RASYID ANTIBAR       KALIMANTAN BARAT        MEMPAWAH        MEMPAWAH TIMUR  ANTIBAR 0070261022924623                Badan Usaha     Subsektor Pembudidaya Ikan      JL. BARDANNADI ANTIBAR  10 Februari 2022        roni.irama      7 Maret 2022    dadang.cahyono  197601242002121006      29 April 2025   Valid
KEPITING TANJUNG MANDIRI        KALIMANTAN BARAT        MEMPAWAH        MEMPAWAH HILIR  TANJUNG 0030261029841608                Kelompok Masyarakat     Subsektor Pembudidaya Ikan      Jl. Abu Bakar   19 April 2021   widy.rifhaldy   19 April 2021   widy.rifhaldy           -       Valid
ANAS    KALIMANTAN BARAT        MEMPAWAH        SUNGAI PINYUH   PENIRAMAN       0080261020000001                Badan Usaha     Subsektor Pembudidaya Ikan      Jl. Raya Paniraman Kecamatan    26 Maret 2019   bambang.sihananto       26 Maret 2019   bambang.sihananto               -       Valid
HARIRI  KALIMANTAN BARAT        MEMPAWAH        ANJONGAN        KEPAYANG        6102161212640002        UPR MELATI      Perseorangan    Subsektor Pembudidaya Ikan      bilado  17 Mei 2024     lukman.m        15 Januari 2026 lukman.m        munziri.syarkawi        13 April 2026   Valid
ENI SUHAENI     KALIMANTAN BARAT        MEMPAWAH        ANJONGAN        KEPAYANG        3276064905850005        UPR BAROKAH MANDIRI     Perseorangan    Subsektor Pembudidaya Ikan      PELADIS, RT.13, RW.3    30 Mei 2021     lukman.m        9 Oktober 2025  roni.irama              -       Draf
TOHIR   KALIMANTAN BARAT        MEMPAWAH        ANJONGAN        KEPAYANG        6102162705810001                Perseorangan    Subsektor Pembudidaya Ikan      PELADIS 30 Juli 2018    lukman.m        30 November 2018        lukman.m                -       Valid
ABDAN   KALIMANTAN BARAT        MEMPAWAH        SUNGAI KUNYIT   SUNGAI BUNDUNG LAUT     6101102703520001                Perseorangan    Subsektor Pembudidaya Ikan      DUSUN MAYA SARI 24 Juli 2023    dony.hartono    24 Juli 2023    dony.hartono            -       Draf
PD. Khatulistiwa Lestari        KALIMANTAN BARAT        MEMPAWAH        JONGKAT WAJOK HULU      0160261024182107                Badan Usaha     Subsektor Pembudidaya Ikan      Jl. Raya KM.7, Desa Wajok Hulu  4 Oktober 2023  khatulestari    18 Oktober 2023 khatulestari            -       Valid
ILHAM   KALIMANTAN BARAT        MEMPAWAH        JONGKAT SUNGAI NIPAH    6102082901840001        POKDAKAN MINA JAYA      Perseorangan    Subsektor Pembudidaya Ikan      JALAN SWADAYA   23 Agustus 2025 199512132022032003      23 Agustus 2025 199512132022032000      munziri.syarkawi        23 Agustus 2025 Valid
Cahaya Barokah  KALIMANTAN BARAT        MEMPAWAH        JONGKAT JUNGKAT 0210261026627466                Kelompok Masyarakat     Subsektor Pembudidaya Ikan      Jalan Raya Jungkat      22 September 2023       roni.irama      26 Maret 2025   roni.irama      197603042002121005      26 Maret 2025   Valid
M.HUDA  KALIMANTAN BARAT        MEMPAWAH        TOHO    SAMBORA 6102060208840002                Perseorangan    Subsektor Pembudidaya Ikan      SAMBORA 12 April 2022   lukman.m        26 Maret 2025   lukman.m        197603042002121005      26 Maret 2025   Valid
AS'AD AFRIADI   KALIMANTAN BARAT        MEMPAWAH        MEMPAWAH TIMUR  PASIR PALEMBANG 6102181602820003                Perseorangan    Subsektor Pembudidaya Ikan      JL. A. HAMID H.S        10 Februari 2022        roni.irama      26 Maret 2025   roni.irama      197603042002121005      26 Maret 2025   Valid
DAVID   KALIMANTAN BARAT        MEMPAWAH        JONGKAT JUNGKAT 6102083112000003        POKSAKAN SUKSES SEJAHTERA ABADI Perseorangan    Subsektor Pembudidaya Ikan      KOMPLEK TERMINAL JUNGKAT RT 002 RW 005  15 September 2025       199104122022031002      13 April 2026   199512132022032000      munziri.syarkawi        15 September 2025       Valid
MUHAMMAD YUSUF  KALIMANTAN BARAT        MEMPAWAH        SEGEDONG        SUNGAI BURUNG   6171051005860003                Perseorangan    Subsektor Pembudidaya Ikan      JL. SUNGAI BURUNG RT.001/RW.002 11 September 2023       rizky.fajary    11 September 2023       rizky.fajary            -       Draf
`.trim();

function parseRows(data: string): KusukaRow[] {
  const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines.map(line => {
    const cols = line.split('\t');
    return {
      nama: cols[0] || '',
      provinsi: cols[1] || '',
      kabKota: cols[2] || '',
      kecamatan: cols[3] || '',
      kelDesa: cols[4] || '',
      noKusuka: cols[5] || '',
      namaKelompok: cols[6] || '',
      bentukUsaha: cols[7] || 'Perseorangan',
      profesiUtama: cols[8] || '',
      alamat: cols[9] || '',
      tglDibuat: cols[10] || '',
      dibuatOleh: cols[11] || '',
      tglDiperbaharui: cols[12] || '',
      diperbaharuiOleh: cols[13] || '',
      divalidasiOleh: cols[14] || '',
      tglDivalidasi: cols[15] || '',
      statusKusuka: cols[16] || 'Valid',
    };
  });
}

async function main() {
  console.log('🔑 Import password:', IMPORT_PASSWORD);

  // Step 1: Clear existing KusukaRegistration data
  const deleteResult = await prisma.kusukaRegistration.deleteMany();
  console.log(`🗑️  Cleared ${deleteResult.count} existing KusukaRegistration records`);

  // Step 2: Parse the raw data
  const rows = parseRows(rawData);
  console.log(`📋 Parsed ${rows.length} rows from raw data`);

  // Step 3: Insert all records
  let inserted = 0;
  for (const row of rows) {
    const tglDibuat = parseIndonesianDate(row.tglDibuat);
    const tglDiperbaharui = parseIndonesianDate(row.tglDiperbaharui);
    const tglDivalidasi = parseIndonesianDate(row.tglDivalidasi);

    if (!tglDibuat) {
      console.warn(`⚠️  Skipping "${row.nama}" - invalid tglDibuat: "${row.tglDibuat}"`);
      continue;
    }
    if (!tglDiperbaharui) {
      console.warn(`⚠️  Skipping "${row.nama}" - invalid tglDiperbaharui: "${row.tglDiperbaharui}"`);
      continue;
    }

    await prisma.kusukaRegistration.create({
      data: {
        nama: row.nama,
        provinsi: row.provinsi,
        kabKota: row.kabKota,
        kecamatan: row.kecamatan,
        kelDesa: row.kelDesa,
        noKusuka: row.noKusuka,
        namaKelompok: row.namaKelompok,
        bentukUsaha: row.bentukUsaha,
        profesiUtama: row.profesiUtama,
        alamat: row.alamat,
        tglDibuat,
        dibuatOleh: row.dibuatOleh,
        tglDiperbaharui,
        diperbaharuiOleh: row.diperbaharuiOleh,
        divalidasiOleh: row.divalidasiOleh,
        tglDivalidasi,
        statusKusuka: row.statusKusuka,
      },
    });
    inserted++;
  }

  console.log(`✅ Successfully inserted ${inserted} KusukaRegistration records`);

  // Step 4: Verify count
  const count = await prisma.kusukaRegistration.count();
  console.log(`📊 Total KusukaRegistration records in database: ${count}`);

  // Show breakdown by status
  const validCount = await prisma.kusukaRegistration.count({ where: { statusKusuka: 'Valid' } });
  const drafCount = await prisma.kusukaRegistration.count({ where: { statusKusuka: 'Draf' } });
  console.log(`   Valid: ${validCount}, Draf: ${drafCount}`);

  // Show breakdown by kecamatan
  const byKec = await prisma.kusukaRegistration.groupBy({
    by: ['kecamatan'],
    _count: { kecamatan: true },
    orderBy: { _count: { kecamatan: 'desc' } },
  });
  console.log('   By Kecamatan:');
  for (const item of byKec) {
    console.log(`     ${item.kecamatan}: ${item._count.kecamatan}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
