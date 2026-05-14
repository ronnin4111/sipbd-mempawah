'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pencil, Save, RotateCcw, Info, Lock, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { FISH_TYPES, CONTAINER_TYPES, DEFAULT_COMMODITY_PRICES, DEFAULT_PEMBENIHAN_PRICES } from '@/lib/constants';

interface PriceMatrix {
  prices: Record<string, Record<string, number>>;
  pembenihanPrices: Record<string, number>;
}

function formatRupiah(value: number): string {
  if (value === 0) return '-';
  return new Intl.NumberFormat('id-ID').format(value);
}

export function CommodityPricesTable() {
  const [data, setData] = useState<PriceMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, Record<string, number>>>({});
  const [editPembenihan, setEditPembenihan] = useState<Record<string, number>>({});
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/commodity-prices');
      if (!res.ok) throw new Error('Gagal mengambil data');
      const json = await res.json();
      setData(json);
      setEditData(json.prices);
      setEditPembenihan(json.pembenihanPrices);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil data harga komoditas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditClick = () => {
    setPasswordDialog(true);
    setPassword('');
  };

  const handlePasswordSubmit = async () => {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, type: 'admin' }),
      });
      const data = await res.json();
      if (data.valid) {
        setEditing(true);
        setPasswordDialog(false);
        toast.success('Mode edit diaktifkan');
      } else {
        toast.error('Password tidak valid');
      }
    } catch {
      toast.error('Gagal memverifikasi password');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: { fishType: string; containerType: string; price: number }[] = [];

      // Pembesaran prices
      for (const fish of FISH_TYPES) {
        for (const container of CONTAINER_TYPES) {
          updates.push({
            fishType: fish,
            containerType: container,
            price: editData[fish]?.[container] ?? 0,
          });
        }
        // Pembenihan prices
        updates.push({
          fishType: fish,
          containerType: 'Pembenihan',
          price: editPembenihan[fish] ?? 0,
        });
      }

      const res = await fetch('/api/commodity-prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, data: updates }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan');
      }

      toast.success('Harga komoditas berhasil disimpan');
      setEditing(false);
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (data) {
      setEditData(data.prices);
      setEditPembenihan(data.pembenihanPrices);
      toast.info('Data dikembalikan ke nilai tersimpan');
    }
  };

  const handleResetDefaults = () => {
    setEditData(DEFAULT_COMMODITY_PRICES);
    setEditPembenihan(DEFAULT_PEMBENIHAN_PRICES);
    toast.info('Data dikembalikan ke default');
  };

  const updateEditPrice = (fish: string, container: string, value: string) => {
    setEditData(prev => ({
      ...prev,
      [fish]: {
        ...prev[fish],
        [container]: Number(value) || 0,
      },
    }));
  };

  const updateEditPembenihan = (fish: string, value: string) => {
    setEditPembenihan(prev => ({
      ...prev,
      [fish]: Number(value) || 0,
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3 mx-auto" />
            <div className="h-40 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500 text-white">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Harga Komoditas Perikanan Budidaya</CardTitle>
                <CardDescription className="text-xs">
                  Daftar harga ikan per jenis dan wadah budidaya
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!editing ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleEditClick}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Edit Harga</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Memerlukan password admin</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <>
                  <Button
                    onClick={handleResetDefaults}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reset Default</span>
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="gap-1.5"
                    style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
                    disabled={saving}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Pembesaran Prices Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">Harga Pembesaran (Rp/Kg)</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Per Wadah Budidaya</Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Harga ikan hasil pembesaran per kilogram, bervariasi berdasarkan jenis wadah budidaya. Harga 0 berarti tidak tersedia untuk wadah tersebut.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[140px] font-semibold">Jenis Ikan</TableHead>
                  {CONTAINER_TYPES.map(ct => (
                    <TableHead key={ct} className="text-center min-w-[120px] font-semibold whitespace-nowrap">
                      {ct}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {FISH_TYPES.map(fish => (
                  <TableRow key={fish}>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                      {fish}
                    </TableCell>
                    {CONTAINER_TYPES.map(ct => {
                      const price = editing
                        ? (editData[fish]?.[ct] ?? 0)
                        : (data?.prices[fish]?.[ct] ?? 0);
                      return (
                        <TableCell key={ct} className="text-center">
                          {editing ? (
                            <Input
                              type="number"
                              value={price}
                              onChange={e => updateEditPrice(fish, ct, e.target.value)}
                              className="w-24 h-8 text-center text-xs mx-auto"
                              min={0}
                            />
                          ) : (
                            <span className={price === 0 ? 'text-muted-foreground' : 'font-medium'}>
                              {formatRupiah(price)}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pembenihan Prices Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">Harga Pembenihan (Rp/Ekor)</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Flat per Jenis Ikan</Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Harga benih ikan per ekor. Saat ini tersedia untuk Mas, Nila, dan Lele yang memiliki data pembenihan.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Jenis Ikan</TableHead>
                  <TableHead className="text-center font-semibold">Harga per Ekor (Rp)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FISH_TYPES.map(fish => {
                  const price = editing
                    ? (editPembenihan[fish] ?? 0)
                    : (data?.pembenihanPrices[fish] ?? 0);
                  const hasPembenihan = DEFAULT_PEMBENIHAN_PRICES[fish] !== undefined || price > 0;
                  return (
                    <TableRow key={fish}>
                      <TableCell className="font-medium">
                        {fish}
                        {!hasPembenihan && !editing && (
                          <span className="text-muted-foreground text-xs ml-2">(tidak ada pembenihan)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {editing ? (
                          <Input
                            type="number"
                            value={price}
                            onChange={e => updateEditPembenihan(fish, e.target.value)}
                            className="w-32 h-8 text-center text-xs mx-auto"
                            min={0}
                          />
                        ) : (
                          <span className={price === 0 ? 'text-muted-foreground' : 'font-medium'}>
                            {price === 0 ? '-' : formatRupiah(price)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Password Dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password Admin
            </DialogTitle>
            <DialogDescription>
              Masukkan password admin untuk mengedit harga komoditas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                placeholder="Masukkan password..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialog(false)}>
              Batal
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
            >
              Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
