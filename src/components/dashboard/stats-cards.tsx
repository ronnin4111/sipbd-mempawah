'use client';

import { motion } from 'framer-motion';
import { Fish, Users, UserCheck, Building2, TrendingUp, TrendingDown } from 'lucide-react';
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
  breakdown?: { label: string; value: number }[];
  colorClass: string;
  index: number;
}

function StatCard({ title, value, icon, subtitle, breakdown, colorClass, index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="relative overflow-hidden hover:shadow-lg transition-shadow duration-300">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{title}</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold text-foreground">
                  <AnimatedNumber value={value} />
                </span>
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className={`shrink-0 flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl ${colorClass}`}>
              {icon}
            </div>
          </div>
          {breakdown && breakdown.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {breakdown.map((b) => (
                <div key={b.label} className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">{b.label}:</span>
                  <span className="font-semibold text-foreground">{formatNumber(b.value)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <div className={`absolute bottom-0 left-0 right-0 h-1 ${colorClass}`} />
      </Card>
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
      title: 'Total Produksi Budidaya',
      value: stats.totalProduction,
      subtitle: 'kg',
      icon: <Fish className="h-5 w-5 text-white" />,
      breakdown: [
        { label: 'Pembesaran', value: stats.pembesaranProduction },
        { label: 'Pembenihan', value: stats.pembenihanProduction },
      ],
      colorClass: 'bg-teal-600',
      index: 0,
    },
    {
      title: 'Total RTP',
      value: stats.totalRtp,
      subtitle: 'unit',
      icon: <Building2 className="h-5 w-5 text-white" />,
      breakdown: Object.entries(stats.rtpByBusinessType).map(([k, v]) => ({
        label: k,
        value: v,
      })),
      colorClass: 'bg-emerald-600',
      index: 1,
    },
    {
      title: 'Total Pembudidaya',
      value: stats.totalFarmer,
      subtitle: 'orang',
      icon: <Users className="h-5 w-5 text-white" />,
      breakdown: Object.entries(stats.farmerByBusinessType).map(([k, v]) => ({
        label: k,
        value: v,
      })),
      colorClass: 'bg-teal-700',
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
      colorClass: 'bg-emerald-700',
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
