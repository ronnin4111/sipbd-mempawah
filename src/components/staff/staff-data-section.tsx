'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, X, Save, Search, Users, UserCheck, Loader2, AlertCircle,
  Camera, Phone, MessageCircle
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
  fotoUrl: string;
  noWa: string;
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

// ─── Helper: Get initials from name ─────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

// ─── Helper: Format WA number to wa.me link ────────────────────────────
function formatWaLink(noWa: string): string {
  let num = noWa.replace(/[^0-9]/g, '');
  if (num.startsWith('0')) num = '62' + num.substring(1);
  if (!num.startsWith('62')) num = '62' + num;
  return `https://wa.me/${num}`;
}

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
  onSave: (data: { nama: string; nip: string; pangkatGolRuang: string; jabatan: string; fotoUrl: string; noWa: string }) => void;
  record: StaffRecord | null;
  isLoading: boolean;
  color: string;
  title: string;
}) {
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [pangkatGolRuang, setPangkatGolRuang] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [noWa, setNoWa] = useState('');
  const [prevOpen, setPrevOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens/changes record
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (record) {
        setNama(record.nama);
        setNip(record.nip);
        setPangkatGolRuang(record.pangkatGolRuang);
        setJabatan(record.jabatan);
        setFotoUrl(record.fotoUrl || '');
        setNoWa(record.noWa || '');
        setPhotoPreview(record.fotoUrl || '');
      } else {
        setNama(''); setNip(''); setPangkatGolRuang(''); setJabatan('');
        setFotoUrl(''); setNoWa(''); setPhotoPreview('');
      }
    }
  }

  if (!open) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran foto maksimal 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setFotoUrl(base64);
      setPhotoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setFotoUrl('');
    setPhotoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
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

        {/* Photo Upload Section */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative group">
            <div
              className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                background: photoPreview ? 'transparent' : `linear-gradient(135deg, ${color}30, ${color}10)`,
                border: `3px solid ${color}40`,
              }}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="h-8 w-8" style={{ color: `${color}80` }} />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110"
              style={{ background: color }}
            >
              <Camera className="h-4 w-4 text-white" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-medium hover:underline"
              style={{ color }}
            >
              Upload Foto
            </button>
            {photoPreview && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-xs text-red-400 hover:underline"
              >
                Hapus
              </button>
            )}
          </div>
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
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                No. WhatsApp
              </span>
            </label>
            <Input
              value={noWa}
              onChange={(e) => setNoWa(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="h-11"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Nomor akan ditampilkan sebagai tombol WhatsApp</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11">
            Batal
          </Button>
          <Button
            onClick={() => onSave({ nama, nip, pangkatGolRuang, jabatan, fotoUrl, noWa })}
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
// Staff Card Component (for card view)
// ═══════════════════════════════════════════════════════════════════════════════
function StaffCard({
  item,
  idx,
  config,
  isDark,
  isAdmin,
  onEdit,
  onDelete,
}: {
  item: StaffRecord;
  idx: number;
  config: typeof STAFF_CONFIG['penyuluh'];
  isDark: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: idx * 0.04 }}
      className="rounded-xl overflow-hidden transition-all hover:shadow-lg group"
      style={{
        background: isDark ? 'rgba(13,27,46,0.6)' : 'rgba(255,255,255,0.9)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Top color bar */}
      <div className="h-1.5" style={{ background: config.gradient }} />

      <div className="p-4 sm:p-5">
        {/* Profile Section */}
        <div className="flex items-start gap-3.5 mb-3">
          {/* Avatar */}
          <div
            className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shrink-0 ring-2"
            style={{
              background: item.fotoUrl ? 'transparent' : `linear-gradient(135deg, ${config.color}25, ${config.color}10)`,
              ringColor: `${config.color}30`,
            }}
          >
            {item.fotoUrl ? (
              <img
                src={item.fotoUrl}
                alt={item.nama}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <span
                className="text-base font-bold"
                style={{ color: config.color }}
              >
                {getInitials(item.nama)}
              </span>
            )}
          </div>

          {/* Name + Info */}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{item.nama}</h3>
            {item.jabatan && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{item.jabatan}</p>
            )}
            {item.pangkatGolRuang && (
              <span
                className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium mt-1"
                style={{
                  background: `${config.color}10`,
                  color: config.color,
                  border: `1px solid ${config.color}20`,
                }}
              >
                {item.pangkatGolRuang}
              </span>
            )}
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onEdit}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                style={{
                  background: `${config.color}10`,
                  color: config.color,
                  border: `1px solid ${config.color}20`,
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  color: '#EF4444',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* NIP row */}
        {item.nip && (
          <div className="text-[11px] text-muted-foreground mb-3 font-mono">
            NIP: {item.nip}
          </div>
        )}

        {/* Bottom: WhatsApp button */}
        <div className="flex items-center gap-2 mt-auto">
          {item.noWa ? (
            <a
              href={formatWaLink(item.noWa)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-white transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: '#25D366',
                boxShadow: '0 2px 8px rgba(37,211,102,0.3)',
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Hubungi via WhatsApp
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground"
              style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                border: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              }}
            >
              <Phone className="h-3 w-3" />
              Belum ada kontak
            </span>
          )}
        </div>
      </div>
    </motion.div>
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

  const handleSave = async (formData: { nama: string; nip: string; pangkatGolRuang: string; jabatan: string; fotoUrl: string; noWa: string }) => {
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
        const errorMsg = errorData.error || `Gagal menyimpan (HTTP ${res.status})`;
        throw new Error(errorMsg);
      }

      const savedData = await res.json();
      if (!savedData || !savedData.id) {
        throw new Error('Data tidak tersimpan dengan benar');
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
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal menghapus');
      }
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
      item.jabatan.toLowerCase().includes(q) ||
      (item.noWa || '').toLowerCase().includes(q)
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

      {/* Card Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl animate-pulse"
              style={{
                background: isDark ? 'rgba(13,27,46,0.4)' : 'rgba(240,249,255,0.5)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
              }}
            >
              <div className="h-1.5 rounded-t-xl" style={{ background: `${config.color}20` }} />
              <div className="p-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-14 h-14 rounded-full" style={{ background: `${config.color}10` }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded w-28" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                    <div className="h-3 rounded w-20" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }} />
                  </div>
                </div>
                <div className="h-8 rounded-lg mt-3 w-40" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filteredData.length === 0 ? (
        <div
          className="text-center py-16 px-4 rounded-xl"
          style={{
            background: isDark ? 'rgba(13,27,46,0.4)' : 'rgba(240,249,255,0.5)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Icon className="h-12 w-12 mx-auto mb-3 opacity-15" />
          <p className="text-sm font-medium">Belum ada data</p>
          <p className="text-xs mt-1 text-muted-foreground">
            {isAdmin ? 'Klik "Tambah Data" untuk menambahkan' : 'Data belum tersedia'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredData.map((item, idx) => (
              <StaffCard
                key={item.id}
                item={item}
                idx={idx}
                config={config}
                isDark={isDark}
                isAdmin={isAdmin}
                onEdit={() => { setEditingRecord(item); setEditOpen(true); }}
                onDelete={() => { setDeletingRecord(item); setDeleteOpen(true); }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

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
