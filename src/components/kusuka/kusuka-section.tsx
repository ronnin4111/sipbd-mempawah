'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Upload, Users, CheckCircle2, FileEdit, UserCheck, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
}

interface KusukaSectionProps {
  hideHeader?: boolean;
}

export function KusukaSection({ hideHeader = false }: KusukaSectionProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: stats, isLoading, refetch } = useQuery<KusukaStats>({
    queryKey: ['kusuka-stats', search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/kusuka/stats${params}`);
      if (!res.ok) throw new Error('Failed to fetch KUSUKA stats');
      return res.json();
    },
    staleTime: 30000,
  });

  const handleImportComplete = () => {
    refetch();
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Registrasi Terbaru</CardTitle>
            <Input
              placeholder="Cari nama, kecamatan, kelompok..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="border rounded-lg overflow-auto max-h-96 custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nama</th>
                  <th className="px-3 py-2 text-left font-medium">Kecamatan</th>
                  <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Desa</th>
                  <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Kelompok</th>
                  <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Bentuk Usaha</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
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
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      Belum ada data registrasi KUSUKA
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <KusukaImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
