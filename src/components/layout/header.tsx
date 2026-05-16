'use client';

import { useState, useEffect, useRef } from 'react';
import { Menu, Moon, Sun, Lock, Shield, LogOut, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useFilterStore } from '@/store/filter-store';
import { useMounted } from '@/hooks/use-mounted';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/data-table/filter-bar';
import { NAV_ITEMS, NAV_GROUPS } from '@/lib/constants';
import type { NavItem, NavGroup } from '@/lib/constants';

interface HeaderProps {
  onMenuClick: () => void;
}

// Items visible in header (not hidden)
const HEADER_ITEMS = NAV_ITEMS.filter((item) => !item.headerHidden);

// Standalone items (no group)
const STANDALONE_ITEMS = HEADER_ITEMS.filter((item) => !item.group);

// Grouped items organized by group ID
const GROUPED_ITEMS: Record<string, NavItem[]> = {};
HEADER_ITEMS.forEach((item) => {
  if (item.group) {
    if (!GROUPED_ITEMS[item.group]) GROUPED_ITEMS[item.group] = [];
    GROUPED_ITEMS[item.group].push(item);
  }
});

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const mounted = useMounted();
  const activeSection = useFilterStore((s) => s.activeSection);
  const setActiveSection = useFilterStore((s) => s.setActiveSection);
  const isAdmin = useFilterStore((s) => s.isAdmin);
  const setIsAdmin = useFilterStore((s) => s.setIsAdmin);

  // Admin login state
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const loginRef = useRef<HTMLDivElement>(null);

  // Dropdown state — which group dropdown is open
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark = mounted ? theme === 'dark' : true;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close all dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Close admin menu
      if (loginRef.current && !loginRef.current.contains(e.target as Node)) {
        setShowAdminMenu(false);
        setShowLoginForm(false);
        setLoginError('');
      }
      // Close group dropdowns if click is outside any dropdown area
      const target = e.target as HTMLElement;
      if (!target.closest('[data-nav-dropdown]')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close dropdown on navigation
  useEffect(() => {
    setOpenDropdown(null);
  }, [activeSection]);

  const handleItemClick = (item: NavItem) => {
    if (item.adminOnly && !isAdmin) {
      setShowLoginForm(true);
      setShowAdminMenu(true);
      return;
    }
    setActiveSection(item.id);
    setOpenDropdown(null);
  };

  // Find which group contains the active section
  const getActiveGroupId = (): string | null => {
    for (const [groupId, items] of Object.entries(GROUPED_ITEMS)) {
      if (items.some((item) => item.id === activeSection)) return groupId;
    }
    return null;
  };

  const activeGroupId = getActiveGroupId();

  const handleAdminLogin = async () => {
    if (!adminPassword.trim()) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, type: 'admin' }),
      });
      const data = await res.json();
      if (data.valid) {
        setIsAdmin(true);
        setAdminPassword('');
        setShowLoginForm(false);
        setShowAdminMenu(false);
        setLoginError('');
      } else {
        setLoginError('Password salah!');
      }
    } catch {
      setLoginError('Gagal memverifikasi password');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setShowAdminMenu(false);
    if (activeSection === 'disagregasi') {
      setActiveSection('dashboard');
    }
  };

  const handleDropdownEnter = (groupId: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setOpenDropdown(groupId);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 350);
  };

  return (
    <header
      className="sticky top-0 z-40 transition-all duration-300"
      style={{
        background: scrolled
          ? isDark
            ? 'rgba(7,14,26,0.97)'
            : 'rgba(240,246,255,0.97)'
          : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        boxShadow: scrolled
          ? isDark
            ? '0 2px 24px rgba(0,0,0,0.25)'
            : '0 2px 24px rgba(0,0,0,0.08)'
          : 'none',
      }}
    >
      {/* Hero Title Section */}
      <div className="px-4 pt-4 pb-2 max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Hamburger + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all lg:hidden"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(6,182,212,0.08)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(6,182,212,0.15)'}`,
              }}
              aria-label="Buka menu navigasi"
            >
              <div className="flex flex-col gap-1.5 w-5">
                <span className="block h-0.5 rounded-full" style={{ background: isDark ? '#7DD3FC' : '#0891B2' }} />
                <span className="block h-0.5 rounded-full" style={{ background: isDark ? '#7DD3FC' : '#0891B2' }} />
                <span className="block h-0.5 rounded-full" style={{ background: isDark ? '#7DD3FC' : '#0891B2' }} />
              </div>
            </button>
            <div className="relative">
              <img
                src="/logo-mempawah.png"
                alt="Logo Kabupaten Mempawah"
                className="w-10 h-10 rounded-xl object-contain shadow-lg"
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  padding: 2,
                  boxShadow: '0 4px 16px rgba(6,182,212,0.35)',
                }}
              />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--foreground)' }}>
                SIPBD
              </div>
              <div className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#06B6D4' }}>
                Dinas Pertanian Ketahanan Pangan dan Perikanan Kab. Mempawah
              </div>
            </div>
          </div>

          {/* Center Title - hidden on mobile */}
          <div className="hidden md:flex flex-col items-center">
            <h1 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--foreground)' }}>
              Sistem Informasi{' '}
              <span className="glow-text" style={{ color: '#06B6D4' }}>Perikanan Budidaya</span>
            </h1>
          </div>

          {/* Right controls: Admin + Theme toggle */}
          <div className="flex items-center gap-2">
            {/* Admin Login/Status Button */}
            <div className="relative" ref={loginRef}>
              <button
                onClick={() => {
                  if (isAdmin) {
                    setShowAdminMenu(!showAdminMenu);
                  } else {
                    setShowLoginForm(!showLoginForm);
                    setShowAdminMenu(!showAdminMenu);
                  }
                }}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl transition-all text-xs font-medium"
                style={
                  isAdmin
                    ? {
                        background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                        color: 'white',
                        boxShadow: '0 2px 12px rgba(6,182,212,0.35)',
                      }
                    : {
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(6,182,212,0.08)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(6,182,212,0.2)'}`,
                        color: 'var(--muted-foreground)',
                      }
                }
              >
                {isAdmin ? (
                  <>
                    <Shield className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Admin</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Login Admin</span>
                  </>
                )}
              </button>

              {/* Admin Dropdown */}
              {showAdminMenu && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden z-50"
                  style={{
                    background: isDark ? '#0D1B2E' : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.15)'}`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  }}
                >
                  {isAdmin ? (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{
                            background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                            boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
                          }}
                        >
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: '#06B6D4' }}>Admin Aktif</p>
                          <p className="text-[10px] text-muted-foreground">Akses penuh ke semua fitur</p>
                        </div>
                      </div>
                      <div
                        className="h-px"
                        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
                      />
                      <button
                        onClick={handleAdminLogout}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Logout Admin
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Lock className="h-3.5 w-3.5" style={{ color: '#06B6D4' }} />
                        <span className="text-xs font-semibold">Login Admin</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Masukkan password untuk mengakses fitur admin
                      </p>
                      <div className="flex gap-1.5">
                        <Input
                          type="password"
                          placeholder="Password admin..."
                          value={adminPassword}
                          onChange={(e) => {
                            setAdminPassword(e.target.value);
                            setLoginError('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAdminLogin();
                          }}
                          className="h-8 text-xs flex-1"
                          autoFocus
                        />
                        <Button
                          onClick={handleAdminLogin}
                          size="sm"
                          disabled={loginLoading || !adminPassword.trim()}
                          className="h-8 text-xs px-3"
                          style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
                        >
                          {loginLoading ? '...' : 'Masuk'}
                        </Button>
                      </div>
                      {loginError && (
                        <p className="text-[10px] text-red-400">{loginError}</p>
                      )}
                      <button
                        onClick={() => {
                          setShowAdminMenu(false);
                          setShowLoginForm(false);
                          setAdminPassword('');
                          setLoginError('');
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dark/Light toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              style={{
                background: isDark ? 'rgba(234,179,8,0.12)' : 'rgba(6,182,212,0.12)',
                border: `1px solid ${isDark ? 'rgba(234,179,8,0.25)' : 'rgba(6,182,212,0.25)'}`,
              }}
            >
              {isDark
                ? <Sun size={16} style={{ color: '#EAB308' }} />
                : <Moon size={16} style={{ color: '#0891B2' }} />
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Navigation: Standalone + Grouped Dropdowns ────────────────────── */}
      <div className="px-4 pb-0 max-w-screen-2xl mx-auto">
        <nav className="flex items-center gap-1 overflow-visible pb-0">

          {/* Standalone items (e.g., Dashboard) */}
          {STANDALONE_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="relative px-3 py-2 text-xs font-medium whitespace-nowrap transition-all rounded-t-lg flex items-center gap-1.5"
                style={{
                  color: isActive ? '#06B6D4' : 'var(--muted-foreground)',
                  background: isActive
                    ? isDark ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.08)'
                    : 'transparent',
                }}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #06B6D4, #0891B2)' }}
                  />
                )}
              </button>
            );
          })}

          {/* Group dropdown tabs */}
          {NAV_GROUPS.map((group) => {
            const items = GROUPED_ITEMS[group.id];
            if (!items || items.length === 0) return null;

            const isActive = activeGroupId === group.id;
            const isOpen = openDropdown === group.id;
            const GroupIcon = group.icon;

            return (
              <div
                key={group.id}
                className="relative"
                data-nav-dropdown={group.id}
                onMouseEnter={() => handleDropdownEnter(group.id)}
                onMouseLeave={handleDropdownLeave}
              >
                <button
                  onClick={() => setOpenDropdown(isOpen ? null : group.id)}
                  className="relative px-3 py-2 text-xs font-medium whitespace-nowrap transition-all rounded-t-lg flex items-center gap-1.5"
                  style={{
                    color: isActive ? group.color : 'var(--muted-foreground)',
                    background: isActive
                      ? isDark ? `${group.color}15` : `${group.color}12`
                      : 'transparent',
                  }}
                >
                  <GroupIcon className="h-3 w-3" />
                  {group.label}
                  <ChevronDown
                    className="h-2.5 w-2.5 transition-transform"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ background: group.gradient }}
                    />
                  )}
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                  <div
                    className="absolute left-0 top-full z-50 min-w-[220px]"
                    onMouseEnter={() => handleDropdownEnter(group.id)}
                    onMouseLeave={handleDropdownLeave}
                  >
                    <div
                      className="rounded-xl overflow-hidden mt-1"
                      style={{
                        background: isDark ? '#0D1B2E' : '#FFFFFF',
                        border: `1px solid ${isDark ? `${group.color}30` : `${group.color}20`}`,
                        boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${group.color}10`,
                      }}
                    >
                      {items.map((item) => {
                        const isItemActive = activeSection === item.id;
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all"
                            style={{
                              background: isItemActive ? `${group.color}18` : 'transparent',
                              color: isItemActive ? group.color : 'var(--foreground)',
                            }}
                            onMouseEnter={(e) => {
                              if (!isItemActive) {
                                e.currentTarget.style.background = `${group.color}10`;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isItemActive) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{
                                background: isItemActive ? group.gradient : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                              }}
                            >
                              <ItemIcon className="h-3.5 w-3.5" style={{ color: isItemActive ? 'white' : 'var(--muted-foreground)' }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium">{item.label}</p>
                              <p className="text-[10px] leading-tight" style={{ color: 'var(--muted-foreground)' }}>
                                {item.description}
                              </p>
                            </div>
                            {isItemActive && (
                              <div
                                className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: group.color }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Filter Bar — only shown on sections that use filters */}
      {['dashboard', 'data-produksi', 'peta-lokasi', 'tren-laporan'].includes(activeSection) && (
        <div className="px-4 max-w-screen-2xl mx-auto">
          <FilterBar compact />
        </div>
      )}

      {/* Bottom divider */}
      <div
        className="h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.3), transparent)' }}
      />
    </header>
  );
}
