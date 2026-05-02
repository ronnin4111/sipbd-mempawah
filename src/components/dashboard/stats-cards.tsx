'use client';

import { motion } from 'framer-motion';
import { Fish, Users, UserCheck, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  breakdown?: { label: string; value: number; unit?: string }[];
  colorClass: string;
  index: number;
}

function StatCard({ title, value, icon, subtitle, breakdown, colorClass, index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="stat-card animate-in"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium truncate" style={{ color: 'var(--muted-foreground)' }}>{title}</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                <AnimatedNumber value={value} />
              </span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{subtitle}</span>
            </div>
          </div>
          <div
            className="shrink-0 flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl shadow-lg"
            style={{ background: colorClass, boxShadow: `0 4px 12px ${colorClass}40` }}
          >
            {icon}
          </div>
        </div>
        {breakdown && breakdown.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {breakdown.map((b) => (
              <div key={b.label} className="flex items-center gap-1.5 text-xs">
                <span style={{ color: 'var(--muted-foreground)' }}>{b.label}:</span>
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{formatNumber(b.value)}</span>
                {b.unit && <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{b.unit}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function StatsCards() {
  const { data: stats, isLoading } = useFishFarmStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 sm:p-5">
              <div className="h-4 bg-muted rounded w-24 mb-3" />
              <div className="h-8 bg-muted rounded w-20 mb-2" />
              <div className="h-3 bg-muted rounded w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards: StatCardProps[] = [
    {
      title: 'Produksi Pembesaran',
      value: stats.pembesaranProduction,
      subtitle: 'Kg',
      icon: <Fish className="h-5 w-5 text-white" />,
      breakdown: Object.entries(stats.productionByFishType)
        .filter(([, v]) => v.pembesaran > 0)
        .map(([k, v]) => ({ label: k, value: v.pembesaran, unit: 'Kg' }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3),
      colorClass: '#0891B2',
      index: 0,
    },
    {
      title: 'Produksi Pembenihan',
      value: stats.pembenihanProduction,
      subtitle: 'Ekor',
      icon: <Fish className="h-5 w-5 text-white" />,
      breakdown: Object.entries(stats.productionByFishType)
        .filter(([, v]) => v.pembenihan > 0)
        .map(([k, v]) => ({ label: k, value: v.pembenihan, unit: 'Ekor' }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3),
      colorClass: '#14B8A6',
      index: 1,
    },
    {
      title: 'Total RTP & Pembudidaya',
      value: stats.totalRtp,
      subtitle: 'RTP',
      icon: <Building2 className="h-5 w-5 text-white" />,
      breakdown: [
        ...Object.entries(stats.rtpByBusinessType).map(([k, v]) => ({ label: `RTP ${k}`, value: v })),
        ...Object.entries(stats.farmerByBusinessType).map(([k, v]) => ({ label: `${k}`, value: v })),
      ],
      colorClass: '#0369A1',
      index: 2,
    },
    {
      title: 'Total Kelompok',
      value: stats.totalGroup,
      subtitle: 'kelompok',
      icon: <UserCheck className="h-5 w-5 text-white" />,
      breakdown: Object.entries(stats.groupByBusinessType).map(([k, v]) => ({
        label: k,
        value: v,
      })),
      colorClass: '#0D9488',
      index: 3,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  );
}
