'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFishFarmStats } from '@/hooks/use-fish-farms';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, Target, MapPin } from 'lucide-react';

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
const formatCurrency = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

function Trend5YearTable() {
  const { data: stats, isLoading } = useFishFarmStats();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-48" />
            <div className="h-40 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const data = Object.entries(stats.trend5Year)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, val]) => ({
      year,
      pembesaran: val.pembesaran,
      pembenihan: val.pembenihan,
      total: val.pembesaran + val.pembenihan,
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0 }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-teal-600" />
            Tabel Tren Produksi 5 Tahun
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-semibold">Tahun</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Pembesaran (kg)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Pembenihan (kg)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Total (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell className="text-xs font-medium">{row.year}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(row.pembesaran)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(row.pembenihan)}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{formatNumber(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TargetVsRealisasiTable() {
  const { data: stats, isLoading } = useFishFarmStats();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-48" />
            <div className="h-40 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const data = Object.entries(stats.targetVsRealisasi).map(([fishType, val]) => ({
    fishType,
    target: val.target,
    realisasi: val.realisasi,
    percentage: val.target > 0 ? ((val.realisasi / val.target) * 100) : 0,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-600" />
            Tabel Target vs Realisasi
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-semibold">Jenis Ikan</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Target (kg)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Realisasi (kg)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Persentase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.fishType}>
                    <TableCell className="text-xs font-medium">{row.fishType}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(row.target)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(row.realisasi)}</TableCell>
                    <TableCell className="text-xs text-right">
                      <span
                        className={`font-semibold ${
                          row.percentage >= 100
                            ? 'text-emerald-600'
                            : row.percentage >= 70
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}
                      >
                        {row.percentage.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function KecamatanDetailTable() {
  const { data: stats, isLoading } = useFishFarmStats();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-48" />
            <div className="h-60 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const data = Object.entries(stats.productionByKecamatanDetail)
    .map(([kecamatan, val]) => ({
      kecamatan,
      ...val,
    }))
    .sort((a, b) => b.production - a.production);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-teal-600" />
            Tabel Produksi per Kecamatan
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="overflow-x-auto rounded-lg border max-h-96 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 sticky top-0">
                  <TableHead className="text-xs font-semibold">Kecamatan</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Produksi (kg)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Nilai (Rp)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">RTP</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Pembudidaya</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Kelompok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.kecamatan}>
                    <TableCell className="text-xs font-medium whitespace-nowrap">{row.kecamatan}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(row.production)}</TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(row.value)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(row.rtp)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(row.farmer)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(row.group)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ReportTables() {
  return (
    <div className="space-y-6">
      <Trend5YearTable />
      <TargetVsRealisasiTable />
      <KecamatanDetailTable />
    </div>
  );
}
