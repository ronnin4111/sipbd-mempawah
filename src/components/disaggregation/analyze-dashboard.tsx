'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Fish, TrendingUp, TrendingDown, AlertTriangle, Lightbulb,
  BarChart3, PieChart as PieIcon, Activity, MapPin, Users,
  Droplets, ArrowDownRight, ArrowUpRight, Target, ChevronRight,
  Scale, Layers, GitBranch, Zap, Shield, Info,
  UploadCloud, RefreshCw, Database, FileSpreadsheet, Calendar,
  ChevronDown,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';
import { useFilterStore } from '@/store/filter-store';

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
interface DashboardData {
  year: number;
  semester: number | null;
  source: 'upload' | 'disaggregation' | 'none';
  hasData: boolean;
  availableYears: number[];
  availableSemesters: number[];
  summary: {
    totalProduksiTon: number;
    totalNilaiRp: number;
    totalNilaiMiliar: number;
    totalRtp: number;
    totalPembudidaya: number;
    totalLuasLahan: number;
  };
  monthlyData: { bulan: string; bulanNum: number; produksi: number; nilai: number; tw: string }[];
  monthlyByKomoditas: Record<string, string | number>[];
  triwulanData: { name: string; produksi: number; nilai: number }[];
  komoditasData: { name: string; produksi: number; nilai: number; pakan: number; benih: number; pct: number }[];
  wadahData: { name: string; produksi: number; nilai: number; pct: number; rtp: number; pembudidaya: number; luasLahan: number }[];
  matrixData: Record<string, string | number>[];
  productivityData: Record<string, string | number>[];
  insights: { title: string; desc: string; severity: 'high' | 'medium' | 'low' }[];
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string;
}) {
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

// ─── Skeleton Loader ─────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────
function EmptyState({ year, semester }: { year: number; semester: number | null }) {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;
  const label = semester === 1 ? 'Semester 1 (Jan–Jun)' : semester === 2 ? 'Semester 2 (Jul–Des)' : 'Sepanjang Tahun';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(16,185,129,0.08))'
            : 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(16,185,129,0.05))',
          border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.15)'}`,
        }}
      >
        <UploadCloud className="h-9 w-9 text-cyan-500" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Belum Ada Data</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-1">
        Tidak ditemukan data analisis untuk tahun <strong>{year}</strong> — <strong>{label}</strong>.
      </p>
      <p className="text-xs text-muted-foreground text-center max-w-sm mb-6">
        Admin dapat mengunggah file Excel melalui fitur Upload Analisis atau memastikan data disagregasi sudah tersedia.
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileSpreadsheet className="h-3.5 w-3.5" />
        <span>Upload Excel</span>
        <span className="text-border">|</span>
        <Database className="h-3.5 w-3.5" />
        <span>Data Disagregasi</span>
      </div>
    </motion.div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────
export function AnalyzeDashboard() {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const currentYear = new Date().getFullYear();
  // Use shared store so SmartNarrator can access same filters
  const year = useFilterStore((s) => s.analyzeYear) || currentYear;
  const semester = useFilterStore((s) => s.analyzeSemester);
  const setYear = useFilterStore((s) => s.setAnalyzeYear);
  const setSemester = useFilterStore((s) => s.setAnalyzeSemester);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (semester !== null) params.set('semester', String(semester));
      const res = await fetch(`/api/analyze/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json as DashboardData);
    } catch (err) {
      console.error('[AnalyzeDashboard] fetch error:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, semester]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived wadah keys from matrix data for dynamic rendering
  const wadahKeys = useMemo(() => {
    if (!data?.matrixData?.length) return [];
    const keys = Object.keys(data.matrixData[0]).filter(k => k !== 'komoditas');
    return keys;
  }, [data?.matrixData]);

  // Derived productivity wadah keys
  const prodWadahKeys = useMemo(() => {
    if (!data?.productivityData?.length) return [];
    const keys = Object.keys(data.productivityData[0]).filter(k => k !== 'name');
    return keys;
  }, [data?.productivityData]);

  // Komoditas keys for monthly bar+line chart (exclude bulan/bulanNum/total meta fields)
  const monthlyKomoditasKeys = useMemo(() => {
    if (!data?.monthlyByKomoditas?.length) return [];
    const keys = Object.keys(data.monthlyByKomoditas[0]).filter(
      k => k !== 'bulan' && k !== 'bulanNum' && k !== 'total'
    );
    return keys;
  }, [data?.monthlyByKomoditas]);

  // Source badge
  const sourceBadge = useMemo(() => {
    if (!data) return null;
    if (data.source === 'upload') {
      return { icon: FileSpreadsheet, label: 'Upload Excel', color: 'text-cyan-400 border-cyan-500/30' };
    }
    if (data.source === 'disaggregation') {
      return { icon: Database, label: 'Disagregasi DB', color: 'text-emerald-400 border-emerald-500/30' };
    }
    return { icon: UploadCloud, label: 'No Data', color: 'text-muted-foreground border-border' };
  }, [data]);

  // Semester label
  const semesterLabel = useMemo(() => {
    if (semester === 1) return 'Semester 1 (Jan–Jun)';
    if (semester === 2) return 'Semester 2 (Jul–Des)';
    return 'Sepanjang Tahun';
  }, [semester]);

  // Triwulan diff calc
  const twDiff = useMemo(() => {
    if (!data?.triwulanData || data.triwulanData.length < 2) return null;
    const sorted = [...data.triwulanData].sort((a, b) => a.name.localeCompare(b.name));
    const first = sorted[0];
    const second = sorted[sorted.length - 1];
    if (first.produksi === 0) return null;
    const diffPct = ((first.produksi - second.produksi) / first.produksi) * 100;
    const diffTon = Math.abs(first.produksi - second.produksi);
    return { diffPct, diffTon, firstName: first.name, secondName: second.name, isDown: second.produksi < first.produksi };
  }, [data?.triwulanData]);

  // ─── Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-12 w-72 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-40 rounded-lg" />
          </div>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  // ─── No data at all ─────────────────────────────────────────────────
  if (!data || !data.hasData) {
    return (
      <div className="space-y-6">
        {/* Header with selectors (still functional even when no data) */}
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
                style={{ background: 'linear-gradient(135deg, #06B6D4, #10B981)', boxShadow: '0 4px 20px rgba(6,182,212,0.4)' }}
              >
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Analisis Data Disagregasi
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pembesaran Ikan — Kabupaten Mempawah, Kalimantan Barat
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[110px] h-9 text-xs">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(data?.availableYears?.length ? data.availableYears : [currentYear, currentYear - 1, currentYear - 2]).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex rounded-lg border overflow-hidden">
                {([null, 1, 2] as const).map((s) => (
                  <button
                    key={s ?? 'all'}
                    onClick={() => setSemester(s)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      semester === s
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : isDark ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === null ? 'Semua' : s === 1 ? 'S1' : 'S2'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
        <EmptyState year={year} semester={semester} />
      </div>
    );
  }

  // ─── Has data — render full dashboard ────────────────────────────────
  const s = data.summary;

  return (
    <div className="space-y-6">
      {/* ─── Header Banner ─────────────────────────────────────────────── */}
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
              style={{ background: 'linear-gradient(135deg, #06B6D4, #10B981)', boxShadow: '0 4px 20px rgba(6,182,212,0.4)' }}
            >
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                Analisis Data Disagregasi — {semesterLabel}, {year}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pembesaran Ikan — Kabupaten Mempawah, Kalimantan Barat
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Year Selector */}
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[110px] h-9 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Semester Pills */}
            <div className="flex rounded-lg border overflow-hidden">
              {([null, 1, 2] as const).map((sem) => (
                <button
                  key={sem ?? 'all'}
                  onClick={() => setSemester(sem)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    semester === sem
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {sem === null ? 'Semua' : sem === 1 ? 'S1 Jan–Jun' : 'S2 Jul–Des'}
                </button>
              ))}
            </div>

            {/* Source Badge */}
            {sourceBadge && (
              <Badge variant="outline" className={`text-xs gap-1 ${sourceBadge.color}`}>
                <sourceBadge.icon className="h-3 w-3" /> {sourceBadge.label}
              </Badge>
            )}

            {/* Refresh */}
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ─── Stat Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Fish}
          label="Total Produksi"
          value={`${s.totalProduksiTon.toLocaleString('id-ID', { maximumFractionDigits: 2 })} Ton`}
          sub={`${data.komoditasData.length} komoditas × ${data.wadahData.length} jenis wadah`}
          trend="neutral"
          color="#06B6D4"
          delay={0.05}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Nilai Produksi"
          value={`Rp ${s.totalNilaiMiliar.toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`}
          sub={`Nilai ekonomi ${semesterLabel}`}
          trend="up"
          color="#10B981"
          delay={0.1}
        />
        <StatCard
          icon={Users}
          label="Total Pembudidaya"
          value={`${s.totalPembudidaya.toLocaleString('id-ID')} Orang`}
          sub={`${s.totalRtp.toLocaleString('id-ID')} RTP aktif`}
          trend="neutral"
          color="#F59E0B"
          delay={0.15}
        />
        <StatCard
          icon={MapPin}
          label="Luas Lahan"
          value={s.totalLuasLahan > 0 ? `${(s.totalLuasLahan / 10000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Ha` : '—'}
          sub={s.totalLuasLahan > 0 ? `${s.totalLuasLahan.toLocaleString('id-ID')} m² produktif` : 'Data belum tersedia'}
          trend="neutral"
          color="#8B5CF6"
          delay={0.2}
        />
      </div>

      {/* ─── Main Charts Tabs ───────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-4 h-10">
          <TabsTrigger value="overview" className="text-xs gap-1"><PieIcon className="h-3.5 w-3.5 hidden sm:inline" /> Ringkasan</TabsTrigger>
          <TabsTrigger value="trend" className="text-xs gap-1"><Activity className="h-3.5 w-3.5 hidden sm:inline" /> Tren</TabsTrigger>
          <TabsTrigger value="matrix" className="text-xs gap-1"><Layers className="h-3.5 w-3.5 hidden sm:inline" /> Matrix</TabsTrigger>
          <TabsTrigger value="insights" className="text-xs gap-1"><Lightbulb className="h-3.5 w-3.5 hidden sm:inline" /> Insight</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ────────────────────────────────────────────── */}
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
                    <BarChart data={data.komoditasData} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="produksi" name="Produksi (Ton)" radius={[0, 4, 4, 0]}>
                        {data.komoditasData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={KOMODITAS_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pie Chart - Distribusi per Jenis Wadah */}
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
                        data={data.wadahData}
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
                        {data.wadahData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={WADAH_COLORS[entry.name] || CHART_COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Wadah Stats */}
                  <div className={`grid gap-2 mt-2 ${data.wadahData.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {data.wadahData.map((w) => (
                      <div key={w.name} className="text-center p-2 rounded-lg" style={{ background: `${WADAH_COLORS[w.name] || CHART_COLORS[0]}10` }}>
                        <p className="text-[10px] text-muted-foreground truncate">{w.name.split(' ').slice(0, 2).join(' ')}</p>
                        <p className="text-xs font-bold" style={{ color: WADAH_COLORS[w.name] || CHART_COLORS[0] }}>{w.produksi.toLocaleString('id-ID', { maximumFractionDigits: 0 })} Ton</p>
                        <p className="text-[9px] text-muted-foreground">{w.rtp} RTP / {w.pembudidaya} org</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Nilai Produksi per Komoditas */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    Nilai Produksi per Komoditas (Rp Juta)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={data.komoditasData} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="nilai" name="Nilai (Rp Juta)" radius={[4, 4, 0, 0]}>
                        {data.komoditasData.map((entry, index) => (
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
                  {data.triwulanData.length > 0 ? (
                    <>
                      <div className={`grid gap-4 mb-4 ${data.triwulanData.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
                        {data.triwulanData.map((tw, i) => {
                          const twColors = ['#06B6D4', '#F59E0B', '#10B981', '#8B5CF6'];
                          const c = twColors[i % twColors.length];
                          return (
                            <div key={tw.name} className="text-center p-4 rounded-xl" style={{
                              background: `${c}15`,
                              border: `1px solid ${c}25`,
                            }}>
                              <p className="text-xs text-muted-foreground mb-1">{tw.name}</p>
                              <p className="text-2xl font-bold" style={{ color: c, fontFamily: 'Syne, sans-serif' }}>
                                {tw.produksi.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Ton</p>
                              <p className="text-xs mt-1 text-muted-foreground">Rp {tw.nilai.toLocaleString('id-ID', { maximumFractionDigits: 0 })} M</p>
                            </div>
                          );
                        })}
                      </div>
                      {twDiff && twDiff.isDown && (
                        <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                          <p className="text-xs flex items-center gap-1.5 text-red-400">
                            <ArrowDownRight className="h-3.5 w-3.5" />
                            {twDiff.secondName} turun <strong>{twDiff.diffPct.toFixed(1)}%</strong> dari {twDiff.firstName} (selisih {twDiff.diffTon.toFixed(1)} Ton)
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Data triwulan tidak tersedia</p>
                  )}

                  {/* Productivity per Wadah */}
                  {data.wadahData.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Produktifitas per Jenis Wadah</p>
                      {data.wadahData.map((w) => {
                        const maxProd = Math.max(...data.wadahData.map((wd) => wd.luasLahan > 0 ? (wd.produksi * 1000) / wd.luasLahan : 0), 1);
                        const val = w.luasLahan > 0 ? (w.produksi * 1000) / w.luasLahan : 0;
                        const color = WADAH_COLORS[w.name] || CHART_COLORS[0];
                        return (
                          <div key={w.name} className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground">{w.name}</span>
                              <span className="font-medium" style={{ color }}>{val.toFixed(1)} kg/m²</span>
                            </div>
                            <Progress value={(val / maxProd) * 100} className="h-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ─── TREND TAB ────────────────────────────────────────────────── */}
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
                  {data.monthlyData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={340}>
                        <ComposedChart data={data.monthlyByKomoditas} margin={{ left: 10, right: 10, top: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                          <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                          <YAxis tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          {monthlyKomoditasKeys.map((k, i) => (
                            <Bar
                              key={k}
                              dataKey={k}
                              stackId="komoditas"
                              fill={KOMODITAS_COLORS[k] || CHART_COLORS[i % CHART_COLORS.length]}
                              radius={i === monthlyKomoditasKeys.length - 1 ? [4, 4, 0, 0] : undefined}
                              maxBarSize={48}
                            />
                          ))}
                          <Line
                            type="monotone"
                            dataKey="total"
                            name="Total Produksi (Ton)"
                            stroke={isDark ? '#FBBF24' : '#0F172A'}
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: isDark ? '#FBBF24' : '#0F172A', stroke: isDark ? '#0D1B2E' : '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                      {/* MoM Changes */}
                      {data.monthlyData.length > 1 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {data.monthlyData.slice(1).map((m, i) => {
                            const prev = data.monthlyData[i].produksi;
                            if (prev === 0) return null;
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
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-16">Data bulanan tidak tersedia</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Monthly Stacked by Komoditas — from matrix-like data */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-violet-500" />
                    Komoditas × Wadah — Stacked (Ton)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.matrixData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={data.matrixData} margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                        <XAxis dataKey="komoditas" tick={{ fontSize: 9, fill: isDark ? '#94A3B8' : '#64748B' }} />
                        <YAxis tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        {wadahKeys.map((w, i) => (
                          <Bar
                            key={w} dataKey={w} stackId="a"
                            fill={WADAH_COLORS[w] || CHART_COLORS[i % CHART_COLORS.length]}
                            radius={i === wadahKeys.length - 1 ? [4, 4, 0, 0] : undefined}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-16">Data matrix tidak tersedia</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Value Trend */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Tren Nilai Produksi Bulanan (Rp Juta)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={data.monthlyData} margin={{ left: 10, right: 10 }}>
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
                        <Area
                          type="monotone" dataKey="nilai" name="Nilai (Rp Juta)"
                          stroke="#10B981" fill="url(#valGradient)" strokeWidth={2.5}
                          dot={{ r: 4, fill: '#10B981', stroke: isDark ? '#0D1B2E' : '#fff', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-16">Data nilai bulanan tidak tersedia</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Populasi & RTP per Wadah */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-500" />
                    Data Populasi per Jenis Wadah
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.wadahData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={data.wadahData} margin={{ left: 10, right: 10 }}>
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
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-16">Data populasi tidak tersedia</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ─── MATRIX TAB ────────────────────────────────────────────────── */}
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
                  {data.matrixData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={data.matrixData} margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                        <XAxis dataKey="komoditas" tick={{ fontSize: 9, fill: isDark ? '#94A3B8' : '#64748B' }} />
                        <YAxis tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        {wadahKeys.map((w, i) => (
                          <Bar
                            key={w} dataKey={w} stackId="a"
                            fill={WADAH_COLORS[w] || CHART_COLORS[i % CHART_COLORS.length]}
                            radius={i === wadahKeys.length - 1 ? [4, 4, 0, 0] : undefined}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-16">Data matrix tidak tersedia</p>
                  )}
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
                  {data.productivityData.length > 0 && prodWadahKeys.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <RadarChart data={data.productivityData.map((d) => ({
                        ...d,
                        komoditas: d.name,
                      }))}>
                        <PolarGrid stroke={isDark ? '#1E3A5F' : '#E5E7EB'} />
                        <PolarAngleAxis dataKey="komoditas" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                        <PolarRadiusAxis tick={{ fontSize: 8, fill: isDark ? '#94A3B8' : '#64748B' }} />
                        {prodWadahKeys.map((w, i) => {
                          const color = WADAH_COLORS[w] || CHART_COLORS[i % CHART_COLORS.length];
                          const shortName = w.split(' ').slice(0, 2).join(' ');
                          return (
                            <Radar key={w} name={shortName} dataKey={w} stroke={color} fill={color} fillOpacity={0.2} />
                          );
                        })}
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-16">Data produktifitas tidak tersedia</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Possibility / Use-case cards */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-2">
              <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Apa yang Bisa Dilakukan dengan Data Ini?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      {
                        icon: GitBranch,
                        title: 'Disagregasi ke Level Desa',
                        desc: 'Pecah data agregat kabupaten menjadi data per desa/kecamatan berdasarkan proporsi RTP dan luas lahan.',
                        color: '#06B6D4',
                        tag: 'Fitur Utama',
                      },
                      {
                        icon: Target,
                        title: 'Analisis Kesenjangan Produktifitas',
                        desc: `Identifikasi komoditas/wadah dengan produktifitas di bawah rata-rata. ${data.komoditasData[0]?.name || 'Komoditas utama'} mendominasi ${data.komoditasData[0]?.pct.toFixed(1) || '—'}% produksi.`,
                        color: '#EF4444',
                        tag: 'Analisis',
                      },
                      {
                        icon: TrendingDown,
                        title: 'Deteksi Penurunan Produksi',
                        desc: 'Monitor perubahan produksi bulanan/triwulanan. Identifikasi bulan dengan penurunan signifikan untuk investigasi.',
                        color: '#F59E0B',
                        tag: 'Prioritas',
                      },
                      {
                        icon: Scale,
                        title: 'Perencanaan Alokasi Benih',
                        desc: `Total benih: ${data.komoditasData.reduce((s, k) => s + k.benih, 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })} ekor. Disagregasi memungkinkan alokasi per desa lebih tepat.`,
                        color: '#10B981',
                        tag: 'Perencanaan',
                      },
                      {
                        icon: Shield,
                        title: 'Evaluasi Efisiensi Pakan',
                        desc: `Total pakan: ${data.komoditasData.reduce((s, k) => s + k.pakan, 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })} kg. Analisis FCR per kelompok untuk best practices.`,
                        color: '#8B5CF6',
                        tag: 'Efisiensi',
                      },
                      {
                        icon: BarChart3,
                        title: 'Proyeksi & Target',
                        desc: `Berdasarkan tren, target produksi berikutnya bisa dihitung. Produksi saat ini ${s.totalProduksiTon.toLocaleString('id-ID', { maximumFractionDigits: 0 })} Ton.`,
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
                          style={{ background: `${item.color}08`, borderColor: `${item.color}20` }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}15` }}>
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

        {/* ─── INSIGHTS TAB ─────────────────────────────────────────────── */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          {/* Executive Summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-cyan-500" />
                  Ringkasan Eksekutif — {semesterLabel} {year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Total Produksi', value: `${s.totalProduksiTon.toLocaleString('id-ID', { maximumFractionDigits: 2 })} Ton`, color: '#06B6D4' },
                    { label: 'Total Nilai', value: `Rp ${s.totalNilaiMiliar.toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`, color: '#10B981' },
                    { label: 'Komoditas Terbesar', value: data.komoditasData[0] ? `${data.komoditasData[0].name} (${data.komoditasData[0].pct.toFixed(1)}%)` : '—', color: '#F59E0B' },
                    { label: 'Wadah Terbesar', value: data.wadahData[0] ? `${data.wadahData[0].name.split(' ').slice(0, 2).join(' ')} (${data.wadahData[0].pct.toFixed(1)}%)` : '—', color: '#8B5CF6' },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-lg text-center" style={{ background: `${item.color}08`, border: `1px solid ${item.color}15` }}>
                      <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                      <p className="text-sm font-bold" style={{ color: item.color, fontFamily: 'Syne, sans-serif' }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl" style={{
                  background: isDark ? 'rgba(6,182,212,0.05)' : 'rgba(6,182,212,0.03)',
                  border: '1px solid rgba(6,182,212,0.15)',
                }}>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Pada {semesterLabel} {year}, Kabupaten Mempawah mencatatkan total produksi pembesaran ikan sebesar{' '}
                    <strong className="text-foreground">{s.totalProduksiTon.toLocaleString('id-ID', { maximumFractionDigits: 2 })} Ton</strong> dengan nilai ekonomi{' '}
                    <strong className="text-foreground">Rp {s.totalNilaiMiliar.toLocaleString('id-ID', { maximumFractionDigits: 2 })} Miliar</strong>.
                    {data.komoditasData.length > 0 && (
                      <> Produksi didominasi oleh {data.komoditasData[0].name} ({data.komoditasData[0].pct.toFixed(1)}%){data.wadahData.length > 0 && <> melalui sistem {data.wadahData[0].name}</>}.</>
                    )}
                    {twDiff && twDiff.isDown && (
                      <> Terjadi perbedaan antara {twDiff.firstName} dan {twDiff.secondName} sebesar {twDiff.diffPct.toFixed(1)}%.</>
                    )}
                    {s.totalRtp > 0 && (
                      <> Total {s.totalRtp.toLocaleString('id-ID')} RTP dengan {s.totalPembudidaya.toLocaleString('id-ID')} pembudidaya aktif.</>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recommendations / Insights */}
          {data.insights.length > 0 ? (
            <div className="space-y-3">
              {data.insights.map((rec, i) => (
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
          ) : (
            <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
              <CardContent className="p-8 text-center">
                <Lightbulb className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Belum ada insight yang tersedia untuk periode ini.</p>
              </CardContent>
            </Card>
          )}

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
                    'Lakukan disagregasi data ke level desa/kecamatan',
                    'Identifikasi desa dengan produktifitas di bawah rata-rata',
                    'Investigasi penyebab penurunan produksi jika ada',
                    'Susun rencana alokasi benih berdasarkan data aktual',
                    'Evaluasi efisiensi pakan (FCR) per kelompok pembudidaya',
                    'Proyeksikan target produksi periode berikutnya',
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
