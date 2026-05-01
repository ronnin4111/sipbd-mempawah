'use client';

import { useState } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {children}
      </main>
      <footer className="mt-auto border-t bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Dinas Perikanan Kabupaten Mempawah
            </p>
            <p className="text-xs text-muted-foreground">
              Sistem Informasi Perikanan Budidaya (SIPBUDIK)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
