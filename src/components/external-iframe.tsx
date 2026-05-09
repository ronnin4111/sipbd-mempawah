'use client';

import { useState, useCallback } from 'react';
import { ExternalLink, RefreshCw, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExternalIframeProps {
  src: string;
  title: string;
  badge?: string;
}

export function ExternalIframe({ src, title, badge }: ExternalIframeProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const handleReload = useCallback(() => {
    setIsLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

  const handleOpenNewTab = useCallback(() => {
    window.open(src, '_blank', 'noopener,noreferrer');
  }, [src]);

  return (
    <div className={`space-y-3 ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {badge && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleReload}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleOpenNewTab}
          >
            <ExternalLink className="h-3 w-3" />
            Buka Tab Baru
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
            {isFullscreen ? 'Keluar Fullscreen' : 'Fullscreen'}
          </Button>
        </div>
      </div>

      {/* Iframe container */}
      <div
        className={`relative rounded-lg border overflow-hidden bg-muted/30 ${
          isFullscreen ? 'h-[calc(100vh-52px)]' : 'h-[75vh]'
        }`}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
              <p className="text-sm text-muted-foreground">Memuat halaman...</p>
            </div>
          </div>
        )}
        <iframe
          key={iframeKey}
          src={src}
          className="w-full h-full border-0"
          title={title}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          loading="lazy"
          onLoad={() => setIsLoading(false)}
        />
      </div>

      {/* Info note */}
      {!isFullscreen && (
        <p className="text-[10px] text-muted-foreground text-center">
          Konten ini ditampilkan dari website SIPBD V2 (Triwulan). Klik &quot;Tren &amp; Laporan&quot; di sidebar V2 untuk melihat data tren.
        </p>
      )}
    </div>
  );
}
