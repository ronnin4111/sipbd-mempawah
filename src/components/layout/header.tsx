'use client';

import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useFilterStore } from '@/store/filter-store';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center px-3 sm:px-4 gap-2 sm:gap-3">
        {/* Left: Hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={onMenuClick}
          aria-label="Buka menu navigasi"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Center: Logo + Title */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.5 4.8 3.8 6.2L4 22l4.5-3.2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2zm-1 14h-2v-2h2v2zm0-4h-2V6h2v6z"/>
            </svg>
          </div>
          <div className="min-w-0 hidden sm:block">
            <h1 className="text-sm font-bold text-foreground leading-tight truncate">
              SIPBUDIK
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">
              Sistem Informasi Perikanan Budidaya &middot; Dinas Perikanan Kab. Mempawah
            </p>
          </div>
          <div className="min-w-0 sm:hidden">
            <h1 className="text-sm font-bold text-foreground leading-tight">SIPBUDIK</h1>
          </div>
        </div>

        {/* Right: Theme toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle tema"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </div>
    </header>
  );
}
