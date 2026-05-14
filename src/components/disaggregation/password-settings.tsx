'use client';

import { useState } from 'react';
import { KeyRound, Shield, FileSpreadsheet, Eye, EyeOff, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export function PasswordSettings() {
  // Admin password change
  const [currentAdminPwd, setCurrentAdminPwd] = useState('');
  const [newAdminPwd, setNewAdminPwd] = useState('');
  const [confirmAdminPwd, setConfirmAdminPwd] = useState('');
  const [showAdminPwd, setShowAdminPwd] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Export password change
  const [currentExportPwd, setCurrentExportPwd] = useState('');
  const [newExportPwd, setNewExportPwd] = useState('');
  const [confirmExportPwd, setConfirmExportPwd] = useState('');
  const [showExportPwd, setShowExportPwd] = useState(false);
  const [savingExport, setSavingExport] = useState(false);

  const handleChangeAdminPassword = async () => {
    if (!currentAdminPwd.trim()) {
      toast.error('Masukkan password admin saat ini');
      return;
    }
    if (!newAdminPwd.trim() || newAdminPwd.trim().length < 4) {
      toast.error('Password baru minimal 4 karakter');
      return;
    }
    if (newAdminPwd !== confirmAdminPwd) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }

    setSavingAdmin(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentAdminPwd,
          type: 'admin',
          newPassword: newAdminPwd,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Gagal mengubah password admin');
        return;
      }

      toast.success('Password admin berhasil diubah!');
      setCurrentAdminPwd('');
      setNewAdminPwd('');
      setConfirmAdminPwd('');
    } catch {
      toast.error('Gagal terhubung ke server');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleChangeExportPassword = async () => {
    if (!currentExportPwd.trim()) {
      toast.error('Masukkan password admin saat ini untuk otorisasi');
      return;
    }
    if (!newExportPwd.trim() || newExportPwd.trim().length < 4) {
      toast.error('Password baru minimal 4 karakter');
      return;
    }
    if (newExportPwd !== confirmExportPwd) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }

    setSavingExport(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentExportPwd,
          type: 'export',
          newPassword: newExportPwd,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Gagal mengubah password export');
        return;
      }

      toast.success('Password export Excel berhasil diubah!');
      setCurrentExportPwd('');
      setNewExportPwd('');
      setConfirmExportPwd('');
    } catch {
      toast.error('Gagal terhubung ke server');
    } finally {
      setSavingExport(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
            boxShadow: '0 4px 12px rgba(6,182,212,0.3)',
          }}
        >
          <KeyRound className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold">Pengaturan Password</h2>
          <p className="text-xs text-muted-foreground">
            Ubah password admin dan export Excel
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div
        className="flex items-start gap-2 p-3 rounded-lg text-xs text-muted-foreground"
        style={{
          background: 'rgba(6,182,212,0.06)',
          border: '1px solid rgba(6,182,212,0.15)',
        }}
      >
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#EAB308' }} />
        <span>
          Password disimpan di database. Perubahan berlaku segera tanpa perlu deploy ulang.
          Untuk mengubah password, Anda harus memasukkan password admin saat ini sebagai otorisasi.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Admin Password Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-cyan-600 text-white">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Password Admin</CardTitle>
                <CardDescription className="text-[11px]">
                  Untuk akses: Disagregasi, Tambah/Edit/Hapus Data, Import, Harga Komoditas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Password Admin Saat Ini</Label>
              <div className="relative">
                <Input
                  type={showAdminPwd ? 'text' : 'password'}
                  placeholder="Masukkan password admin saat ini..."
                  value={currentAdminPwd}
                  onChange={(e) => setCurrentAdminPwd(e.target.value)}
                  className="text-xs pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPwd(!showAdminPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAdminPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Password Admin Baru</Label>
              <Input
                type="password"
                placeholder="Minimal 4 karakter..."
                value={newAdminPwd}
                onChange={(e) => setNewAdminPwd(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Konfirmasi Password Baru</Label>
              <Input
                type="password"
                placeholder="Ulangi password baru..."
                value={confirmAdminPwd}
                onChange={(e) => setConfirmAdminPwd(e.target.value)}
                className="text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleChangeAdminPassword();
                }}
              />
              {confirmAdminPwd && newAdminPwd !== confirmAdminPwd && (
                <p className="text-[10px] text-red-400">Password tidak cocok</p>
              )}
              {confirmAdminPwd && newAdminPwd === confirmAdminPwd && (
                <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Password cocok
                </p>
              )}
            </div>
            <Button
              onClick={handleChangeAdminPassword}
              disabled={savingAdmin || !currentAdminPwd || !newAdminPwd || newAdminPwd !== confirmAdminPwd || newAdminPwd.length < 4}
              className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700 text-xs"
              size="sm"
            >
              {savingAdmin ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Ubah Password Admin
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Export Password Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-600 text-white">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Password Export Excel</CardTitle>
                <CardDescription className="text-[11px]">
                  Khusus untuk export data ke file Excel (.xlsx)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Password Admin Saat Ini</Label>
              <div className="relative">
                <Input
                  type={showExportPwd ? 'text' : 'password'}
                  placeholder="Otorisasi dengan password admin..."
                  value={currentExportPwd}
                  onChange={(e) => setCurrentExportPwd(e.target.value)}
                  className="text-xs pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowExportPwd(!showExportPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showExportPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                * Gunakan password admin untuk mengotorisasi perubahan
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Password Export Baru</Label>
              <Input
                type="password"
                placeholder="Minimal 4 karakter..."
                value={newExportPwd}
                onChange={(e) => setNewExportPwd(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Konfirmasi Password Baru</Label>
              <Input
                type="password"
                placeholder="Ulangi password export baru..."
                value={confirmExportPwd}
                onChange={(e) => setConfirmExportPwd(e.target.value)}
                className="text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleChangeExportPassword();
                }}
              />
              {confirmExportPwd && newExportPwd !== confirmExportPwd && (
                <p className="text-[10px] text-red-400">Password tidak cocok</p>
              )}
              {confirmExportPwd && newExportPwd === confirmExportPwd && (
                <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Password cocok
                </p>
              )}
            </div>
            <Button
              onClick={handleChangeExportPassword}
              disabled={savingExport || !currentExportPwd || !newExportPwd || newExportPwd !== confirmExportPwd || newExportPwd.length < 4}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-xs"
              size="sm"
            >
              {savingExport ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Ubah Password Export
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
