'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fish, Users, MapPin, LayoutDashboard, Database, Map,
  TrendingUp, Briefcase, IdCard, FileCheck, Microscope,
  ChevronRight, ChevronLeft, Play, RotateCcw,
  Sparkles, Waves, Globe, BarChart3, CreditCard, Share2,
  MonitorSmartphone, Shield, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';
import { useFilterStore } from '@/store/filter-store';

// ─── Scene definitions ──────────────────────────────────────────────────────
const SCENES = [
  { id: 'intro', duration: 5500 },
  { id: 'about', duration: 6000 },
  { id: 'features-data', duration: 6500 },
  { id: 'features-visual', duration: 6500 },
  { id: 'features-layanan', duration: 6000 },
  { id: 'stats', duration: 6500 },
  { id: 'closing', duration: 8000 },
];

// ─── Animated counter hook ──────────────────────────────────────────────────
function useAnimatedNumber(target: number, isActive: boolean, duration = 2000) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    let start: number;
    let frame: number;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target, isActive, duration]);

  // Reset to 0 when not active using a derived value
  const displayValue = isActive ? value : 0;
  return displayValue;
}

// ─── Floating particles background ──────────────────────────────────────────
function LaunchParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;

    type P = { x: number; y: number; r: number; dx: number; dy: number; o: number };
    const particles: P[] = [];
    const COUNT = 80;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        r: Math.random() * 2.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.3,
        o: Math.random() * 0.4 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      particles.forEach((p) => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(6,182,212,${p.o})`
          : `rgba(8,145,178,${p.o * 0.5})`;
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = isDark
              ? `rgba(6,182,212,${0.07 * (1 - dist / 130)})`
              : `rgba(8,145,178,${0.04 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [isDark]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} />;
}

// ─── Scene: Intro ───────────────────────────────────────────────────────────
function SceneIntro({ isActive }: { isActive: boolean }) {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={isActive ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -180 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="mb-8"
      >
        <div
          className="w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, rgba(6,182,212,0.05) 70%, transparent 100%)'
              : 'radial-gradient(circle, rgba(8,145,178,0.15) 0%, rgba(8,145,178,0.03) 70%, transparent 100%)',
            border: `2px solid ${isDark ? 'rgba(6,182,212,0.3)' : 'rgba(8,145,178,0.2)'}`,
            boxShadow: `0 0 60px ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(8,145,178,0.1)'}`,
          }}
        >
          <img
            src="/logo-sipbk-transparent.png"
            alt="Logo SIPBK"
            className="w-16 h-16 sm:w-24 sm:h-24 object-contain"
            style={{ filter: isDark ? 'brightness(1.2) drop-shadow(0 0 12px rgba(6,182,212,0.3))' : 'none' }}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
          style={{ fontFamily: 'Syne, sans-serif', color: isDark ? '#F0F9FF' : '#0C4A6E' }}
        >
          SIPBD
          <span style={{ color: '#06B6D4' }}> Mempawah</span>
        </h1>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8, delay: 1.4 }}
        className="text-sm sm:text-base max-w-lg leading-relaxed"
        style={{ color: isDark ? 'rgba(186,230,253,0.8)' : 'rgba(12,74,110,0.7)' }}
      >
        Sistem Informasi Perikanan Budidaya
        <br />
        Kabupaten Mempawah, Kalimantan Barat
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={isActive ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1, delay: 2.2 }}
        className="mt-6 flex items-center gap-2"
        style={{ color: isDark ? 'rgba(6,182,212,0.6)' : 'rgba(8,145,178,0.5)' }}
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-xs tracking-widest uppercase font-medium">Website Launching 2025</span>
        <Sparkles className="h-4 w-4" />
      </motion.div>
    </div>
  );
}

// ─── Scene: About ───────────────────────────────────────────────────────────
function SceneAbout({ isActive }: { isActive: boolean }) {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const items = [
    { icon: <Fish className="h-6 w-6" />, label: 'Perikanan Budidaya', desc: 'Data produksi ikan terintegrasi' },
    { icon: <MapPin className="h-6 w-6" />, label: '9 Kecamatan', desc: 'Sebaran data seluruh Kab. Mempawah' },
    { icon: <Shield className="h-6 w-6" />, label: 'Resmi Pemerintah', desc: 'Dinas Pertanian KP & Perikanan' },
    { icon: <MonitorSmartphone className="h-6 w-6" />, label: 'Akses Digital', desc: 'Dashboard interaktif & realtime' },
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="mb-3"
      >
        <span
          className="text-xs tracking-[0.3em] uppercase font-semibold"
          style={{ color: '#06B6D4' }}
        >
          Tentang Kami
        </span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3"
        style={{ fontFamily: 'Syne, sans-serif', color: isDark ? '#F0F9FF' : '#0C4A6E' }}
      >
        Dinas Pertanian Ketahanan
        <br />
        Pangan & Perikanan
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-sm sm:text-base max-w-xl mb-8 leading-relaxed"
        style={{ color: isDark ? 'rgba(186,230,253,0.7)' : 'rgba(12,74,110,0.6)' }}
      >
        Platform digital terpadu untuk mengelola, memantau, dan menganalisis data perikanan budidaya
        di Kabupaten Mempawah secara transparan dan akuntabel.
      </motion.p>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-lg w-full">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={isActive ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.5, delay: 0.6 + i * 0.15 }}
            className="flex flex-col items-center p-4 rounded-2xl"
            style={{
              background: isDark ? 'rgba(13,27,46,0.6)' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${isDark ? 'rgba(6,182,212,0.15)' : 'rgba(8,145,178,0.1)'}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2"
              style={{
                background: isDark ? 'rgba(6,182,212,0.12)' : 'rgba(8,145,178,0.08)',
                border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(8,145,178,0.15)'}`,
                color: '#06B6D4',
              }}
            >
              {item.icon}
            </div>
            <h4 className="text-sm font-semibold mb-0.5" style={{ color: isDark ? '#F0F9FF' : '#0C4A6E' }}>{item.label}</h4>
            <p className="text-[10px] sm:text-xs" style={{ color: isDark ? 'rgba(186,230,253,0.6)' : 'rgba(12,74,110,0.5)' }}>{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Scene: Features - Data ─────────────────────────────────────────────────
function SceneFeaturesData({ isActive }: { isActive: boolean }) {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const features = [
    { icon: <Database className="h-7 w-7" />, title: 'Data Pembudidaya', desc: 'Database lengkap pembudidaya ikan di seluruh kecamatan dengan filter interaktif', color: '#06B6D4' },
    { icon: <CreditCard className="h-7 w-7" />, title: 'Data KUSUKA', desc: 'Sistem registrasi Kartu Usaha Perikanan untuk identitas pelaku usaha', color: '#8B5CF6' },
    { icon: <Share2 className="h-7 w-7" />, title: 'Import / Export', desc: 'Kelola data dengan import Excel dan export ke format Excel atau PDF', color: '#10B981' },
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="mb-2"
      >
        <span className="text-xs tracking-[0.3em] uppercase font-semibold" style={{ color: '#06B6D4' }}>
          Fitur Unggulan
        </span>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-8"
        style={{ fontFamily: 'Syne, sans-serif', color: isDark ? '#F0F9FF' : '#0C4A6E' }}
      >
        Manajemen <span style={{ color: '#06B6D4' }}>Data</span>
      </motion.h2>

      <div className="space-y-4 sm:space-y-5 max-w-lg w-full">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, x: -40 }}
            animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.2 }}
            className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl text-left"
            style={{
              background: isDark ? 'rgba(13,27,46,0.6)' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${isDark ? 'rgba(6,182,212,0.12)' : 'rgba(8,145,178,0.08)'}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `${f.color}15`,
                border: `1px solid ${f.color}30`,
                color: f.color,
              }}
            >
              {f.icon}
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold mb-1" style={{ color: isDark ? '#F0F9FF' : '#0C4A6E' }}>{f.title}</h4>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: isDark ? 'rgba(186,230,253,0.65)' : 'rgba(12,74,110,0.55)' }}>{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Scene: Features - Visualisasi ──────────────────────────────────────────
function SceneFeaturesVisual({ isActive }: { isActive: boolean }) {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const features = [
    { icon: <Map className="h-7 w-7" />, title: 'Peta Lokasi', desc: 'Visualisasi sebaran lokasi budidaya di peta interaktif', color: '#8B5CF6' },
    { icon: <TrendingUp className="h-7 w-7" />, title: 'Tren & Laporan', desc: 'Analisis tren produksi per tahun dengan grafik komprehensif', color: '#F59E0B' },
    { icon: <BarChart3 className="h-7 w-7" />, title: 'Dashboard Interaktif', desc: 'Ringkasan statistik & chart real-time dalam satu tampilan', color: '#06B6D4' },
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="mb-2"
      >
        <span className="text-xs tracking-[0.3em] uppercase font-semibold" style={{ color: '#8B5CF6' }}>
          Fitur Unggulan
        </span>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-8"
        style={{ fontFamily: 'Syne, sans-serif', color: isDark ? '#F0F9FF' : '#0C4A6E' }}
      >
        Visualisasi <span style={{ color: '#8B5CF6' }}>Data</span>
      </motion.h2>

      <div className="space-y-4 sm:space-y-5 max-w-lg w-full">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, x: 40 }}
            animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.2 }}
            className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl text-left"
            style={{
              background: isDark ? 'rgba(13,27,46,0.6)' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)'}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `${f.color}15`,
                border: `1px solid ${f.color}30`,
                color: f.color,
              }}
            >
              {f.icon}
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold mb-1" style={{ color: isDark ? '#F0F9FF' : '#0C4A6E' }}>{f.title}</h4>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: isDark ? 'rgba(186,230,253,0.65)' : 'rgba(12,74,110,0.55)' }}>{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Scene: Features - Layanan ──────────────────────────────────────────────
function SceneFeaturesLayanan({ isActive }: { isActive: boolean }) {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const services = [
    { icon: <IdCard className="h-6 w-6" />, title: 'Kartu E-KUSUKA', desc: 'Identitas digital pelaku perikanan', color: '#10B981' },
    { icon: <FileCheck className="h-6 w-6" />, title: 'NIB', desc: 'Nomor Induk Berusaha via OSS', color: '#3B82F6' },
    { icon: <Microscope className="h-6 w-6" />, title: 'CPIB', desc: 'Cara Pembenihan Ikan yang Baik', color: '#F59E0B' },
    { icon: <Fish className="h-6 w-6" />, title: 'CBIB', desc: 'Cara Budidaya Ikan yang Baik', color: '#06B6D4' },
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="mb-2"
      >
        <span className="text-xs tracking-[0.3em] uppercase font-semibold" style={{ color: '#10B981' }}>
          Layanan Publik
        </span>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-8"
        style={{ fontFamily: 'Syne, sans-serif', color: isDark ? '#F0F9FF' : '#0C4A6E' }}
      >
        Layanan <span style={{ color: '#10B981' }}>Perikanan</span>
      </motion.h2>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg w-full">
        {services.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.15 }}
            className="flex flex-col items-center p-4 sm:p-5 rounded-2xl"
            style={{
              background: isDark ? 'rgba(13,27,46,0.6)' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)'}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-2 sm:mb-3"
              style={{
                background: `${s.color}12`,
                border: `1px solid ${s.color}25`,
                color: s.color,
              }}
            >
              {s.icon}
            </div>
            <h4 className="text-xs sm:text-sm font-bold mb-0.5" style={{ color: isDark ? '#F0F9FF' : '#0C4A6E' }}>{s.title}</h4>
            <p className="text-[10px] sm:text-xs" style={{ color: isDark ? 'rgba(186,230,253,0.6)' : 'rgba(12,74,110,0.5)' }}>{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Scene: Stats ───────────────────────────────────────────────────────────
function SceneStats({ isActive }: { isActive: boolean }) {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const StatItem = ({ value, label, unit, color, icon, delay }: {
    value: number; label: string; unit: string; color: string; icon: React.ReactNode; delay: number;
  }) => {
    const animatedVal = useAnimatedNumber(value, isActive, 2000);
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.5, delay }}
        className="flex flex-col items-center p-4 sm:p-6 rounded-2xl"
        style={{
          background: isDark ? 'rgba(13,27,46,0.6)' : 'rgba(255,255,255,0.7)',
          border: `1px solid ${isDark ? 'rgba(6,182,212,0.12)' : 'rgba(8,145,178,0.08)'}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2"
          style={{ background: `${color}12`, border: `1px solid ${color}25`, color }}
        >
          {icon}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl sm:text-3xl lg:text-4xl font-bold tabular-nums" style={{ color: isDark ? '#F0F9FF' : '#0C4A6E' }}>
            {new Intl.NumberFormat('id-ID').format(animatedVal)}
          </span>
          <span className="text-xs sm:text-sm font-semibold" style={{ color }}>{unit}</span>
        </div>
        <span className="text-[10px] sm:text-xs mt-1 text-center" style={{ color: isDark ? 'rgba(186,230,253,0.6)' : 'rgba(12,74,110,0.5)' }}>{label}</span>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="mb-2"
      >
        <span className="text-xs tracking-[0.3em] uppercase font-semibold" style={{ color: '#06B6D4' }}>
          Dalam Angka
        </span>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-8"
        style={{ fontFamily: 'Syne, sans-serif', color: isDark ? '#F0F9FF' : '#0C4A6E' }}
      >
        Data <span style={{ color: '#06B6D4' }}>Terintegrasi</span>
      </motion.h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl w-full">
        <StatItem value={9} label="Kecamatan" unit="Kec." color="#06B6D4" icon={<MapPin className="h-5 w-5" />} delay={0.3} />
        <StatItem value={70} label="Desa / Kelurahan" unit="Desa" color="#8B5CF6" icon={<Globe className="h-5 w-5" />} delay={0.45} />
        <StatItem value={12} label="Jenis Komoditas Ikan" unit="Jenis" color="#10B981" icon={<Fish className="h-5 w-5" />} delay={0.6} />
        <StatItem value={11} label="Tipe Wadah Budidaya" unit="Tipe" color="#F59E0B" icon={<Waves className="h-5 w-5" />} delay={0.75} />
        <StatItem value={2} label="Jenis Usaha" unit="Jenis" color="#3B82F6" icon={<Briefcase className="h-5 w-5" />} delay={0.9} />
        <StatItem value={10} label="Tahun Data Tersedia" unit="Tahun" color="#EF4444" icon={<BarChart3 className="h-5 w-5" />} delay={1.05} />
      </div>
    </div>
  );
}

// ─── Scene: Closing ─────────────────────────────────────────────────────────
function SceneClosing({ isActive, onVisit }: { isActive: boolean; onVisit: () => void }) {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={isActive ? { scale: 1 } : { scale: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="mb-6"
      >
        <div
          className="w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(8,145,178,0.12) 0%, transparent 70%)',
            border: `2px solid ${isDark ? 'rgba(6,182,212,0.3)' : 'rgba(8,145,178,0.2)'}`,
            boxShadow: `0 0 80px ${isDark ? 'rgba(6,182,212,0.15)' : 'rgba(8,145,178,0.08)'}`,
          }}
        >
          <Zap className="h-10 w-10 sm:h-14 sm:w-14" style={{ color: '#06B6D4' }} />
        </div>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4"
        style={{ fontFamily: 'Syne, sans-serif', color: isDark ? '#F0F9FF' : '#0C4A6E' }}
      >
        Akses <span style={{ color: '#06B6D4' }}>Sekarang</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="text-sm sm:text-base max-w-md mb-8 leading-relaxed"
        style={{ color: isDark ? 'rgba(186,230,253,0.7)' : 'rgba(12,74,110,0.6)' }}
      >
        Jelajahi dashboard perikanan budidaya Kabupaten Mempawah
        <br />
        secara interaktif dan real-time
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 1.1 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <Button
          onClick={onVisit}
          size="lg"
          className="gap-2 text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6"
          style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
        >
          <LayoutDashboard className="h-5 w-5" />
          Buka Dashboard
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={isActive ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 1.5 }}
        className="mt-8 flex items-center gap-2"
        style={{ color: isDark ? 'rgba(186,230,253,0.5)' : 'rgba(12,74,110,0.4)' }}
      >
        <Globe className="h-4 w-4" />
        <span className="text-xs sm:text-sm font-medium">sipbd-mempawah.vercel.app</span>
      </motion.div>
    </div>
  );
}

// ─── Progress bar ───────────────────────────────────────────────────────────
function ProgressBar({ currentScene, totalScenes, progress }: {
  currentScene: number; totalScenes: number; progress: number;
}) {
  return (
    <div className="absolute top-0 left-0 right-0 z-30">
      <div className="h-1 bg-black/10 dark:bg-white/5">
        <motion.div
          className="h-full"
          style={{ background: 'linear-gradient(90deg, #06B6D4, #10B981, #8B5CF6)' }}
          initial={{ width: 0 }}
          animate={{ width: `${((currentScene + progress) / totalScenes) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}

// ─── Scene navigation dots ──────────────────────────────────────────────────
function SceneDots({ current, total, onClick }: { current: number; total: number; onClick: (i: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onClick(i)}
          className="transition-all duration-300 rounded-full"
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            background: i === current
              ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
              : 'rgba(6,182,212,0.25)',
          }}
        />
      ))}
    </div>
  );
}

function getSceneLabel(id: string): string {
  const labels: Record<string, string> = {
    intro: 'Pembukaan',
    about: 'Tentang Kami',
    'features-data': 'Fitur Data',
    'features-visual': 'Visualisasi',
    'features-layanan': 'Layanan',
    stats: 'Dalam Angka',
    closing: 'Penutup',
  };
  return labels[id] ?? id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════════
export function LaunchVideoSection() {
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [sceneProgress, setSceneProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
  }, []);

  const startScene = useCallback((sceneIndex: number) => {
    clearTimers();
    setSceneProgress(0);
    const duration = SCENES[sceneIndex]?.duration ?? 5000;

    const startTime = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setSceneProgress(Math.min(elapsed / duration, 1));
    }, 50);

    timerRef.current = setTimeout(() => {
      if (sceneIndex < SCENES.length - 1) {
        setCurrentScene(sceneIndex + 1);
      } else {
        setIsPlaying(false);
        setSceneProgress(1);
      }
    }, duration);
  }, [clearTimers]);

  useEffect(() => {
    if (isPlaying) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startScene(currentScene);
    }
    return clearTimers;
  }, [currentScene, isPlaying, startScene, clearTimers]);

  const goToScene = (index: number) => {
    if (index === currentScene) return;
    setCurrentScene(index);
    setIsPlaying(true);
  };

  const nextScene = () => {
    if (currentScene < SCENES.length - 1) {
      setCurrentScene(currentScene + 1);
      setIsPlaying(true);
    }
  };

  const prevScene = () => {
    if (currentScene > 0) {
      setCurrentScene(currentScene - 1);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (!isPlaying) {
      if (currentScene === SCENES.length - 1 && sceneProgress >= 0.99) {
        setCurrentScene(0);
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      clearTimers();
    }
  };

  const restart = () => {
    setCurrentScene(0);
    setIsPlaying(true);
    setSceneProgress(0);
  };

  const handleVisit = () => {
    const store = useFilterStore.getState();
    store.setActiveSection('dashboard');
  };

  const sceneVariants = {
    enter: { opacity: 0, scale: 0.98 },
    center: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.02 },
  };

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{
        background: isDark
          ? 'linear-gradient(180deg, #040A14 0%, #070E1A 30%, #0D1B2E 60%, #070E1A 100%)'
          : 'linear-gradient(180deg, #F0F9FF 0%, #E0F2FE 30%, #BAE6FD 60%, #E0F2FE 100%)',
        minHeight: 'calc(100vh - 140px)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 50% 30%, rgba(6,182,212,0.08) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 50% 30%, rgba(8,145,178,0.06) 0%, transparent 60%)',
          zIndex: 0,
        }}
      />

      {/* Particles */}
      <LaunchParticles />

      {/* Progress bar */}
      <ProgressBar currentScene={currentScene} totalScenes={SCENES.length} progress={sceneProgress} />

      {/* Scene content */}
      <div className="relative z-10" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScene}
            variants={sceneVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="flex items-center justify-center"
            style={{ minHeight: 'calc(100vh - 200px)' }}
          >
            {SCENES[currentScene].id === 'intro' && <SceneIntro isActive={true} />}
            {SCENES[currentScene].id === 'about' && <SceneAbout isActive={true} />}
            {SCENES[currentScene].id === 'features-data' && <SceneFeaturesData isActive={true} />}
            {SCENES[currentScene].id === 'features-visual' && <SceneFeaturesVisual isActive={true} />}
            {SCENES[currentScene].id === 'features-layanan' && <SceneFeaturesLayanan isActive={true} />}
            {SCENES[currentScene].id === 'stats' && <SceneStats isActive={true} />}
            {SCENES[currentScene].id === 'closing' && <SceneClosing isActive={true} onVisit={handleVisit} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {/* Wave top decoration */}
        <svg
          viewBox="0 0 1440 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <path
            d="M0,20 C360,0 720,40 1080,20 C1260,10 1380,25 1440,20 L1440,40 L0,40 Z"
            fill="rgba(0,0,0,0.3)"
          />
        </svg>

        {/* Control bar */}
        <div
          className="px-4 sm:px-6 py-3 sm:py-4"
          style={{
            background: isDark
              ? 'linear-gradient(180deg, rgba(4,10,20,0.8), rgba(4,10,20,0.95))'
              : 'linear-gradient(180deg, rgba(240,249,255,0.9), rgba(224,242,254,0.95))',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            {/* Prev */}
            <button
              onClick={prevScene}
              disabled={currentScene === 0}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: isDark ? 'rgba(6,182,212,0.1)' : 'rgba(8,145,178,0.08)',
                border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(8,145,178,0.15)'}`,
                color: '#06B6D4',
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Play/Pause & Restart */}
            <div className="flex items-center gap-2">
              <button
                onClick={restart}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: isDark ? 'rgba(6,182,212,0.08)' : 'rgba(8,145,178,0.06)',
                  color: isDark ? 'rgba(6,182,212,0.6)' : 'rgba(8,145,178,0.5)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                  boxShadow: '0 4px 20px rgba(6,182,212,0.3)',
                  color: '#fff',
                }}
              >
                {isPlaying ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </button>
            </div>

            {/* Dots */}
            <SceneDots current={currentScene} total={SCENES.length} onClick={goToScene} />

            {/* Next */}
            <button
              onClick={nextScene}
              disabled={currentScene === SCENES.length - 1}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: isDark ? 'rgba(6,182,212,0.1)' : 'rgba(8,145,178,0.08)',
                border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(8,145,178,0.15)'}`,
                color: '#06B6D4',
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Scene label */}
          <div className="text-center mt-2">
            <span
              className="text-[10px] sm:text-xs font-medium"
              style={{ color: isDark ? 'rgba(186,230,253,0.5)' : 'rgba(12,74,110,0.4)' }}
            >
              {currentScene + 1} / {SCENES.length} — {getSceneLabel(SCENES[currentScene].id)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
