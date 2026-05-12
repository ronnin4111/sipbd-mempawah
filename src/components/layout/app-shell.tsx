'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Header } from './header';
import { Sidebar } from './sidebar';

// Dynamic import AI chat widget to avoid SSR issues
const AIChatWidget = dynamic(
  () => import('@/components/ai/ai-chat-widget').then((m) => ({ default: m.AIChatWidget })),
  { ssr: false }
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
                &copy; {new Date().getFullYear()} Dinas Pertanian Ketahanan Pangan dan Perikanan Kab. Mempawah
              </p>
            </div>
            <p className="text-xs" style={{ color: '#06B6D4' }}>
              Sistem Informasi Perikanan Budidaya (SIPBD)
            </p>
          </div>
        </div>
      </footer>

      {/* AI Chat Widget */}
      <AIChatWidget />
    </div>
  );
}
