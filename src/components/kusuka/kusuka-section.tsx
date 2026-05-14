'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Upload, Users, CheckCircle2, UserCheck, Building2, Loader2, Search, ChevronLeft, ChevronRight, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KusukaImportDialog } from './kusuka-import-dialog';

interface KusukaStats {
  total: number;
  validStatus: number;
  drafStatus: number;
  submitStatus: number;
  validKusukaCard: number;
  withKelompok: number;
  withoutKelompok: number;
  byKecamatan: Array<{ kecamatan: string; count: number }>;
  byBentukUsaha: Array<{ bentuk: string; count: number }>;
  kelompokList: Array<{ nama: string; kecamatan: string; count: number }>;
  recent: Array<{
    id: string;
    nama: string;
    kecamatan: string;
    kelDesa: string;
    namaKelompok: string;
    bentukUsaha: string;
    profesiUtama: string;
    noKusuka: string;
    statusKusuka: string;
    alamat: string;
    tglDibuat: string;
  }>;
  totalKelompok: number;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

interface KusukaSectionProps {
  hideHeader?: boolean;
}

const PAGE_SIZE_OPTIONS = [20, 30, 50];

export function KusukaSection({ hideHeader = false }: KusukaSectionProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: stats, isLoading, refetch } = useQuery<KusukaStats>({
    queryKey: ['kusuka-stats', searchQuery, currentPage, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      params.set('page', String(currentPage));
      params.set('pageSize', String(pageSize));
      const res = await fetch(`/api/kusuka/stats?${params}`);
      if (!res.ok) throw new Error('Failed to fetch KUSUKA stats');
      return res.json();
    },
    staleTime: 30000,
  });

  // Handle Enter key press for search
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }
  };

  // Handle search button click
  const handleSearchClick = () => {
    setSearchQuery(searchInput);
    setCurrentPage(1);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Handle page size change
  const handlePageSizeChange = (value: string) => {
    const newSize = parseInt(value, 10);
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleImportComplete = () => {
    refetch();
  };

  const totalPages = stats?.pagination?.totalPages ?? 1;
  const totalCount = stats?.pagination?.totalCount ?? 0;
  const page = stats?.pagination?.page ?? 1;

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const total = totalPages;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(total - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < total - 2) pages.push('ellipsis');
      pages.push(total);
    }

    return pages;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'Valid':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">Valid</Badge>;
      case 'Draf':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">Draf</Badge>;
      case 'Submit':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">Submit</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status || '-'}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <span className="ml-3 text-muted-foreground">Memuat data KUSUKA...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - hidden when shown as standalone page with its own banner */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-teal-600" />
              Data Registrasi KUSUKA
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Data pendaftaran Kartu Identitas Usaha Perikanan perorangan
            </p>
          </div>
        </div>
      )}

      {/* Import KUSUKA button - always visible */}
      <div className="flex justify-end">
        <Button
          onClick={() => setImportOpen(true)}
          className="gap-2 shrink-0"
          style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
        >
          <Upload className="h-4 w-4" />
          <span>Import KUSUKA</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" /> Total Registran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.validKusukaCard ?? 0} No.KUSUKA valid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> Status Valid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{stats?.validStatus ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Draf: {stats?.drafStatus ?? 0} | Submit: {stats?.submitStatus ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <UserCheck className="h-4 w-4" /> Dengan Kelompok
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-teal-600">{stats?.withKelompok ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Mandiri: {stats?.withoutKelompok ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Building2 className="h-4 w-4" /> Kelompok Unik
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalKelompok ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              dari data registrasi
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Stats by Kecamatan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kecamatan Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Per Kecamatan</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {stats?.byKecamatan.map((item) => (
                <div key={item.kecamatan} className="flex items-center justify-between text-sm">
                  <span className="truncate">{item.kecamatan}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (item.count / (stats?.total || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="font-medium w-8 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
              {(!stats?.byKecamatan || stats.byKecamatan.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bentuk Usaha + Kelompok Top */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bentuk Usaha & Kelompok Terbanyak</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              {/* Bentuk Usaha */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Bentuk Usaha:</p>
                <div className="flex flex-wrap gap-2">
                  {stats?.byBentukUsaha.map((item) => (
                    <Badge key={item.bentuk} variant="outline" className="text-xs">
                      {item.bentuk}: {item.count}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Top Kelompok */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Kelompok Terbanyak:</p>
                <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                  {stats?.kelompokList.slice(0, 10).map((item) => (
                    <div key={item.nama} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[200px]">{item.nama}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{item.count} orang</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Registrations Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base">
              Registrasi Terbaru
              {totalCount > 0 && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  ({totalCount} data)
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, kecamatan, kelompok... (Enter)"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="max-w-xs h-8 text-sm pl-8 pr-8"
                />
                {searchInput && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    aria-label="Hapus pencarian"
                  >
                    ✕
                  </button>
                )}
              </div>
              <Button
                onClick={handleSearchClick}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs shrink-0"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cari</span>
              </Button>
            </div>
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-1">
              Hasil pencarian untuk: &quot;{searchQuery}&quot; ({totalCount} data ditemukan)
            </p>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="border rounded-lg overflow-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-10">#</th>
                  <th className="px-3 py-2 text-left font-medium">Nama</th>
                  <th className="px-3 py-2 text-left font-medium">Kecamatan</th>
                  <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Desa</th>
                  <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Kelompok</th>
                  <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Bentuk Usaha</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent.map((r, index) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.nama}</td>
                    <td className="px-3 py-2">{r.kecamatan}</td>
                    <td className="px-3 py-2 hidden md:table-cell">{r.kelDesa}</td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      {r.namaKelompok || <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">{r.bentukUsaha}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center">{statusBadge(r.statusKusuka)}</td>
                  </tr>
                ))}
                {(!stats?.recent || stats.recent.length === 0) && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? 'Tidak ada data yang cocok dengan pencarian' : 'Belum ada data registrasi KUSUKA'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t">
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  Menampilkan {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} dari {totalCount} data
                </p>
                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5">
                  <Rows3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="h-7 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)} className="text-xs">
                          {size} baris
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* Previous button */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page numbers */}
                  {getPageNumbers().map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm">
                        …
                      </span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? 'default' : 'outline'}
                        size="icon"
                        className={`h-8 w-8 text-xs ${p === page ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
                        onClick={() => handlePageChange(p)}
                      >
                        {p}
                      </Button>
                    )
                  )}

                  {/* Next button */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <KusukaImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
