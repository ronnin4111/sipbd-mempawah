'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';
import { Header } from './header';
import { Sidebar } from './sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* SIPBK Banner - below header */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(13,27,46,0.5) 50%, rgba(6,182,212,0.08) 100%)'
            : 'linear-gradient(135deg, rgba(6,182,212,0.06) 0%, rgba(240,246,255,0.5) 50%, rgba(6,182,212,0.06) 100%)',
          borderBottom: `1px solid ${isDark ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.1)'}`,
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 flex items-center justify-center gap-4">
          <img
            src="/logo-sipbk-transparent.png"
            alt="Logo SIPBK - Sistem Informasi Perikanan Budidaya Kabupaten Mempawah"
            className="h-16 sm:h-20 md:h-24 w-auto object-contain"
            style={{
              filter: isDark ? 'drop-shadow(0 0 12px rgba(6,182,212,0.3)) brightness(1.1)' : 'none',
            }}
          />
        </div>
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 overflow-x-clip">
        {children}
      </main>
      <footer
        className="mt-auto"
        style={{
          borderTop: '1px solid var(--border)',
          background: 'linear-gradient(90deg, rgba(6,182,212,0.05), rgba(20,184,166,0.05), rgba(6,182,212,0.05))',
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img
                src="/logo-mempawah.png"
                alt="Logo Kab. Mempawah"
                className="h-7 w-auto object-contain rounded"
                style={{ background: 'rgba(255,255,255,0.9)', padding: 1 }}
              />
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                &copy; {new Date().getFullYear()} Dinas Perikanan Kabupaten Mempawah
              </p>
            </div>
            <p className="text-xs" style={{ color: '#06B6D4' }}>
              Sistem Informasi Perikanan Budidaya (SIPBUDIK)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
