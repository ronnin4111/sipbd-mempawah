'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  BookOpen,
  Upload,
  Trash2,
  FileSpreadsheet,
  FileText,
  File,
  Table,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Brain,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFilterStore } from '@/store/filter-store';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';

interface KBDocument {
  id: string;
  title: string;
  fileType: string;
  fileSize: number;
  description: string;
  category: string;
  totalChunks: number;
  createdAt: string;
  updatedAt: string;
}

interface KBStats {
  totalDocs: number;
  totalChunks: number;
  categoryBreakdown: { category: string; count: number }[];
  recentDocs: KBDocument[];
}

const CATEGORY_OPTIONS = [
  { value: 'umum', label: 'Umum' },
  { value: 'kusuka', label: 'KUSUKA' },
  { value: 'kebijakan', label: 'Kebijakan' },
  { value: 'laporan', label: 'Laporan' },
  { value: 'catatan', label: 'Catatan Lapangan' },
  { value: 'harga', label: 'Harga Pasar' },
  { value: 'lainnya', label: 'Lainnya' },
];

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  docx: FileText,
  txt: File,
  csv: Table,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCategoryBadge(category: string) {
  const colors: Record<string, string> = {
    kusuka: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    kebijakan: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    laporan: 'bg-green-500/15 text-green-400 border-green-500/20',
    catatan: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    harga: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    umum: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
    lainnya: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  };
  return colors[category] || colors.umum;
}

export function KnowledgeBaseSection() {
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;
  const isAdmin = useFilterStore((s) => s.isAdmin);

  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [stats, setStats] = useState<KBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Upload form state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('umum');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadPassword, setUploadPassword] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  // Filter
  const [filterCategory, setFilterCategory] = useState('semua');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ stats: 'true' });
      if (filterCategory !== 'semua') params.set('category', filterCategory);

      const res = await fetch(`/api/knowledge-base/list?${params}`);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.data);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Pilih file terlebih dahulu');
      return;
    }
    if (!uploadPassword) {
      setUploadError('Password admin diperlukan');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', uploadCategory);
      formData.append('description', uploadDescription);

      const res = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        headers: { 'x-admin-password': uploadPassword },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadOpen(false);
        setSelectedFile(null);
        setUploadDescription('');
        setUploadPassword('');
        fetchDocuments();
      } else {
        setUploadError(data.error || 'Gagal mengupload');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Gagal mengupload');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string, docTitle: string) => {
    const password = prompt(`Masukkan password admin untuk menghapus "${docTitle}":`);
    if (!password) return;

    setDeleting(docId);
    try {
      const res = await fetch(`/api/knowledge-base/delete?id=${docId}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password },
      });
      const data = await res.json();
      if (data.success) {
        fetchDocuments();
      } else {
        alert(data.error || 'Gagal menghapus');
      }
    } catch (err) {
      alert('Gagal menghapus dokumen');
    } finally {
      setDeleting(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/knowledge-base/search?q=${encodeURIComponent(searchQuery)}&max=5`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const cardBg = isDark
    ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10'
    : 'bg-white border-gray-200';
  const accentGradient = 'linear-gradient(135deg, #06B6D4, #0891B2)';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: accentGradient, boxShadow: '0 4px 16px rgba(6,182,212,0.3)' }}
          >
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              Basis Pengetahuan
            </h2>
            <p className="text-xs text-muted-foreground">
              Upload dokumen → AI bisa membaca & menjawab pertanyaan tentangnya
            </p>
          </div>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button
              className="gap-2"
              style={{ background: accentGradient }}
              disabled={!isAdmin}
            >
              <Upload className="h-4 w-4" />
              Upload Dokumen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" style={{ color: '#06B6D4' }} />
                Upload Dokumen Baru
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">File</label>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.docx,.txt,.csv"
                  onChange={(e) => {
                    setSelectedFile(e.target.files?.[0] || null);
                    setUploadError('');
                  }}
                  className="cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Format didukung: .xlsx, .xls, .docx, .txt, .csv
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Kategori</label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Deskripsi (opsional)</label>
                <Textarea
                  placeholder="Deskripsi singkat isi dokumen..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Password Admin</label>
                <Input
                  type="password"
                  placeholder="Masukkan password admin..."
                  value={uploadPassword}
                  onChange={(e) => {
                    setUploadPassword(e.target.value);
                    setUploadError('');
                  }}
                />
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {uploadError}
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="w-full gap-2"
                style={{ background: accentGradient }}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? 'Mengupload & Memproses...' : 'Upload & Proses'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className={`${cardBg}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-cyan-500/15">
                  <BookOpen className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {stats.totalDocs}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Dokumen</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${cardBg}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-500/15">
                  <FileText className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {stats.totalChunks}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Bagian Data</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${cardBg}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-500/15">
                  <Brain className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {stats.categoryBreakdown.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Kategori</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${cardBg}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-500/15">
                  <CheckCircle2 className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                    Aktif
                  </p>
                  <p className="text-[10px] text-muted-foreground">Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Info Banner */}
      <Card className={`${cardBg}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: accentGradient, boxShadow: '0 4px 16px rgba(6,182,212,0.2)' }}>
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm">Cara Kerja Basis Pengetahuan</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Upload dokumen apapun (Excel, Word, TXT, CSV) → Sistem otomatis membaca dan memecah konten →
                <strong className="text-cyan-400"> AI bisa menjawab pertanyaan</strong> berdasarkan dokumen yang diupload.
                Tidak perlu deploy ulang — cukup upload file baru dan AI langsung paham!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Cari di Basis Pengetahuan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button
            onClick={handleSearch}
            disabled={searching}
            variant="outline"
            className="gap-2"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Cari
          </Button>
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Kategori</SelectItem>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchDocuments} className="shrink-0">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card className={`${cardBg}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4 text-cyan-400" />
              Hasil Pencarian: &quot;{searchQuery}&quot;
              <Badge variant="outline" className="ml-auto text-[10px]">
                {searchResults.length} hasil
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-1"
                onClick={() => {
                  setSearchResults([]);
                  setSearchQuery('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {searchResults.map((result, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: isDark ? 'rgba(6,182,212,0.05)' : 'rgba(6,182,212,0.03)',
                    border: `1px solid ${isDark ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.1)'}`,
                  }}
                >
                  {result}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      ) : documents.length === 0 ? (
        <Card className={`${cardBg}`}>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold text-sm mb-1">Belum Ada Dokumen</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Upload dokumen pertama Anda (Excel, Word, TXT, atau CSV) dan AI akan otomatis
              bisa membaca dan menjawab pertanyaan tentang kontennya.
            </p>
            {!isAdmin && (
              <p className="text-[10px] text-cyan-400 mt-2">
                Login Admin diperlukan untuk upload dokumen
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const FileIcon = FILE_TYPE_ICONS[doc.fileType] || File;
            return (
              <Card key={doc.id} className={`${cardBg} group hover:border-cyan-500/30 transition-colors`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-cyan-500/10">
                      <FileIcon className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">{doc.title}</h4>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${getCategoryBadge(doc.category)}`}>
                          {CATEGORY_OPTIONS.find((c) => c.value === doc.category)?.label || doc.category}
                        </Badge>
                      </div>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground mb-1">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>•</span>
                        <span>{doc.totalChunks} bagian</span>
                        <span>•</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={deleting === doc.id}
                        onClick={() => handleDelete(doc.id, doc.title)}
                      >
                        {deleting === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
