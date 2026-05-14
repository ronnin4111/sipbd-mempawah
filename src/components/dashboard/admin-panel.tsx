'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  BookOpen,
  FileText,
  Upload,
  ArrowRight,
  Loader2,
  Download,
  Split,
  Shield,
  Database,
  Settings,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFilterStore } from '@/store/filter-store';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';

interface KBWidgetStats {
  totalDocs: number;
  totalChunks: number;
  categoryBreakdown: { category: string; count: number }[];
}

interface AdminFeature {
  id: string;
  title: string;
  description: string;
  icon: typeof Brain;
  section: string;
  gradient: string;
  badge?: string;
  stats?: string;
}

export function AdminPanel() {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;
  const setActiveSection = useFilterStore((s) => s.setActiveSection);
  const isAdmin = useFilterStore((s) => s.isAdmin);

  const [kbStats, setKbStats] = useState<KBWidgetStats | null>(null);
  const [kbLoading, setKbLoading] = useState(true);

  const fetchKbStats = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge-base/list?stats=true');
      const data = await res.json();
      if (data.success && data.stats) {
        setKbStats(data.stats);
      }
    } catch {
      // silent
    } finally {
      setKbLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKbStats();
  }, [fetchKbStats]);

  const cardBg = isDark
    ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10'
    : 'bg-white border-gray-200';

  const accentGradient = 'linear-gradient(135deg, #06B6D4, #0891B2)';

  const adminFeatures: AdminFeature[] = [
    {
      id: 'kb',
      title: 'Basis Pengetahuan AI',
      description: 'Upload dokumen → AI bisa membaca & menjawab pertanyaan',
      icon: Brain,
      section: 'knowledge-base',
      gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)',
      badge: 'AI',
      stats: kbStats && kbStats.totalDocs > 0
        ? `${kbStats.totalDocs} dokumen, ${kbStats.totalChunks} data`
        : undefined,
    },
    {
      id: 'import',
      title: 'Import / Export Data',
      description: 'Import data Excel atau export ke Excel/PDF',
      icon: Download,
      section: 'import-export',
      gradient: 'linear-gradient(135deg, #10B981, #059669)',
    },
    {
      id: 'disagregasi',
      title: 'Disagregasi Data',
      description: 'Pecah data agregat menjadi per-desa',
      icon: Split,
      section: 'disagregasi',
      gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    },
    {
      id: 'kusuka',
      title: 'Data KUSUKA',
      description: 'Data registrasi KUSUKA pembudidaya ikan',
      icon: Database,
      section: 'data-kusuka',
      gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
    },
  ];

  if (!isAdmin) {
    // Show a prompt to login for non-admin users
    return (
      <Card className={`${cardBg}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-muted"
            >
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
                Fitur Admin
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Login sebagai admin untuk mengakses Import/Export, Basis Pengetahuan, dan fitur lainnya
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accentGradient, boxShadow: '0 4px 16px rgba(6,182,212,0.3)' }}
        >
          <Settings className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
            Fitur Admin
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Kelola data, upload dokumen, dan konfigurasi sistem
          </p>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {adminFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card
              key={feature.id}
              className={`${cardBg} group hover:border-cyan-500/30 transition-all cursor-pointer`}
              onClick={() => setActiveSection(feature.section)}
            >
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: feature.gradient, boxShadow: `0 4px 12px rgba(0,0,0,0.2)` }}
                  >
                    <Icon className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-semibold text-xs sm:text-sm truncate">
                        {feature.title}
                      </h4>
                      {feature.badge && (
                        <Badge
                          variant="outline"
                          className="text-[8px] px-1.5 py-0 bg-cyan-500/15 text-cyan-400 border-cyan-500/20 shrink-0"
                        >
                          {feature.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                    {feature.id === 'kb' && (
                      kbLoading ? (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground">Memuat...</span>
                        </div>
                      ) : feature.stats ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <BookOpen className="h-3 w-3 text-cyan-400" />
                          <span className="text-[10px] text-cyan-400 font-medium">{feature.stats}</span>
                        </div>
                      ) : (
                        <div className="mt-1.5">
                          <Button
                            size="sm"
                            className="h-6 gap-1 text-[9px] px-2"
                            style={{ background: feature.gradient }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSection(feature.section);
                            }}
                          >
                            <Upload className="h-2.5 w-2.5" />
                            Upload Dokumen
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-cyan-400 transition-colors shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
