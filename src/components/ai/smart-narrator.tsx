'use client';

import { useState } from 'react';
import { Sparkles, FileText, TrendingUp, MapPin, Target, Loader2, Copy, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { useFishFarmStats } from '@/hooks/use-fish-farms';
import { useFilterStore } from '@/store/filter-store';
import { motion, AnimatePresence } from 'framer-motion';

type NarrationType = 'summary' | 'trend' | 'kecamatan' | 'target';

const NARRATION_OPTIONS: { type: NarrationType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: 'summary', label: 'Ringkasan', icon: FileText, desc: 'Narasi ringkasan produksi' },
  { type: 'trend', label: 'Analisis Tren', icon: TrendingUp, desc: 'Tren 5 tahun terakhir' },
  { type: 'kecamatan', label: 'Perbandingan Wilayah', icon: MapPin, desc: 'Perbandingan antar kecamatan' },
  { type: 'target', label: 'Pencapaian Target', icon: Target, desc: 'Target vs realisasi' },
];

export function SmartNarrator() {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeType, setActiveType] = useState<NarrationType | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ error: string; detail: string } | null>(null);
  const { data: stats } = useFishFarmStats();
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);

  const generateNarration = async (type: NarrationType) => {
    if (isLoading) return;
    if (!stats) {
      setErrorInfo({
        error: 'Data statistik belum tersedia',
        detail: 'Tunggu hingga data selesai dimuat, lalu coba lagi.',
      });
      return;
    }

    setIsLoading(true);
    setActiveType(type);
    setNarrative(null);
    setErrorInfo(null);

    try {
      const statsContext = {
        periodLabel: stats.periodLabel,
        currentYear: stats.currentYear,
        pembesaranProduction: stats.pembesaranProduction,
        pembenihanProduction: stats.pembenihanProduction,
        totalRtp: stats.totalRtp,
        totalFarmer: stats.totalFarmer,
        totalGroup: stats.totalGroup,
        totalKusuka: stats.totalKusuka,
        productionByFishType: stats.productionByFishType,
        productionByKecamatan: stats.productionByKecamatan,
        productionByKecamatanDetail: stats.productionByKecamatanDetail,
        productionByFishTypeDetail: stats.productionByFishTypeDetail,
        trend5Year: stats.trend5Year,
        targetVsRealisasiPembesaran: stats.targetVsRealisasiPembesaran,
        targetVsRealisasiPembenihan: stats.targetVsRealisasiPembenihan,
        activeFilters: {
          years: years.length > 0 ? years : 'Semua tahun',
          kecamatan: kecamatan.length > 0 ? kecamatan : 'Semua kecamatan',
          fishType: fishType.length > 0 ? fishType : 'Semua jenis ikan',
          containerType: containerType.length > 0 ? containerType : 'Semua wadah',
          businessType: businessType.length > 0 ? businessType : 'Semua jenis usaha',
        },
      };

      const response = await fetch('/api/ai/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statsContext, type }),
      });

      const data = await response.json();

      if (data.success) {
        setNarrative(data.narrative);
        setErrorInfo(null);
      } else {
        setNarrative(null);
        setErrorInfo({
          error: data.error || 'Gagal menghasilkan narasi',
          detail: data.detail || '',
        });
      }
    } catch {
      setNarrative(null);
      setErrorInfo({
        error: 'Gagal menghasilkan narasi',
        detail: 'Periksa koneksi internet dan coba lagi.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (narrative) {
      navigator.clipboard.writeText(narrative);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isApiKeyError = errorInfo?.detail?.includes('API Key belum dikonfigurasi') ||
    errorInfo?.detail?.includes('🔑');

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
        >
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Narasi Cerdas AI
          </div>
          <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            Auto-generate narasi laporan dari data aktif
          </div>
        </div>
      </div>

      {/* Type selector */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {NARRATION_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = activeType === opt.type;
          return (
            <button
              key={opt.type}
              onClick={() => generateNarration(opt.type)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all disabled:opacity-50"
              style={{
                borderColor: isActive ? '#06B6D4' : 'var(--border)',
                background: isActive ? 'rgba(6,182,212,0.1)' : 'transparent',
                color: isActive ? '#06B6D4' : 'var(--muted-foreground)',
              }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <div className="text-left">
                <div className="font-semibold">{opt.label}</div>
                <div className="text-[9px] opacity-70 hidden sm:block">{opt.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Narrative output */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-4"
          >
            <div
              className="rounded-lg p-4 flex items-center gap-3"
              style={{ background: 'var(--muted)' }}
            >
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#06B6D4' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                AI sedang menyusun narasi...
              </span>
            </div>
          </motion.div>
        )}

        {narrative && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 pb-4"
          >
            <div
              className="rounded-lg p-4 relative"
              style={{ background: 'var(--muted)' }}
            >
              <button
                onClick={copyToClipboard}
                className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                style={{
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                }}
                title="Salin narasi"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
                )}
              </button>
              <div
                className="text-xs leading-relaxed whitespace-pre-wrap pr-8"
                style={{ color: 'var(--foreground)' }}
              >
                {narrative}
              </div>
            </div>
          </motion.div>
        )}

        {errorInfo && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 pb-4"
          >
            <div
              className="rounded-lg p-4"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
                    {errorInfo.error}
                  </div>
                  <div className="text-[11px] text-red-500/80 dark:text-red-400/70 leading-relaxed">
                    {errorInfo.detail}
                  </div>
                  {isApiKeyError && (
                    <div className="mt-2 text-[11px] text-red-500/70 dark:text-red-400/60">
                      💡 Buka chat AI → klik ⚙️ → masukkan API key Gemini atau Groq (gratis!)
                    </div>
                  )}
                  <button
                    onClick={() => activeType && generateNarration(activeType)}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
                    style={{
                      color: 'var(--foreground)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Coba Lagi
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
