'use client';

import { motion } from 'framer-motion';
import { Fish, Users, UserCheck } from 'lucide-react';
import { useFishFarmStats } from '@/hooks/use-fish-farms';
import { useEffect, useState } from 'react';

function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num);
}

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(eased * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <>{formatNumber(displayValue)}</>;
}

interface StatItemProps {
  label: string;
  value: number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  index: number;
  breakdown?: { label: string; value: number; unit?: string }[];
}

function StatItem({ label, value, unit, icon, color, index, breakdown }: StatItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="flex flex-col items-center text-center py-4 px-3"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
        style={{
          background: `${color}15`,
          border: `1px solid ${color}30`,
        }}
      >
        {icon}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
          <AnimatedNumber value={value} />
        </span>
        {unit && (
          <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
            {unit}
          </span>
        )}
      </div>
      <span className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      {breakdown && breakdown.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-0.5">
          {breakdown.map((b) => (
            <span key={b.label} className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              {b.label}: <span className="font-semibold" style={{ color }}>{formatNumber(b.value)}</span>
              {b.unit && <span className="text-[9px]"> {b.unit}</span>}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function StatsCards() {
  const { data: stats, isLoading } = useFishFarmStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center py-8 animate-pulse">
            <div className="w-12 h-12 rounded-xl bg-muted mb-3" />
            <div className="h-8 bg-muted rounded w-24 mb-2" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const items: StatItemProps[] = [
    {
      label: 'Total Produksi Pembesaran',
      value: stats.pembesaranProduction,
      unit: 'Kg',
      icon: <Fish className="h-5 w-5" style={{ color: '#3B82F6' }} />,
      color: '#3B82F6',
      index: 0,
      breakdown: Object.entries(stats.productionByFishType)
        .filter(([, v]) => v.pembesaran > 0)
        .map(([k, v]) => ({ label: k, value: v.pembesaran, unit: 'Kg' }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3),
    },
    {
      label: 'Total Produksi Pembenihan',
      value: stats.pembenihanProduction,
      unit: 'Ekor',
      icon: <Fish className="h-5 w-5" style={{ color: '#22C55E' }} />,
      color: '#22C55E',
      index: 1,
      breakdown: Object.entries(stats.productionByFishType)
        .filter(([, v]) => v.pembenihan > 0)
        .map(([k, v]) => ({ label: k, value: v.pembenihan, unit: 'Ekor' }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3),
    },
    {
      label: stats.latestYear ? `Pembudidaya Pembesaran (${stats.latestYear})` : 'Pembudidaya Pembesaran',
      value: stats.farmerByBusinessType['Pembesaran'] || 0,
      unit: 'Orang',
      icon: <Users className="h-5 w-5" style={{ color: '#F59E0B' }} />,
      color: '#F59E0B',
      index: 2,
      breakdown: [
        { label: 'RTP', value: stats.rtpByBusinessType['Pembesaran'] || 0, unit: 'RTP' },
        { label: 'Kelompok', value: stats.groupByBusinessType['Pembesaran'] || 0, unit: 'Kelompok' },
      ],
    },
    {
      label: stats.latestYear ? `Pembudidaya Pembenihan (${stats.latestYear})` : 'Pembudidaya Pembenihan',
      value: stats.farmerByBusinessType['Pembenihan'] || 0,
      unit: 'Orang',
      icon: <UserCheck className="h-5 w-5" style={{ color: '#A855F7' }} />,
      color: '#A855F7',
      index: 3,
      breakdown: [
        { label: 'RTP', value: stats.rtpByBusinessType['Pembenihan'] || 0, unit: 'RTP' },
        { label: 'Kelompok', value: stats.groupByBusinessType['Pembenihan'] || 0, unit: 'Kelompok' },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <StatItem key={item.label} {...item} />
      ))}
    </div>
  );
}
