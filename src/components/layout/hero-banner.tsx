'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Fish, Users, MapPin, Award, Play } from 'lucide-react';
import { useFishFarmStats } from '@/hooks/use-fish-farms';
import { useMounted } from '@/hooks/use-mounted';
import { useTheme } from 'next-themes';
import { useFilterStore } from '@/store/filter-store';

function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(num);
}

function AnimatedNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(eased * value);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <>{formatNumber(displayValue)}</>;
}

/* ── Floating particle dots ── */
function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const particles: { x: number; y: number; r: number; dx: number; dy: number; opacity: number }[] = [];
    const PARTICLE_COUNT = 60;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener('resize', resize);

    // Initialize particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.2,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      particles.forEach((p) => {
        p.x += p.dx;
        p.y += p.dy;

        // Wrap around
        if (p.x < 0) p.x = canvas.offsetWidth;
        if (p.x > canvas.offsetWidth) p.x = 0;
        if (p.y < 0) p.y = canvas.offsetHeight;
        if (p.y > canvas.offsetHeight) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(6,182,212,${p.opacity})`
          : `rgba(8,145,178,${p.opacity * 0.6})`;
        ctx.fill();
      });

      // Draw connecting lines for close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = isDark
              ? `rgba(6,182,212,${0.06 * (1 - dist / 120)})`
              : `rgba(8,145,178,${0.04 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

export function HeroBanner() {
  const { data: stats, isLoading } = useFishFarmStats();
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  // Current year production data
  const pembesaranProduction = stats?.currentYearPembesaranProduction ?? 0;
  const pembenihanProduction = stats?.currentYearPembenihanProduction ?? 0;
  // Current year farmer & group data
  const pembudidayaPembesaran = stats?.currentYearFarmerByBusinessType?.['Pembesaran'] ?? 0;
  const pembudidayaPembenihan = stats?.currentYearFarmerByBusinessType?.['Pembenihan'] ?? 0;
  const pokdakanPembesaran = stats?.currentYearGroupByBusinessType?.['Pembesaran'] ?? 0;
  const pokdakanPembenihan = stats?.currentYearGroupByBusinessType?.['Pembenihan'] ?? 0;
  const rtpPembesaran = stats?.currentYearRtpByBusinessType?.['Pembesaran'] ?? 0;
  const rtpPembenihan = stats?.currentYearRtpByBusinessType?.['Pembenihan'] ?? 0;
  const totalKecamatan = stats?.productionByKecamatan ? Object.keys(stats.productionByKecamatan).length : 0;
  const totalKusuka = stats?.totalKusuka ?? 0;

  // Period label from API (e.g., "s/d Maret 2026", "Tahun 2024", "2022, 2023 s/d 2024")
  const periodLabel = stats?.periodLabel ?? `s/d ${new Date().getFullYear()}`;

  const statCards = [
    {
      label: `Produksi Pembesaran ${periodLabel}`,
      value: pembesaranProduction,
      unit: 'Kg',
      icon: <Fish className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: '#3B82F6',
    },
    {
      label: `Produksi Pembenihan ${periodLabel}`,
      value: pembenihanProduction,
      unit: 'Ekor',
      icon: <Fish className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: '#22C55E',
    },
    {
      label: `${pokdakanPembesaran} Pokdakan, ${pembudidayaPembesaran} Orang Pembesaran`,
      value: pokdakanPembesaran,
      unit: 'Pokdakan',
      icon: <Users className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: '#F59E0B',
      subLabel: `RTP: ${rtpPembesaran}`,
    },
    {
      label: `${pokdakanPembenihan} Pokdakan, ${pembudidayaPembenihan} Orang Pembenih`,
      value: pokdakanPembenihan,
      unit: 'Pokdakan',
      icon: <Users className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: '#A855F7',
      subLabel: `RTP: ${rtpPembenihan}`,
    },
    {
      label: 'Jumlah KUSUKA',
      value: totalKusuka,
      unit: 'Kartu',
      icon: <Award className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: '#10B981',
    },
    {
      label: 'Kecamatan',
      value: totalKecamatan,
      unit: 'Kecamatan',
      icon: <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: '#0EA5E9',
    },
  ];

  return (
    <div
      className="relative overflow-hidden -mx-3 sm:-mx-4 lg:-mx-6 -mt-4 sm:-mt-6"
      style={{
        background: isDark
          ? 'linear-gradient(180deg, #070E1A 0%, #0D1B2E 40%, #112240 70%, #0D1B2E 100%)'
          : 'linear-gradient(180deg, #F0F6FF 0%, #E0F2FE 40%, #B9E6FD 70%, #EAF2FF 100%)',
        minHeight: '340px',
      }}
    >
      {/* Gradient radial overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 50% 30%, rgba(6,182,212,0.12) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 50% 30%, rgba(8,145,178,0.08) 0%, transparent 60%)',
          zIndex: 0,
        }}
      />

      {/* Second radial accent */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 80% 60%, rgba(20,184,166,0.08) 0%, transparent 50%)'
            : 'radial-gradient(ellipse at 80% 60%, rgba(20,184,166,0.05) 0%, transparent 50%)',
          zIndex: 0,
        }}
      />

      {/* Particles */}
      <Particles />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-8 sm:mb-10"
        >
          {/* Logo + Department Name - Left aligned banner */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6"
          >
            <img
              src="/logo-sipbk-transparent.png"
              alt="Logo SIPBD"
              className="h-14 sm:h-16 lg:h-20 w-auto object-contain flex-shrink-0"
              style={{ filter: isDark ? 'brightness(1.1) drop-shadow(0 0 8px rgba(6,182,212,0.25))' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))' }}
            />
            <div
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl"
              style={{
                background: isDark ? 'rgba(6,182,212,0.1)' : 'rgba(8,145,178,0.08)',
                border: `1px solid ${isDark ? 'rgba(6,182,212,0.25)' : 'rgba(8,145,178,0.2)'}`,
              }}
            >
              <p
                className="text-xs sm:text-sm lg:text-base font-semibold tracking-wide leading-tight"
                style={{ color: isDark ? '#06B6D4' : '#0891B2' }}
              >
                Dinas Pertanian Ketahanan Pangan dan Perikanan
              </p>
              <p
                className="text-[10px] sm:text-xs lg:text-sm font-medium tracking-wider leading-tight mt-0.5"
                style={{ color: isDark ? 'rgba(6,182,212,0.7)' : 'rgba(8,145,178,0.6)' }}
              >
                Kabupaten Mempawah
              </p>
            </div>
          </motion.div>

          {/* Title - Left aligned */}
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-3 sm:mb-4"
            style={{ fontFamily: 'Syne, sans-serif', color: 'var(--foreground)' }}
          >
            Sistem Informasi{' '}
            <span className="glow-text" style={{ color: '#06B6D4' }}>
              Perikanan Budidaya
            </span>
          </h1>

          <p
            className="text-sm sm:text-base max-w-2xl leading-relaxed"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Dashboard terintegrasi data produksi pembesaran &amp; pembenihan perikanan budidaya
            Kabupaten Mempawah, Kalimantan Barat
          </p>

          {/* Launch Video Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            onClick={() => useFilterStore.getState().setActiveSection('launching-video')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all"
            style={{
              background: isDark ? 'rgba(6,182,212,0.12)' : 'rgba(8,145,178,0.08)',
              border: `1px solid ${isDark ? 'rgba(6,182,212,0.3)' : 'rgba(8,145,178,0.2)'}`,
              color: '#06B6D4',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(6,182,212,0.2)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(6,182,212,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(6,182,212,0.12)' : 'rgba(8,145,178,0.08)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Play className="h-3.5 w-3.5" />
            Tonton Video Launching
          </motion.button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 max-w-6xl mx-auto"
        >
          {isLoading ? (
            // Loading skeletons
            [0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center p-3 sm:p-4 rounded-2xl animate-pulse"
                style={{
                  background: isDark ? 'rgba(13,27,46,0.6)' : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-muted mb-2" />
                <div className="h-5 bg-muted rounded w-16 mb-1" />
                <div className="h-3 bg-muted rounded w-12" />
              </div>
            ))
          ) : (
            statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                className="flex flex-col items-center text-center p-3 sm:p-4 rounded-2xl group transition-all duration-300 cursor-default overflow-hidden"
                style={{
                  background: isDark ? 'rgba(13,27,46,0.6)' : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  backdropFilter: 'blur(12px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${card.color}40`;
                  e.currentTarget.style.boxShadow = `0 8px 32px ${card.color}15`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 mb-2 transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: `${card.color}15`,
                    border: `1px solid ${card.color}30`,
                    color: card.color,
                  }}
                >
                  {card.icon}
                </div>
                <div className="w-full min-w-0 overflow-hidden">
                  <div className="flex items-baseline justify-center gap-1 flex-wrap">
                    <span
                      className="text-xs sm:text-sm lg:text-base font-bold tabular-nums leading-tight"
                      style={{ color: 'var(--foreground)' }}
                    >
                      <AnimatedNumber value={card.value} />
                    </span>
                    {card.unit && (
                      <span
                        className="text-[9px] sm:text-[10px] lg:text-xs font-semibold"
                        style={{ color: card.color }}
                      >
                        {card.unit}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[8px] sm:text-[10px] lg:text-[11px] leading-tight block mt-0.5"
                    style={{ color: 'var(--muted-foreground)' }}
                    title={card.label}
                  >
                    {card.label}
                  </span>
                  {'subLabel' in card && card.subLabel && (
                    <span
                      className="text-[7px] sm:text-[9px] lg:text-[10px] leading-tight block mt-0.5"
                      style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}
                    >
                      {card.subLabel}
                    </span>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>

      {/* Wave separator at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ zIndex: 2 }}
      >
        <svg
          viewBox="0 0 1440 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          style={{ display: 'block' }}
          preserveAspectRatio="none"
        >
          <path
            d="M0,40 C240,70 480,10 720,40 C960,70 1200,10 1440,40 L1440,80 L0,80 Z"
            fill="var(--background)"
          />
          <path
            d="M0,50 C240,75 480,20 720,50 C960,75 1200,20 1440,50 L1440,80 L0,80 Z"
            fill="var(--background)"
            opacity="0.5"
          />
        </svg>
      </div>
    </div>
  );
}
