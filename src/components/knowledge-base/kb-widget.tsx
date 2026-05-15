'use client';

import { useState, useEffect, useCallback } from 'react';
import { Brain, BookOpen, FileText, Upload, ArrowRight, Loader2 } from 'lucide-react';
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

export function KBWidget() {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;
  const setActiveSection = useFilterStore((s) => s.setActiveSection);
  const isAdmin = useFilterStore((s) => s.isAdmin);

  const [stats, setStats] = useState<KBWidgetStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge-base/list?stats=true');
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('KB widget fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const cardBg = isDark
    ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10'
    : 'bg-white border-gray-200';

  const accentGradient = 'linear-gradient(135deg, #06B6D4, #0891B2)';

  return (
    <Card className={`${cardBg} group hover:border-cyan-500/30 transition-all cursor-pointer`}
      onClick={() => setActiveSection('knowledge-base')}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: accentGradient, boxShadow: '0 4px 16px rgba(6,182,212,0.3)' }}
          >
            <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm sm:text-base" style={{ fontFamily: 'Syne, sans-serif' }}>
                Basis Pengetahuan AI
              </h3>
              <Badge variant="outline" className="text-[9px] bg-cyan-500/15 text-cyan-400 border-cyan-500/20 shrink-0">
                AI
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground mb-3 leading-relaxed">
              Upload dokumen (Excel, Word, TXT, CSV) → AI bisa membaca & menjawab pertanyaan tentangnya
            </p>

            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-[10px]">Memuat...</span>
              </div>
            ) : stats && stats.totalDocs > 0 ? (
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs font-medium">{stats.totalDocs}</span>
                  <span className="text-[10px] text-muted-foreground">Dokumen</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-xs font-medium">{stats.totalChunks}</span>
                  <span className="text-[10px] text-muted-foreground">Bagian Data</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-xs font-medium">{stats.categoryBreakdown.length}</span>
                  <span className="text-[10px] text-muted-foreground">Kategori</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 text-[10px]"
                    style={{ background: accentGradient }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSection('knowledge-base');
                    }}
                  >
                    <Upload className="h-3 w-3" />
                    Upload Dokumen Pertama
                  </Button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    Login admin untuk mengupload dokumen
                  </span>
                )}
              </div>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-cyan-400 transition-colors shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}
