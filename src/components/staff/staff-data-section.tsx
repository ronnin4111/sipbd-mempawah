'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, X, Save, Search, Users, UserCheck, Loader2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFilterStore } from '@/store/filter-store';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────
interface StaffRecord {
  id: string;
  nama: string;
  nip: string;
  pangkatGolRuang: string;
  jabatan: string;
  createdAt: string;
  updatedAt: string;
}

type StaffType = 'penyuluh' | 'pegawai';

interface StaffDataSectionProps {
  type: StaffType;
}

// ─── Config per type ────────────────────────────────────────────────────────
const STAFF_CONFIG: Record<StaffType, {
  title: string;
  apiPath: string;
  icon: typeof Users;
  color: string;
  gradient: string;
  description: string;
  badge: string;
}> = {
  penyuluh: {
    title: 'Data Penyuluh',
    apiPath: '/api/penyuluh',
    icon: UserCheck,
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981, #059669)',
    description: 'Data Penyuluh Pertanian / Perikanan Kabupaten Mempawah',
    badge: 'Penyuluh',
  },
  pegawai: {
    title: 'Data Pegawai',
    apiPath: '/api/pegawai',
    icon: Users,
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    description: 'Data Pegawai Dinas Pertanian Ketahanan Pangan dan Perikanan',
    badge: 'Pegawai',
  },
};

// ─── Edit Dialog ────────────────────────────────────────────────────────────
function EditDialog({
  open,
  onClose,
  onSave,
  record,
  isLoading,
  color,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { nama: string; nip: string; pangkatGolRuang: string; jabatan: string }) => void;
  record: StaffRecord | null;
  isLoading: boolean;
  color: string;
  title: string;
}) {
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [pangkatGolRuang, setPangkatGolRuang] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [prevOpen, setPrevOpen] = useState(false);

  // Reset form when dialog opens/changes record
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (record) {
        setNama(record.nama);
        setNip(record.nip);
        setPangkatGolRuang(record.pangkatGolRuang);
        setJabatan(record.jabatan);
      } else {
        setNama(''); setNip(''); setPangkatGolRuang(''); setJabatan('');
      }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md rounded-2xl p-6"
        style={{
          background: 'var(--background)',
          border: `1px solid ${color}30`,
          boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 40px ${color}10`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
            {record ? 'Edit' : 'Tambah'} {title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Nama <span className="text-red-400">*</span>
            </label>
            <Input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Masukkan nama..."
              className="h-11"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">NIP</label>
            <Input
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="Masukkan NIP..."
              className="h-11"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Pangkat Gol/Ruang</label>
            <Input
              value={pangkatGolRuang}
              onChange={(e) => setPangkatGolRuang(e.target.value)}
              placeholder="Contoh: III/a, IV/b..."
              className="h-11"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Jabatan</label>
            <Input
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              placeholder="Masukkan jabatan..."
              className="h-11"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11">
            Batal
          </Button>
          <Button
            onClick={() => onSave({ nama, nip, pangkatGolRuang, jabatan })}
            disabled={isLoading || !nama.trim()}
            className="flex-1 h-11 gap-2"
            style={{ background: color }}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Delete Confirmation ────────────────────────────────────────────────────
function DeleteDialog({
  open,
  onClose,
  onConfirm,
  isLoading,
  nama,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  nama: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm rounded-2xl p-6"
        style={{
          background: 'var(--background)',
          border: '1px solid rgba(239,68,68,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-base">Hapus Data</h3>
            <p className="text-xs text-muted-foreground">Tindakan ini tidak dapat dibatalkan</p>
          </div>
        </div>
        <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>
          Yakin ingin menghapus data <strong>{nama}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">Batal</Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-10 gap-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Hapus
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════════
export function StaffDataSection({ type }: StaffDataSectionProps) {
  const config = STAFF_CONFIG[type];
  const Icon = config.icon;
  const isAdmin = useFilterStore((s) => s.isAdmin);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;
  const { toast } = useToast();

  const [data, setData] = useState<StaffRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StaffRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<StaffRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(config.apiPath);
      const json = await res.json();
      if (Array.isArray(json)) {
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [config.apiPath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (formData: { nama: string; nip: string; pangkatGolRuang: string; jabatan: string }) => {
    setSaving(true);
    try {
      const url = editingRecord ? `${config.apiPath}/${editingRecord.id}` : config.apiPath;
      const method = editingRecord ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error || 'Gagal menyimpan data';
        throw new Error(errorMsg);
      }
      
      toast({
        title: editingRecord ? 'Data diperbarui' : 'Data ditambahkan',
        description: `${formData.nama} berhasil ${editingRecord ? 'diperbarui' : 'ditambahkan'}`,
      });
      setEditOpen(false);
      setEditingRecord(null);
      fetchData();
    } catch (err) {
      console.error('Error saving:', err);
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast({ title: 'Gagal menyimpan', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRecord) return;
    setDeleting(true);
    try {
      const res = await fetch(`${config.apiPath}/${deletingRecord.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast({
        title: 'Data dihapus',
        description: `${deletingRecord.nama} berhasil dihapus`,
      });
      setDeleteOpen(false);
      setDeletingRecord(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting:', err);
      toast({ title: 'Gagal menghapus', description: 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // Filter data based on search
  const filteredData = data.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.nama.toLowerCase().includes(q) ||
      item.nip.toLowerCase().includes(q) ||
      item.pangkatGolRuang.toLowerCase().includes(q) ||
      item.jabatan.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div
        className="rounded-xl p-5 sm:p-6"
        style={{
          background: isDark
            ? `linear-gradient(135deg, ${config.color}15, ${config.color}08)`
            : `linear-gradient(135deg, ${config.color}08, ${config.color}04)`,
          border: `1px solid ${isDark ? `${config.color}20` : `${config.color}15`}`,
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: config.gradient,
                boxShadow: `0 4px 20px ${config.color}40`,
              }}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                {config.title}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${config.color}15`, color: config.color, border: `1px solid ${config.color}25` }}
            >
              {data.length} {config.badge}
            </span>
          </div>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NIP, pangkat, atau jabatan..."
            className="pl-9 h-10"
          />
        </div>
        {isAdmin && (
          <Button
            onClick={() => { setEditingRecord(null); setEditOpen(true); }}
            className="gap-2 h-10 shrink-0"
            style={{ background: config.gradient }}
          >
            <Plus className="h-4 w-4" />
            Tambah Data
          </Button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  background: isDark ? 'rgba(13,27,46,0.8)' : 'rgba(240,249,255,0.8)',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-12">No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">NIP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Pangkat Gol/Ruang</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Jabatan</th>
                {isAdmin && (
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground w-24">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-8" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-32" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 bg-muted rounded w-28" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-muted rounded w-16" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-muted rounded w-24" /></td>
                    {isAdmin && <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16 mx-auto" /></td>}
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <Icon className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Belum ada data</p>
                    <p className="text-xs mt-1">
                      {isAdmin ? 'Klik "Tambah Data" untuk menambahkan' : 'Data belum tersedia'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    className="transition-colors"
                    style={{
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark ? 'rgba(6,182,212,0.04)' : 'rgba(8,145,178,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-sm">{item.nama}</span>
                        {/* Show NIP/Jabatan on mobile inline */}
                        <div className="sm:hidden text-[10px] text-muted-foreground mt-0.5">
                          {item.nip && <span className="mr-2">NIP: {item.nip}</span>}
                          {item.jabatan && <span>{item.jabatan}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs hidden sm:table-cell">
                      <span className="font-mono text-muted-foreground">{item.nip || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs hidden md:table-cell">
                      <span
                        className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium"
                        style={{
                          background: item.pangkatGolRuang ? `${config.color}10` : 'transparent',
                          color: item.pangkatGolRuang ? config.color : 'var(--muted-foreground)',
                          border: item.pangkatGolRuang ? `1px solid ${config.color}20` : 'none',
                        }}
                      >
                        {item.pangkatGolRuang || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{item.jabatan || '-'}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { setEditingRecord(item); setEditOpen(true); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{
                              background: `${config.color}10`,
                              color: config.color,
                              border: `1px solid ${config.color}20`,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `${config.color}20`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = `${config.color}10`;
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { setDeletingRecord(item); setDeleteOpen(true); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{
                              background: 'rgba(239,68,68,0.1)',
                              color: '#EF4444',
                              border: '1px solid rgba(239,68,68,0.2)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin notice */}
      {!isAdmin && (
        <div
          className="text-center py-3 px-4 rounded-xl text-xs"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            border: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            color: 'var(--muted-foreground)',
          }}
        >
          Login sebagai admin untuk menambah, mengedit, atau menghapus data.
        </div>
      )}

      {/* Edit Dialog */}
      <EditDialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditingRecord(null); }}
        onSave={handleSave}
        record={editingRecord}
        isLoading={saving}
        color={config.color}
        title={config.badge}
      />

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeletingRecord(null); }}
        onConfirm={handleDelete}
        isLoading={deleting}
        nama={deletingRecord?.nama || ''}
      />
    </div>
  );
}
