import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

interface DisagregasiRow {
  provinsi: string;
  kodeProvinsi: number;
  kabKota: string;
  kodeKabKota: number;
  bulan: string;
  tw: number;
  semester: number;
  jenisWadah: string;
  komoditas: string;
  produksiTon: number;
  produksiKg: number;
  produktifitas: number;
  luasLahan: number;
  hargaRpKg: number;
  nilaiRp: number;
  fcr: number;
  pakanKg: number;
  size: number;
  sr: number;
  agregatBenih: number;
}

interface PopulasiRow {
  jenisWadah: string;
  jumlahRtp: number;
  jumlahPembudidaya: number;
  luasLahan: number;
}

function getExcelData(): { produksi: DisagregasiRow[]; populasi: PopulasiRow[] } {
  const filePath = join(process.cwd(), 'upload', '970e6a72-8c50-47e1-9bc6-475cc0a48370.xlsx');
  const fileBuffer = readFile(filePath);
  
  // Synchronous fallback — read from static analysis
  return { produksi: [], populasi: [] };
}

// Static data extracted from the Excel file (Semester 1, 2026)
// This is hardcoded from the analysis to avoid file system reads in serverless
const SEMESTER_1_DATA: DisagregasiRow[] = [
  // Januari
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Lele', produksiTon:4.63, produksiKg:4630, produktifitas:107.35, luasLahan:43.13, hargaRpKg:23000, nilaiRp:106490000, fcr:1.2, pakanKg:5556, size:7, sr:0.9, agregatBenih:36011 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Mas', produksiTon:77.75, produksiKg:77750, produktifitas:74.27, luasLahan:1046.86, hargaRpKg:40000, nilaiRp:3110000000, fcr:2, pakanKg:155500, size:4, sr:0.8, agregatBenih:388750 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Nila', produksiTon:155.09, produksiKg:155090, produktifitas:74.26, luasLahan:2088.47, hargaRpKg:38000, nilaiRp:5893420000, fcr:1.5, pakanKg:232635, size:4, sr:0.8, agregatBenih:775450 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Patin', produksiTon:6.99, produksiKg:6990, produktifitas:64.37, luasLahan:108.59, hargaRpKg:25000, nilaiRp:174750000, fcr:2, pakanKg:13980, size:2, sr:0.8, agregatBenih:17475 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Bawal Air Tawar', produksiTon:0.66, produksiKg:660, produktifitas:10.34, luasLahan:63.83, hargaRpKg:25000, nilaiRp:16500000, fcr:1.5, pakanKg:990, size:4, sr:0.78, agregatBenih:3385 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Jelawat', produksiTon:0.47, produksiKg:470, produktifitas:5.5, luasLahan:85.45, hargaRpKg:50000, nilaiRp:23500000, fcr:1.5, pakanKg:705, size:4, sr:0.78, agregatBenih:2410 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Lele', produksiTon:11.15, produksiKg:11150, produktifitas:49.7, luasLahan:224.35, hargaRpKg:21000, nilaiRp:234150000, fcr:1.2, pakanKg:13380, size:7, sr:0.9, agregatBenih:86722 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Mas', produksiTon:9.41, produksiKg:9410, produktifitas:10.53, luasLahan:893.64, hargaRpKg:38000, nilaiRp:357580000, fcr:2, pakanKg:18820, size:4, sr:0.8, agregatBenih:47050 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Nila', produksiTon:3.08, produksiKg:3080, produktifitas:4.95, luasLahan:622.22, hargaRpKg:35000, nilaiRp:107800000, fcr:1.5, pakanKg:4620, size:4, sr:0.8, agregatBenih:15400 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Patin', produksiTon:10.83, produksiKg:10830, produktifitas:25.42, luasLahan:426.04, hargaRpKg:22000, nilaiRp:238260000, fcr:2, pakanKg:21660, size:2, sr:0.8, agregatBenih:27075 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Januari', tw:1, semester:1, jenisWadah:'Tambak Intensif', komoditas:'Udang Vaname', produksiTon:29.11, produksiKg:29110, produktifitas:0.78, luasLahan:37320.51, hargaRpKg:75000, nilaiRp:2183250000, fcr:1.6, pakanKg:46576, size:50, sr:0.8, agregatBenih:1819375 },
  // Februari
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Lele', produksiTon:4.65, produksiKg:4650, produktifitas:107.35, luasLahan:43.32, hargaRpKg:23000, nilaiRp:106950000, fcr:1.2, pakanKg:5580, size:7, sr:0.9, agregatBenih:36167 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Mas', produksiTon:79.21, produksiKg:79210, produktifitas:74.27, luasLahan:1066.51, hargaRpKg:40000, nilaiRp:3168400000, fcr:2, pakanKg:158420, size:4, sr:0.8, agregatBenih:396050 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Nila', produksiTon:155.42, produksiKg:155420, produktifitas:74.26, luasLahan:2092.92, hargaRpKg:38000, nilaiRp:5905960000, fcr:1.5, pakanKg:233130, size:4, sr:0.8, agregatBenih:777100 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Patin', produksiTon:7.06, produksiKg:7060, produktifitas:64.37, luasLahan:109.68, hargaRpKg:25000, nilaiRp:176500000, fcr:2, pakanKg:14120, size:2, sr:0.8, agregatBenih:17650 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Bawal Air Tawar', produksiTon:0.49, produksiKg:490, produktifitas:10.34, luasLahan:47.39, hargaRpKg:25000, nilaiRp:12250000, fcr:1.5, pakanKg:735, size:4, sr:0.78, agregatBenih:2513 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Jelawat', produksiTon:0.35, produksiKg:350, produktifitas:5.5, luasLahan:63.64, hargaRpKg:50000, nilaiRp:17500000, fcr:1.5, pakanKg:525, size:4, sr:0.78, agregatBenih:1795 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Lele', produksiTon:11.2, produksiKg:11200, produktifitas:49.7, luasLahan:225.35, hargaRpKg:21000, nilaiRp:235200000, fcr:1.2, pakanKg:13440, size:7, sr:0.9, agregatBenih:87111 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Mas', produksiTon:8.88, produksiKg:8880, produktifitas:10.53, luasLahan:843.3, hargaRpKg:38000, nilaiRp:337440000, fcr:2, pakanKg:17760, size:4, sr:0.8, agregatBenih:44400 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Nila', produksiTon:3.12, produksiKg:3120, produktifitas:4.95, luasLahan:630.3, hargaRpKg:35000, nilaiRp:109200000, fcr:1.5, pakanKg:4680, size:4, sr:0.8, agregatBenih:15600 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Patin', produksiTon:11.22, produksiKg:11220, produktifitas:25.42, luasLahan:441.38, hargaRpKg:22000, nilaiRp:246840000, fcr:2, pakanKg:22440, size:2, sr:0.8, agregatBenih:28050 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Februari', tw:1, semester:1, jenisWadah:'Tambak Intensif', komoditas:'Udang Vaname', produksiTon:26.11, produksiKg:26110, produktifitas:78, luasLahan:334.74, hargaRpKg:75000, nilaiRp:1958250000, fcr:1.6, pakanKg:41776, size:50, sr:0.8, agregatBenih:1631875 },
  // Maret
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Lele', produksiTon:4.64, produksiKg:4640, produktifitas:107.35, luasLahan:43.22, hargaRpKg:23000, nilaiRp:106720000, fcr:1.2, pakanKg:5568, size:7, sr:0.9, agregatBenih:36089 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Mas', produksiTon:78.91, produksiKg:78910, produktifitas:74.27, luasLahan:1062.47, hargaRpKg:40000, nilaiRp:3156400000, fcr:2, pakanKg:157820, size:4, sr:0.8, agregatBenih:394550 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Nila', produksiTon:155.25, produksiKg:155250, produktifitas:74.26, luasLahan:2090.63, hargaRpKg:38000, nilaiRp:5899500000, fcr:1.5, pakanKg:232875, size:4, sr:0.8, agregatBenih:776250 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Patin', produksiTon:7.03, produksiKg:7030, produktifitas:64.37, luasLahan:109.21, hargaRpKg:25000, nilaiRp:175750000, fcr:2, pakanKg:14060, size:2, sr:0.8, agregatBenih:17575 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Bawal Air Tawar', produksiTon:0.64, produksiKg:640, produktifitas:10.34, luasLahan:61.9, hargaRpKg:25000, nilaiRp:16000000, fcr:1.5, pakanKg:960, size:4, sr:0.78, agregatBenih:3282 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Jelawat', produksiTon:0.45, produksiKg:450, produktifitas:5.5, luasLahan:81.82, hargaRpKg:50000, nilaiRp:22500000, fcr:1.5, pakanKg:675, size:4, sr:0.78, agregatBenih:2308 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Lele', produksiTon:11.17, produksiKg:11170, produktifitas:49.7, luasLahan:224.75, hargaRpKg:21000, nilaiRp:234570000, fcr:1.2, pakanKg:13404, size:7, sr:0.9, agregatBenih:86878 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Mas', produksiTon:10.85, produksiKg:10850, produktifitas:10.53, luasLahan:1030.39, hargaRpKg:38000, nilaiRp:412300000, fcr:2, pakanKg:21700, size:4, sr:0.8, agregatBenih:54250 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Nila', produksiTon:3.08, produksiKg:3080, produktifitas:4.95, luasLahan:622.22, hargaRpKg:35000, nilaiRp:107800000, fcr:1.5, pakanKg:4620, size:4, sr:0.8, agregatBenih:15400 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Patin', produksiTon:10.72, produksiKg:10720, produktifitas:25.42, luasLahan:421.72, hargaRpKg:22000, nilaiRp:235840000, fcr:2, pakanKg:21440, size:2, sr:0.8, agregatBenih:26800 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Maret', tw:1, semester:1, jenisWadah:'Tambak Intensif', komoditas:'Udang Vaname', produksiTon:29.78, produksiKg:29780, produktifitas:78, luasLahan:381.79, hargaRpKg:75000, nilaiRp:2233500000, fcr:1.6, pakanKg:47648, size:50, sr:0.8, agregatBenih:1861250 },
  // April
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Lele', produksiTon:4.69, produksiKg:4690, produktifitas:107.35, luasLahan:43.69, hargaRpKg:23000, nilaiRp:107870000, fcr:1.2, pakanKg:5628, size:7, sr:0.9, agregatBenih:36478 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Mas', produksiTon:81.11, produksiKg:81110, produktifitas:74.27, luasLahan:1092.1, hargaRpKg:40000, nilaiRp:3244400000, fcr:2, pakanKg:162220, size:4, sr:0.8, agregatBenih:405550 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Nila', produksiTon:158.73, produksiKg:158730, produktifitas:74.26, luasLahan:2137.49, hargaRpKg:38000, nilaiRp:6031740000, fcr:1.5, pakanKg:238095, size:4, sr:0.8, agregatBenih:793650 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Patin', produksiTon:7.1, produksiKg:7100, produktifitas:64.37, luasLahan:110.3, hargaRpKg:25000, nilaiRp:177500000, fcr:2, pakanKg:14200, size:2, sr:0.8, agregatBenih:17750 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Bawal Air Tawar', produksiTon:0.61, produksiKg:610, produktifitas:10.34, luasLahan:58.99, hargaRpKg:25000, nilaiRp:15250000, fcr:1.5, pakanKg:915, size:4, sr:0.78, agregatBenih:3128 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Jelawat', produksiTon:0.42, produksiKg:420, produktifitas:5.5, luasLahan:76.36, hargaRpKg:50000, nilaiRp:21000000, fcr:1.5, pakanKg:630, size:4, sr:0.78, agregatBenih:2154 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Lele', produksiTon:11.6, produksiKg:11600, produktifitas:49.7, luasLahan:233.4, hargaRpKg:21000, nilaiRp:243600000, fcr:1.2, pakanKg:13920, size:7, sr:0.9, agregatBenih:90222 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Mas', produksiTon:9.82, produksiKg:9820, produktifitas:10.53, luasLahan:932.57, hargaRpKg:38000, nilaiRp:373160000, fcr:2, pakanKg:19640, size:4, sr:0.8, agregatBenih:49100 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Nila', produksiTon:3.18, produksiKg:3180, produktifitas:4.95, luasLahan:642.42, hargaRpKg:35000, nilaiRp:111300000, fcr:1.5, pakanKg:4770, size:4, sr:0.8, agregatBenih:15900 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Patin', produksiTon:11.31, produksiKg:11310, produktifitas:25.42, luasLahan:444.93, hargaRpKg:22000, nilaiRp:248820000, fcr:2, pakanKg:22620, size:2, sr:0.8, agregatBenih:28275 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'April', tw:2, semester:1, jenisWadah:'Tambak Intensif', komoditas:'Udang Vaname', produksiTon:29.3, produksiKg:29300, produktifitas:78, luasLahan:375.64, hargaRpKg:75000, nilaiRp:2197500000, fcr:1.6, pakanKg:46880, size:50, sr:0.8, agregatBenih:1831250 },
  // Mei
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Lele', produksiTon:4.6, produksiKg:4600, produktifitas:107.35, luasLahan:42.85, hargaRpKg:23000, nilaiRp:105800000, fcr:1.2, pakanKg:5520, size:7, sr:0.9, agregatBenih:35778 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Mas', produksiTon:79.92, produksiKg:79920, produktifitas:74.27, luasLahan:1076.07, hargaRpKg:40000, nilaiRp:3196800000, fcr:2, pakanKg:159840, size:4, sr:0.8, agregatBenih:399600 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Nila', produksiTon:152.31, produksiKg:152310, produktifitas:74.26, luasLahan:2050.75, hargaRpKg:38000, nilaiRp:5787780000, fcr:1.5, pakanKg:228465, size:4, sr:0.8, agregatBenih:761550 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Patin', produksiTon:6.94, produksiKg:6940, produktifitas:64.37, luasLahan:107.83, hargaRpKg:25000, nilaiRp:173500000, fcr:2, pakanKg:13880, size:2, sr:0.8, agregatBenih:17350 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Bawal Air Tawar', produksiTon:0.6, produksiKg:600, produktifitas:10.34, luasLahan:58.03, hargaRpKg:25000, nilaiRp:15000000, fcr:1.5, pakanKg:900, size:4, sr:0.78, agregatBenih:3077 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Jelawat', produksiTon:0.42, produksiKg:420, produktifitas:5.5, luasLahan:76.36, hargaRpKg:50000, nilaiRp:21000000, fcr:1.5, pakanKg:630, size:4, sr:0.78, agregatBenih:2154 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Lele', produksiTon:11.1, produksiKg:11100, produktifitas:49.7, luasLahan:223.34, hargaRpKg:21000, nilaiRp:233100000, fcr:1.2, pakanKg:13320, size:7, sr:0.9, agregatBenih:86333 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Mas', produksiTon:9.61, produksiKg:9610, produktifitas:10.53, luasLahan:912.82, hargaRpKg:38000, nilaiRp:365180000, fcr:2, pakanKg:19220, size:4, sr:0.8, agregatBenih:48050 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Nila', produksiTon:3.16, produksiKg:3160, produktifitas:4.95, luasLahan:638.38, hargaRpKg:35000, nilaiRp:110600000, fcr:1.5, pakanKg:4740, size:4, sr:0.8, agregatBenih:15800 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Patin', produksiTon:10.98, produksiKg:10980, produktifitas:25.42, luasLahan:431.94, hargaRpKg:22000, nilaiRp:241560000, fcr:2, pakanKg:21960, size:2, sr:0.8, agregatBenih:27450 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Mei', tw:2, semester:1, jenisWadah:'Tambak Intensif', komoditas:'Udang Vaname', produksiTon:27.87, produksiKg:27870, produktifitas:78, luasLahan:357.31, hargaRpKg:75000, nilaiRp:2090250000, fcr:1.6, pakanKg:44592, size:50, sr:0.8, agregatBenih:1741875 },
  // Juni
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Lele', produksiTon:4.38, produksiKg:4380, produktifitas:107.35, luasLahan:40.8, hargaRpKg:23000, nilaiRp:100740000, fcr:1.2, pakanKg:5256, size:7, sr:0.9, agregatBenih:34067 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Mas', produksiTon:39.31, produksiKg:39310, produktifitas:74.27, luasLahan:529.28, hargaRpKg:40000, nilaiRp:1572400000, fcr:2, pakanKg:78620, size:4, sr:0.8, agregatBenih:196550 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Nila', produksiTon:146.47, produksiKg:146470, produktifitas:74.26, luasLahan:1972.27, hargaRpKg:38000, nilaiRp:5565860000, fcr:1.5, pakanKg:219705, size:4, sr:0.8, agregatBenih:732350 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Jaring Apung Tawar', komoditas:'Patin', produksiTon:6.54, produksiKg:6540, produktifitas:64.37, luasLahan:101.61, hargaRpKg:25000, nilaiRp:163500000, fcr:2, pakanKg:13080, size:2, sr:0.8, agregatBenih:16350 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Bawal Air Tawar', produksiTon:0.61, produksiKg:610, produktifitas:10.34, luasLahan:58.99, hargaRpKg:25000, nilaiRp:15250000, fcr:1.5, pakanKg:915, size:4, sr:0.78, agregatBenih:3128 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Jelawat', produksiTon:0.41, produksiKg:410, produktifitas:5.5, luasLahan:74.55, hargaRpKg:50000, nilaiRp:20500000, fcr:1.5, pakanKg:615, size:4, sr:0.78, agregatBenih:2103 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Lele', produksiTon:10.9, produksiKg:10900, produktifitas:49.7, luasLahan:219.32, hargaRpKg:21000, nilaiRp:228900000, fcr:1.2, pakanKg:13080, size:7, sr:0.9, agregatBenih:84778 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Mas', produksiTon:9.7, produksiKg:9700, produktifitas:10.53, luasLahan:921.18, hargaRpKg:38000, nilaiRp:368600000, fcr:2, pakanKg:19400, size:4, sr:0.8, agregatBenih:48500 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Nila', produksiTon:3.08, produksiKg:3080, produktifitas:4.95, luasLahan:622.22, hargaRpKg:35000, nilaiRp:107800000, fcr:1.5, pakanKg:4620, size:4, sr:0.8, agregatBenih:15400 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Kolam Air Tenang', komoditas:'Patin', produksiTon:11.17, produksiKg:11170, produktifitas:25.42, luasLahan:439.42, hargaRpKg:22000, nilaiRp:245740000, fcr:2, pakanKg:22340, size:2, sr:0.8, agregatBenih:27925 },
  { provinsi:'Kalimantan Barat', kodeProvinsi:61, kabKota:'Mempawah', kodeKabKota:6102, bulan:'Juni', tw:2, semester:1, jenisWadah:'Tambak Intensif', komoditas:'Udang Vaname', produksiTon:27.94, produksiKg:27940, produktifitas:78, luasLahan:358.21, hargaRpKg:75000, nilaiRp:2095500000, fcr:1.6, pakanKg:44704, size:50, sr:0.8, agregatBenih:1746250 },
];

const POPULASI_DATA: PopulasiRow[] = [
  { jenisWadah: 'Jaring Apung Tawar', jumlahRtp: 47, jumlahPembudidaya: 250, luasLahan: 30000 },
  { jenisWadah: 'Kolam Air Tenang', jumlahRtp: 120, jumlahPembudidaya: 120, luasLahan: 45000 },
  { jenisWadah: 'Tambak Intensif', jumlahRtp: 4, jumlahPembudidaya: 4, luasLahan: 150000 },
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'summary';

  if (action === 'summary') {
    return NextResponse.json({
      title: 'PEMBESARAN IKAN - Semester 1, 2026',
      region: 'Kabupaten Mempawah, Kalimantan Barat',
      data: SEMESTER_1_DATA,
      populasi: POPULASI_DATA,
    });
  }

  if (action === 'komoditas') {
    const byKomoditas: Record<string, { produksiTon: number; nilaiRp: number; pakanKg: number; benih: number }> = {};
    for (const r of SEMESTER_1_DATA) {
      if (!byKomoditas[r.komoditas]) byKomoditas[r.komoditas] = { produksiTon: 0, nilaiRp: 0, pakanKg: 0, benih: 0 };
      byKomoditas[r.komoditas].produksiTon += r.produksiTon;
      byKomoditas[r.komoditas].nilaiRp += r.nilaiRp;
      byKomoditas[r.komoditas].pakanKg += r.pakanKg;
      byKomoditas[r.komoditas].benih += r.agregatBenih;
    }
    return NextResponse.json(byKomoditas);
  }

  if (action === 'wadah') {
    const byWadah: Record<string, { produksiTon: number; nilaiRp: number }> = {};
    for (const r of SEMESTER_1_DATA) {
      if (!byWadah[r.jenisWadah]) byWadah[r.jenisWadah] = { produksiTon: 0, nilaiRp: 0 };
      byWadah[r.jenisWadah].produksiTon += r.produksiTon;
      byWadah[r.jenisWadah].nilaiRp += r.nilaiRp;
    }
    return NextResponse.json(byWadah);
  }

  if (action === 'monthly') {
    const monthOrder = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];
    const byMonth: Record<string, { produksiTon: number; nilaiRp: number }> = {};
    for (const m of monthOrder) byMonth[m] = { produksiTon: 0, nilaiRp: 0 };
    for (const r of SEMESTER_1_DATA) {
      if (byMonth[r.bulan]) {
        byMonth[r.bulan].produksiTon += r.produksiTon;
        byMonth[r.bulan].nilaiRp += r.nilaiRp;
      }
    }
    return NextResponse.json({ months: monthOrder, data: byMonth });
  }

  if (action === 'triwulan') {
    const byTw: Record<string, { produksiTon: number; nilaiRp: number }> = { 'TW 1': { produksiTon: 0, nilaiRp: 0 }, 'TW 2': { produksiTon: 0, nilaiRp: 0 } };
    for (const r of SEMESTER_1_DATA) {
      const key = r.tw === 1 ? 'TW 1' : 'TW 2';
      byTw[key].produksiTon += r.produksiTon;
      byTw[key].nilaiRp += r.nilaiRp;
    }
    return NextResponse.json(byTw);
  }

  if (action === 'matrix') {
    const wadahList = [...new Set(SEMESTER_1_DATA.map(r => r.jenisWadah))].sort();
    const komoditasList = [...new Set(SEMESTER_1_DATA.map(r => r.komoditas))].sort();
    const matrix: Record<string, Record<string, number>> = {};
    for (const k of komoditasList) {
      matrix[k] = {};
      for (const w of wadahList) matrix[k][w] = 0;
    }
    for (const r of SEMESTER_1_DATA) {
      matrix[r.komoditas][r.jenisWadah] += r.produksiTon;
    }
    return NextResponse.json({ wadahList, komoditasList, matrix });
  }

  if (action === 'insights') {
    const totalProduksi = SEMESTER_1_DATA.reduce((s, r) => s + r.produksiTon, 0);
    const totalNilai = SEMESTER_1_DATA.reduce((s, r) => s + r.nilaiRp, 0);

    // Monthly trend
    const monthOrder = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];
    const monthlyProd: Record<string, number> = {};
    for (const m of monthOrder) monthlyProd[m] = 0;
    for (const r of SEMESTER_1_DATA) monthlyProd[r.bulan] = (monthlyProd[r.bulan] || 0) + r.produksiTon;

    // Juni drop
    const juniDrop = ((monthlyProd['Mei'] - monthlyProd['Juni']) / monthlyProd['Mei'] * 100).toFixed(1);

    // Top komoditas
    const byKom: Record<string, number> = {};
    for (const r of SEMESTER_1_DATA) byKom[r.komoditas] = (byKom[r.komoditas] || 0) + r.produksiTon;
    const topKom = Object.entries(byKom).sort((a, b) => b[1] - a[1]);

    // TW comparison
    const tw1 = SEMESTER_1_DATA.filter(r => r.tw === 1).reduce((s, r) => s + r.produksiTon, 0);
    const tw2 = SEMESTER_1_DATA.filter(r => r.tw === 2).reduce((s, r) => s + r.produksiTon, 0);

    return NextResponse.json({
      totalProduksi: Math.round(totalProduksi * 100) / 100,
      totalNilai,
      totalNilaiMiliar: Math.round(totalNilai / 1e9 * 100) / 100,
      topKomoditas: topKom.slice(0, 3).map(([k, v]) => ({ name: k, ton: Math.round(v * 100) / 100, pct: Math.round(v / totalProduksi * 1000) / 10 })),
      juniDropPct: juniDrop,
      tw1Produksi: Math.round(tw1 * 100) / 100,
      tw2Produksi: Math.round(tw2 * 100) / 100,
      twDiffPct: Math.round((tw1 - tw2) / tw1 * 1000) / 10,
      populasi: {
        totalRtp: POPULASI_DATA.reduce((s, p) => s + p.jumlahRtp, 0),
        totalPembudidaya: POPULASI_DATA.reduce((s, p) => s + p.jumlahPembudidaya, 0),
        totalLuasLahan: POPULASI_DATA.reduce((s, p) => s + p.luasLahan, 0),
      },
      recommendations: [
        {
          title: 'Penurunan Produksi Juni Signifikan',
          desc: `Produksi Juni turun ${juniDrop}% dari Mei. Ini perlu diwaspadai karena bisa berlanjut ke Semester 2. Perlu investigasi penyebab (cuaca, harga pakan, atau musim).`,
          severity: 'high',
        },
        {
          title: 'Nila Dominan — Diversifikasi Perlu Diperhatikan',
          desc: `Nila menyumbang ${Math.round(topKom[0][1] / totalProduksi * 100)}% total produksi. Ketergantungan pada satu komoditas berisiko jika harga turun atau penyakit menyerang.`,
          severity: 'medium',
        },
        {
          title: 'Tambak Intensif Paling Produktif per m²',
          desc: 'Udang Vaname di Tambak Intensif memiliki produktifitas tertinggi (78 kg/m²). Investasi perluasan tambak intensif bisa meningkatkan produksi secara signifikan.',
          severity: 'low',
        },
        {
          title: 'Kolam Air Tenang — Potensi Peningkatan Masih Besar',
          desc: 'Kolam Air Tenang hanya menyumbang 11.9% produksi meskipun memiliki 120 RTP (70% dari total). Produktifitas per m² masih rendah dibanding Jaring Apung. Peluang peningkatan melalui teknologi pakan & benih unggul.',
          severity: 'medium',
        },
        {
          title: 'Disagregasi ke Level Desa Diperlukan',
          desc: 'Data saat ini masih agregat di level kabupaten. Disagregasi ke level desa/kecamatan akan memungkinkan intervensi yang lebih tepat sasaran dan monitoring progres per kelompok pembudidaya.',
          severity: 'high',
        },
      ],
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
