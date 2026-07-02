'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Fish, TrendingUp, TrendingDown, AlertTriangle, Lightbulb,
  BarChart3, PieChart as PieIcon, Activity, MapPin, Users,
  Droplets, ArrowDownRight, ArrowUpRight, Target, ChevronRight,
  Scale, Layers, GitBranch, Zap, Shield, Info,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';

// ─── Colors ──────────────────────────────────────────────────────────────
const CHART_COLORS = ['#10B981', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
const KOMODITAS_COLORS: Record<string, string> = {
  'Nila': '#06B6D4',
  'Mas': '#F59E0B',
  'Udang Vaname': '#EF4444',
  'Patin': '#8B5CF6',
  'Lele': '#10B981',
  'Bawal Air Tawar': '#EC4899',
  'Jelawat': '#14B8A6',
};
const WADAH_COLORS: Record<string, string> = {
  'Jaring Apung Tawar': '#06B6D4',
  'Kolam Air Tenang': '#10B981',
  'Tambak Intensif': '#F59E0B',
};

// ─── Types ───────────────────────────────────────────────────────────────
interface Insight {
  title: string;
  desc: string;
  severity: 'high' | 'medium' | 'low';
}

interface DashboardData {
  totalProduksi: number;
  totalNilai: number;
  totalNilaiMiliar: number;
  topKomoditas: { name: string; ton: number; pct: number }[];
  juniDropPct: string;
  tw1Produksi: number;
  tw2Produksi: number;
  twDiffPct: number;
  populasi: { totalRtp: number; totalPembudidaya: number; totalLuasLahan: number };
  recommendations: Insight[];
}

const DEFAULT_DATA: DashboardData = {
  totalProduksi: 1815.29,
  totalNilai: 72919000000,
  totalNilaiMiliar: 72.92,
  topKomoditas: [
    { name: 'Nila', ton: 941.97, pct: 51.9 },
    { name: 'Mas', ton: 494.48, pct: 27.2 },
    { name: 'Udang Vaname', ton: 170.11, pct: 9.4 },
  ],
  juniDropPct: '15.3',
  tw1Produksi: 929.4,
  tw2Produksi: 885.89,
  twDiffPct: 4.7,
  populasi: { totalRtp: 171, totalPembudidaya: 374, totalLuasLahan: 225000 },
  recommendations: [
    { title: 'Penurunan Produksi Juni Signifikan', desc: 'Produksi Juni turun 15.3% dari Mei. Perlu diwaspadai karena bisa berlanjut ke Semester 2.', severity: 'high' },
    { title: 'Nila Dominan — Diversifikasi Diperlukan', desc: 'Nila menyumbang 51.9% total produksi. Ketergantungan pada satu komoditas berisiko.', severity: 'medium' },
    { title: 'Tambak Intensif Paling Produktif per m²', desc: 'Udang Vaname di Tambak Intensif memiliki produktifitas tertinggi (78 kg/m²).', severity: 'low' },
    { title: 'Kolam Air Tenang — Potensi Peningkatan Besar', desc: '120 RTP (70% total) hanya menyumbang 11.9% produksi. Peluang peningkatan melalui teknologi.', severity: 'medium' },
    { title: 'Disagregasi ke Level Desa Diperlukan', desc: 'Data masih agregat. Disagregasi memungkinkan intervensi tepat sasaran per kelompok pembudidaya.', severity: 'high' },
  ],
};

// ─── Static Chart Data ───────────────────────────────────────────────────
const KOMODITAS_DATA = [
  { name: 'Nila', produksi: 941.97, nilai: 35739, pakan: 1413, benih: 4709.9, pct: 51.9 },
  { name: 'Mas', produksi: 494.48, nilai: 19663, pakan: 989, benih: 2472.4, pct: 27.2 },
  { name: 'Udang Vaname', produksi: 170.11, nilai: 12758, pakan: 272.2, benih: 10631.9, pct: 9.4 },
  { name: 'Patin', produksi: 107.89, nilai: 2499, pakan: 215.8, benih: 269.7, pct: 5.9 },
  { name: 'Lele', produksi: 94.71, nilai: 2044, pakan: 113.7, benih: 736.6, pct: 5.2 },
  { name: 'Bawal Air Tawar', produksi: 3.61, nilai: 90, pakan: 5.4, benih: 18.5, pct: 0.2 },
  { name: 'Jelawat', produksi: 2.52, nilai: 126, pakan: 3.8, benih: 12.9, pct: 0.1 },
];

const WADAH_DATA = [
  { name: 'Jaring Apung Tawar', produksi: 1428.73, nilai: 54209, pct: 78.7, rtp: 47, pembudidaya: 250, luasLahan: 30000 },
  { name: 'Kolam Air Tenang', produksi: 216.45, nilai: 5952, pct: 11.9, rtp: 120, pembudidaya: 120, luasLahan: 45000 },
  { name: 'Tambak Intensif', produksi: 170.11, nilai: 12758, pct: 9.4, rtp: 4, pembudidaya: 4, luasLahan: 150000 },
];

const MONTHLY_DATA = [
  { bulan: 'Jan', produksi: 309.17, nilai: 12446, tw: 'TW 1' },
  { bulan: 'Feb', produksi: 307.71, nilai: 12274, tw: 'TW 1' },
  { bulan: 'Mar', produksi: 312.52, nilai: 12601, tw: 'TW 1' },
  { bulan: 'Apr', produksi: 317.87, nilai: 12772, tw: 'TW 2' },
  { bulan: 'Mei', produksi: 307.51, nilai: 12341, tw: 'TW 2' },
  { bulan: 'Jun', produksi: 260.51, nilai: 10485, tw: 'TW 2' },
];

const TRIWULAN_DATA = [
  { name: 'TW 1', produksi: 929.4, nilai: 37321 },
  { name: 'TW 2', produksi: 885.89, nilai: 35598 },
];

const PRODUCTIVITY_DATA = [
  { name: 'Lele', 'Jaring Apung': 107.35, 'Kolam Tenang': 49.7 },
  { name: 'Mas', 'Jaring Apung': 74.27, 'Kolam Tenang': 10.53 },
  { name: 'Nila', 'Jaring Apung': 74.26, 'Kolam Tenang': 4.95 },
  { name: 'Patin', 'Jaring Apung': 64.37, 'Kolam Tenang': 25.42 },
  { name: 'Udang Vaname', 'Tambak Intensif': 78 },
  { name: 'Bawal Air Tawar', 'Kolam Tenang': 10.34 },
  { name: 'Jelawat', 'Kolam Tenang': 5.5 },
];

const MATRIX_DATA = [
  { komoditas: 'Nila', 'Jaring Apung Tawar': 923.27, 'Kolam Air Tenang': 18.7, 'Tambak Intensif': 0 },
  { komoditas: 'Mas', 'Jaring Apung Tawar': 436.21, 'Kolam Air Tenang': 58.27, 'Tambak Intensif': 0 },
  { komoditas: 'Udang Vaname', 'Jaring Apung Tawar': 0, 'Kolam Air Tenang': 0, 'Tambak Intensif': 170.11 },
  { komoditas: 'Patin', 'Jaring Apung Tawar': 41.66, 'Kolam Air Tenang': 66.23, 'Tambak Intensif': 0 },
  { komoditas: 'Lele', 'Jaring Apung Tawar': 27.59, 'Kolam Air Tenang': 67.12, 'Tambak Intensif': 0 },
  { komoditas: 'Bawal Air Tawar', 'Jaring Apung Tawar': 0, 'Kolam Air Tenang': 3.61, 'Tambak Intensif': 0 },
  { komoditas: 'Jelawat', 'Jaring Apung Tawar': 0, 'Kolam Air Tenang': 2.52, 'Tambak Intensif': 0 },
];

// ─── Custom Tooltip ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur p-3 shadow-xl">
      <p className="font-semibold text-sm mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{typeof p.value === 'number' ? p.value.toLocaleString('id-ID') : p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, trend, color, delay = 0 }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  trend?: 'up' | 'down' | 'neutral'; color: string; delay?: number;
}) {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className={`relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>{value}</p>
              {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${color}20`, boxShadow: `0 4px 12px ${color}30` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
          </div>
          {trend && trend !== 'neutral' && (
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up' ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={`text-[10px] font-medium ${trend === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
                {trend === 'up' ? 'Naik' : 'Turun'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Severity Badge ──────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { label: 'Prioritas Tinggi', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    medium: { label: 'Prioritas Sedang', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    low: { label: 'Prioritas Rendah', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  };
  const c = config[severity];
  return <Badge variant="outline" className={`text-[10px] ${c.className}`}>{c.label}</Badge>;
}

// ─── Main Dashboard ──────────────────────────────────────────────────────
export function Semester1Dashboard() {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-5 sm:p-6"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(16,185,129,0.08))'
            : 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(16,185,129,0.04))',
          border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.15)'}`,
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #06B6D4, #10B981)',
                boxShadow: '0 4px 20px rgba(6,182,212,0.4)',
              }}
            >
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                Analisis Data Disagregasi — Semester 1, 2026
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pembesaran Ikan — Kabupaten Mempawah, Kalimantan Barat
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs gap-1 border-cyan-500/30 text-cyan-400">
            <Activity className="h-3 w-3" /> 66 Data Points
          </Badge>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Fish}
          label="Total Produksi"
          value="1.815,29 Ton"
          sub="7 komoditas × 3 jenis wadah"
          trend="neutral"
          color="#06B6D4"
          delay={0.05}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Nilai Produksi"
          value="Rp 72,92 M"
          sub="Nilai ekonomi Semester 1"
          trend="up"
          color="#10B981"
          delay={0.1}
        />
        <StatCard
          icon={Users}
          label="Total Pembudidaya"
          value="374 Orang"
          sub="171 RTP aktif"
          trend="neutral"
          color="#F59E0B"
          delay={0.15}
        />
        <StatCard
          icon={MapPin}
          label="Luas Lahan"
          value="22,5 Ha"
          sub="225.000 m² produktif"
          trend="neutral"
          color="#8B5CF6"
          delay={0.2}
        />
      </div>

      {/* Main Charts Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-4 h-10">
          <TabsTrigger value="overview" className="text-xs gap-1"><PieIcon className="h-3.5 w-3.5 hidden sm:inline" /> Ringkasan</TabsTrigger>
          <TabsTrigger value="trend" className="text-xs gap-1"><Activity className="h-3.5 w-3.5 hidden sm:inline" /> Tren</TabsTrigger>
          <TabsTrigger value="matrix" className="text-xs gap-1"><Layers className="h-3.5 w-3.5 hidden sm:inline" /> Matrix</TabsTrigger>
          <TabsTrigger value="insights" className="text-xs gap-1"><Lightbulb className="h-3.5 w-3.5 hidden sm:inline" /> Insight</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ──────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Produksi per Komoditas - Bar */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-cyan-500" />
                    Produksi per Komoditas (Ton)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={KOMODITAS_DATA} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="produksi" name="Produksi (Ton)" radius={[0, 4, 4, 0]}>
                        {KOMODITAS_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={KOMODITAS_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pie Chart - Produksi per Jenis Wadah */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <PieIcon className="h-4 w-4 text-emerald-500" />
                    Distribusi per Jenis Wadah
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={WADAH_DATA}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="produksi"
                        nameKey="name"
                        label={({ name, pct }) => `${name.split(' ').slice(0, 2).join(' ')} (${pct}%)`}
                        labelLine={{ stroke: isDark ? '#475569' : '#94A3B8' }}
                        stroke="none"
                      >
                        {WADAH_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={WADAH_COLORS[entry.name] || CHART_COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Wadah Stats */}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {WADAH_DATA.map((w) => (
                      <div key={w.name} className="text-center p-2 rounded-lg" style={{ background: `${WADAH_COLORS[w.name]}10` }}>
                        <p className="text-[10px] text-muted-foreground truncate">{w.name.split(' ').slice(0, 2).join(' ')}</p>
                        <p className="text-xs font-bold" style={{ color: WADAH_COLORS[w.name] }}>{w.produksi.toFixed(0)} Ton</p>
                        <p className="text-[9px] text-muted-foreground">{w.rtp} RTP / {w.pembudidaya} org</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Nilai Produksi Comparison */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    Nilai Produksi per Komoditas (Rp Miliar)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={KOMODITAS_DATA.map(k => ({ ...k, nilaiM: k.nilai / 1000 }))} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="nilaiM" name="Nilai (Rp M)" radius={[4, 4, 0, 0]}>
                        {KOMODITAS_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={KOMODITAS_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Perbandingan Triwulan */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Scale className="h-4 w-4 text-violet-500" />
                    Perbandingan Triwulan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {TRIWULAN_DATA.map((tw) => (
                      <div key={tw.name} className="text-center p-4 rounded-xl" style={{
                        background: tw.name === 'TW 1' ? 'rgba(6,182,212,0.1)' : 'rgba(245,158,11,0.1)',
                        border: `1px solid ${tw.name === 'TW 1' ? 'rgba(6,182,212,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      }}>
                        <p className="text-xs text-muted-foreground mb-1">{tw.name}</p>
                        <p className="text-2xl font-bold" style={{ color: tw.name === 'TW 1' ? '#06B6D4' : '#F59E0B', fontFamily: 'Syne, sans-serif' }}>
                          {tw.produksi.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Ton</p>
                        <p className="text-xs mt-1 text-muted-foreground">Rp {tw.nilai.toLocaleString('id-ID')} M</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <p className="text-xs flex items-center gap-1.5 text-red-400">
                      <ArrowDownRight className="h-3.5 w-3.5" />
                      TW 2 turun <strong>4,7%</strong> dari TW 1 (selisih 43,51 Ton)
                    </p>
                  </div>

                  {/* Productivity comparison */}
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Produktifitas per Jenis Wadah (kg/m²)</p>
                    {[
                      { name: 'Jaring Apung Tawar', val: 47.62, max: 107, color: '#06B6D4' },
                      { name: 'Kolam Air Tenang', val: 4.81, max: 107, color: '#10B981' },
                      { name: 'Tambak Intensif', val: 1.13, max: 107, color: '#F59E0B' },
                    ].map(item => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">{item.name}</span>
                          <span className="font-medium" style={{ color: item.color }}>{item.val} kg/m²</span>
                        </div>
                        <Progress value={(item.val / item.max) * 100} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ─── TREND TAB ─────────────────────────────────────────────── */}
        <TabsContent value="trend" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly Trend Line */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-500" />
                    Tren Produksi Bulanan (Ton)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={MONTHLY_DATA} margin={{ left: 10, right: 10 }}>
                      <defs>
                        <linearGradient id="prodGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                      <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <YAxis domain={[240, 330]} tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="produksi" name="Produksi (Ton)" stroke="#06B6D4" fill="url(#prodGradient)" strokeWidth={2.5} dot={{ r: 4, fill: '#06B6D4', stroke: isDark ? '#0D1B2E' : '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  {/* MoM Changes */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {MONTHLY_DATA.slice(1).map((m, i) => {
                      const prev = MONTHLY_DATA[i].produksi;
                      const change = ((m.produksi - prev) / prev * 100).toFixed(1);
                      const isUp = Number(change) >= 0;
                      return (
                        <Badge key={m.bulan} variant="outline" className={`text-[10px] gap-1 ${isUp ? 'border-emerald-500/20 text-emerald-400' : 'border-red-500/20 text-red-400'}`}>
                          {isUp ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                          {m.bulan}: {isUp ? '+' : ''}{change}%
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Monthly by Komoditas Stacked */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-violet-500" />
                    Tren Bulanan per Komoditas (Ton)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={[
                      { bulan: 'Jan', Nila: 158.17, Mas: 87.16, Lele: 15.78, Patin: 17.82, 'Udang Vaname': 29.11, 'Bawal AT': 0.66, Jelawat: 0.47 },
                      { bulan: 'Feb', Nila: 158.54, Mas: 88.09, Lele: 15.85, Patin: 18.28, 'Udang Vaname': 26.11, 'Bawal AT': 0.49, Jelawat: 0.35 },
                      { bulan: 'Mar', Nila: 158.33, Mas: 89.76, Lele: 15.81, Patin: 17.75, 'Udang Vaname': 29.78, 'Bawal AT': 0.64, Jelawat: 0.45 },
                      { bulan: 'Apr', Nila: 161.91, Mas: 90.93, Lele: 16.29, Patin: 18.41, 'Udang Vaname': 29.3, 'Bawal AT': 0.61, Jelawat: 0.42 },
                      { bulan: 'Mei', Nila: 155.47, Mas: 89.53, Lele: 15.7, Patin: 17.92, 'Udang Vaname': 27.87, 'Bawal AT': 0.6, Jelawat: 0.42 },
                      { bulan: 'Jun', Nila: 149.55, Mas: 49.01, Lele: 15.28, Patin: 17.71, 'Udang Vaname': 27.94, 'Bawal AT': 0.61, Jelawat: 0.41 },
                    ]} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                      <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {['Nila', 'Mas', 'Lele', 'Patin', 'Udang Vaname', 'Bawal AT', 'Jelawat'].map((k, i) => (
                        <Bar key={k} dataKey={k} stackId="a" fill={KOMODITAS_COLORS[k.replace('Bawal AT', 'Bawal Air Tawar')] || CHART_COLORS[i]} radius={i === 6 ? [4, 4, 0, 0] : undefined} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Value Trend */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Tren Nilai Produksi Bulanan (Rp Miliar)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={MONTHLY_DATA.map(m => ({ ...m, nilaiM: m.nilai / 1000 }))} margin={{ left: 10, right: 10 }}>
                      <defs>
                        <linearGradient id="valGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                      <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="nilaiM" name="Nilai (Rp M)" stroke="#10B981" fill="url(#valGradient)" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981', stroke: isDark ? '#0D1B2E' : '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Populasi & RTP */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-500" />
                    Data Populasi per Jenis Wadah
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={WADAH_DATA} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar yAxisId="left" dataKey="rtp" name="RTP (Unit)" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="pembudidaya" name="Pembudidaya (Org)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="luasLahan" name="Luas Lahan (m²)" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ─── MATRIX TAB ─────────────────────────────────────────────── */}
        <TabsContent value="matrix" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Stacked Bar Matrix */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-cyan-500" />
                    Matriks Produksi: Komoditas × Jenis Wadah
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={MATRIX_DATA} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                      <XAxis dataKey="komoditas" tick={{ fontSize: 9, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {['Jaring Apung Tawar', 'Kolam Air Tenang', 'Tambak Intensif'].map((w, i) => (
                        <Bar key={w} dataKey={w} stackId="a" fill={WADAH_COLORS[w]} radius={i === 2 ? [4, 4, 0, 0] : undefined} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Radar Productivity */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-500" />
                    Produktifitas (kg/m²) — Radar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={[
                      { komoditas: 'Lele', 'Jaring Apung': 107.35, 'Kolam Tenang': 49.7 },
                      { komoditas: 'Mas', 'Jaring Apung': 74.27, 'Kolam Tenang': 10.53 },
                      { komoditas: 'Nila', 'Jaring Apung': 74.26, 'Kolam Tenang': 4.95 },
                      { komoditas: 'Patin', 'Jaring Apung': 64.37, 'Kolam Tenang': 25.42 },
                      { komoditas: 'Udang Vaname', 'Jaring Apung': 0, 'Kolam Tenang': 0, 'Tambak Intensif': 78 },
                    ]}>
                      <PolarGrid stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                      <PolarAngleAxis dataKey="komoditas" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <PolarRadiusAxis tick={{ fontSize: 8, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <Radar name="Jaring Apung" dataKey="Jaring Apung" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.2} />
                      <Radar name="Kolam Tenang" dataKey="Kolam Tenang" stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Disagregation Possibilities */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-2">
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Apa yang Bisa Dilakukan dengan Data Ini di Semester 1?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      {
                        icon: GitBranch,
                        title: 'Disagregasi ke Level Desa',
                        desc: 'Pecah data agregat kabupaten menjadi data per desa/kecamatan berdasarkan proporsi RTP dan luas lahan. Ini memungkinkan monitoring progres per kelompok pembudidaya.',
                        color: '#06B6D4',
                        tag: 'Fitur Utama',
                      },
                      {
                        icon: Target,
                        title: 'Analisis Kesenjangan Produktifitas',
                        desc: 'Identifikasi desa/kelompok dengan produktifitas di bawah rata-rata. Kolam Air Tenang (4.81 kg/m²) jauh di bawah Jaring Apung (47.62 kg/m²) — perlu intervensi.',
                        color: '#EF4444',
                        tag: 'Analisis',
                      },
                      {
                        icon: TrendingDown,
                        title: 'Investigasi Penurunan Juni',
                        desc: 'Produksi Juni turun 15.3% — terutama pada Mas (dari 79.92 ke 39.31 Ton). Perlu data cuaca, harga pakan, dan status benih untuk analisis akar masalah.',
                        color: '#F59E0B',
                        tag: 'Prioritas',
                      },
                      {
                        icon: Scale,
                        title: 'Perencanaan Alokasi Benih',
                        desc: 'Total benih Semester 1: 18.9 juta ekor. Dengan disagregasi, alokasi benih per desa bisa lebih tepat sasaran berdasarkan SR dan kapasitas wadah.',
                        color: '#10B981',
                        tag: 'Perencanaan',
                      },
                      {
                        icon: Shield,
                        title: 'Evaluasi FCR & Efisiensi Pakan',
                        desc: 'Lele (FCR 1.2) paling efisien, Mas (FCR 2.0) kurang efisien. Disagregasi memungkinkan evaluasi FCR per desa untuk identifikasi best practices.',
                        color: '#8B5CF6',
                        tag: 'Efisiensi',
                      },
                      {
                        icon: BarChart3,
                        title: 'Proyeksi Semester 2',
                        desc: 'Berdasarkan tren S1, proyeksi S2 bisa dihitung. Jika koreksi penurunan Juni dilakukan, target S2 bisa mencapai 1.900+ Ton.',
                        color: '#EC4899',
                        tag: 'Proyeksi',
                      },
                    ].map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + i * 0.05 }}
                          className="p-4 rounded-xl border transition-all hover:shadow-lg"
                          style={{
                            background: `${item.color}08`,
                            borderColor: `${item.color}20`,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${item.color}15` }}
                            >
                              <Icon className="h-4.5 w-4.5" style={{ color: item.color }} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-xs">{item.title}</h4>
                                <Badge variant="outline" className="text-[8px] px-1.5 py-0" style={{ borderColor: `${item.color}40`, color: item.color }}>
                                  {item.tag}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ─── INSIGHTS TAB ───────────────────────────────────────────── */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          {/* Executive Summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-cyan-500" />
                  Ringkasan Eksekutif — Semester 1 2026
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Total Produksi', value: '1.815,29 Ton', color: '#06B6D4' },
                    { label: 'Total Nilai', value: 'Rp 72,92 M', color: '#10B981' },
                    { label: 'Komoditas Terbesar', value: 'Nila (51,9%)', color: '#F59E0B' },
                    { label: 'Wadah Terbesar', value: 'JAT (78,7%)', color: '#8B5CF6' },
                  ].map((s, i) => (
                    <div key={i} className="p-3 rounded-lg text-center" style={{ background: `${s.color}08`, border: `1px solid ${s.color}15` }}>
                      <p className="text-[10px] text-muted-foreground mb-0.5">{s.label}</p>
                      <p className="text-sm font-bold" style={{ color: s.color, fontFamily: 'Syne, sans-serif' }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl" style={{
                  background: isDark ? 'rgba(6,182,212,0.05)' : 'rgba(6,182,212,0.03)',
                  border: `1px solid rgba(6,182,212,0.15)`,
                }}>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Pada Semester 1 2026, Kabupaten Mempawah mencatatkan total produksi pembesaran ikan sebesar <strong className="text-foreground">1.815,29 Ton</strong> dengan nilai ekonomi <strong className="text-foreground">Rp 72,92 Miliar</strong>. 
                    Produksi didominasi oleh Nila (51,9%) dan Mas (27,2%) melalui sistem Jaring Apung Tawar. Terjadi penurunan signifikan di Juni (-15,3%) yang perlu diwaspadai. 
                    TW 1 menghasilkan 929,40 Ton sementara TW 2 turun ke 885,89 Ton (-4,7%). 
                    Kolam Air Tenang dengan 120 RTP (70% total) hanya menyumbang 11,9% produksi — mengindikasikan potensi peningkatan yang besar.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recommendations */}
          <div className="space-y-3">
            {DEFAULT_DATA.recommendations.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        {rec.severity === 'high' ? (
                          <AlertTriangle className="h-5 w-5 text-red-400" />
                        ) : rec.severity === 'medium' ? (
                          <AlertTriangle className="h-5 w-5 text-amber-400" />
                        ) : (
                          <Lightbulb className="h-5 w-5 text-emerald-400" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm">{rec.title}</h4>
                          <SeverityBadge severity={rec.severity} />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{rec.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Next Steps */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(6,182,212,0.06))'
                : 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(6,182,212,0.03))',
              border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
            }}>
              <CardContent className="p-5">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  Langkah Selanjutnya
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Lakukan disagregasi data Semester 1 ke level desa/kecamatan',
                    'Identifikasi desa dengan produktifitas di bawah rata-rata',
                    'Investigasi penyebab penurunan produksi Juni',
                    'Susun rencana alokasi benih Semester 2 berdasarkan data S1',
                    'Evaluasi efisiensi pakan (FCR) per kelompok pembudidaya',
                    'Proyeksikan target produksi Semester 2',
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #10B981, #06B6D4)' }}>
                        {i + 1}
                      </div>
                      <span className="text-xs">{step}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
