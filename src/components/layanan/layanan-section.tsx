'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  IdCard,
  FileCheck,
  Microscope,
  Fish,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Clock,
  Shield,
  ExternalLink,
  QrCode,
  MapPin,
  Calendar,
  ArrowRight,
  Briefcase,
  ListChecks,
  BadgeCheck,
  Droplets,
  ThermometerSun,
  Beaker,
  FlaskConical,
  Waves,
  Anchor,
  Leaf,
} from 'lucide-react';
import { useFilterStore } from '@/store/filter-store';

// ─── Shared Types ──────────────────────────────────────────────
interface Step {
  icon: React.ElementType;
  title: string;
  desc: string;
}

interface Requirement {
  icon: React.ElementType;
  text: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

// ─── Data per Layanan ──────────────────────────────────────────
interface LayananData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  accentColor: string;
  accentGradient: string;
  icon: React.ElementType;
  whatIsIt: string;
  benefits: string[];
  steps: Step[];
  requirements: Requirement[];
  faqs: FaqItem[];
  externalLink?: string;
  externalLabel?: string;
}

const LAYANAN_DATA: LayananData[] = [
  // ── Kartu E-KUSUKA ────────────────────────────────────────
  {
    id: 'layanan-ekusuka',
    title: 'Kartu E-KUSUKA',
    subtitle: 'Kartu Pelaku Usaha Kelautan dan Perikanan',
    description: 'Identitas tunggal bagi pelaku usaha kelautan dan perikanan yang diterbitkan oleh Kementerian Kelautan dan Perikanan Republik Indonesia.',
    image: '/images/layanan/kartu-ekusuka.png',
    accentColor: '#10B981',
    accentGradient: 'linear-gradient(135deg, #10B981, #059669)',
    icon: IdCard,
    whatIsIt: 'Kartu KUSUKA (Kartu Pelaku Usaha Kelautan dan Perikanan) adalah identitas tunggal pelaku usaha kelautan dan perikanan yang diterbitkan berdasarkan Peraturan Menteri Kelautan dan Perikanan. Kartu ini berlaku selama 5 (lima) tahun dan dapat diperpanjang.',
    benefits: [
      'Sebagai identitas profesi pelaku usaha kelautan dan perikanan',
      'Sebagai basis data untuk perlindungan dan pemberdayaan pelaku usaha',
      'Memudahkan pelayanan dan pembinaan pelaku usaha',
      'Sebagai sarana pemantauan dan evaluasi pelaksanaan program Kementerian',
      'Akses bantuan dan program pemerintah sektor kelautan dan perikanan',
    ],
    steps: [
      { icon: FileText, title: 'Isi Formulir', desc: 'Isi formulir permohonan penerbitan Kartu KUSUKA' },
      { icon: Users, title: 'Lampirkan Dokumen', desc: 'Siapkan KTP, surat keterangan kepala desa/lurah, dan NPWP (korporasi)' },
      { icon: Clock, title: 'Verifikasi (2 Hari)', desc: 'Petugas verifikasi berkas dalam paling lambat 2 hari kerja' },
      { icon: Shield, title: 'Terbitkan Kartu', desc: 'Data diunggah ke aplikasi satu data dan kartu diterbitkan' },
    ],
    requirements: [
      { icon: FileText, text: 'Formulir permohonan penerbitan Kartu KUSUKA yang telah diisi' },
      { icon: IdCard, text: 'Fotokopi KTP orang perseorangan atau penanggung jawab korporasi' },
      { icon: MapPin, text: 'Surat keterangan dari kepala desa/lurah bahwa yang bersangkutan bekerja sebagai pelaku usaha' },
      { icon: FileCheck, text: 'Fotokopi NPWP untuk korporasi' },
    ],
    faqs: [
      { question: 'Berapa lama masa berlaku Kartu KUSUKA?', answer: 'Kartu KUSUKA berlaku selama 5 (lima) tahun dan dapat diperpanjang.' },
      { question: 'Apakah bisa mengubah data pada Kartu KUSUKA?', answer: 'Ya, perubahan dapat dilakukan setelah 3 bulan sejak kartu diterbitkan, apabila terdapat perubahan alamat, penanggung jawab korporasi, dan/atau profesi utama.' },
      { question: 'Bagaimana jika kartu hilang atau rusak?', answer: 'Ajukan permohonan penggantian secara tertulis dengan melampirkan kartu yang rusak atau surat keterangan hilang dari kepolisian.' },
      { question: 'Siapa saja yang termasuk pelaku usaha?', answer: 'Nelayan, pembudidaya ikan, petambak garam, pengolah ikan, pemasar perikanan, dan penyedia jasa pengiriman produk KP.' },
    ],
    externalLink: 'https://portaldata.kkp.go.id/register',
    externalLabel: 'Daftar di Portal Data KKP',
  },

  // ── NIB (Nomor Induk Berusaha) ──────────────────────────────
  {
    id: 'layanan-nib',
    title: 'NIB',
    subtitle: 'Nomor Induk Berusaha',
    description: 'Nomor identitas pelaku usaha yang diterbitkan melalui sistem Online Single Submission (OSS) sebagai pengganti izin usaha konvensional.',
    image: '/images/layanan/nib.png',
    accentColor: '#3B82F6',
    accentGradient: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    icon: FileCheck,
    whatIsIt: 'Nomor Induk Berusaha (NIB) adalah identitas pelaku usaha yang diterbitkan oleh Lembaga OSS setelah pelaku usaha melakukan pendaftaran secara elektronik. NIB berlaku sebagai pengganti izin usaha dan berlaku selama pelaku usaha masih menjalankan kegiatan usaha.',
    benefits: [
      'Pengganti izin usaha yang sebelumnya harus diperoleh dari berbagai instansi',
      'Dapat digunakan untuk keperluan perizinan berusaha, akses perbankan, dan lainnya',
      'Proses pendaftaran online tanpa perlu datang ke kantor',
      'Berlaku selama pelaku usaha masih menjalankan kegiatan usaha',
      'Terintegrasi dengan seluruh sistem perizinan berusaha berbasis elektronik',
    ],
    steps: [
      { icon: Users, title: 'Daftar Akun OSS', desc: 'Buat akun di portal OSS (Online Single Submission)' },
      { icon: FileText, title: 'Isi Data Usaha', desc: 'Lengkapi data pelaku usaha dan kegiatan usaha' },
      { icon: Shield, title: 'Verifikasi & Validasi', desc: 'Sistem OSS memverifikasi data yang dimasukkan' },
      { icon: BadgeCheck, title: 'NIB Diterbitkan', desc: 'NIB diterbitkan dan dapat diunduh langsung' },
    ],
    requirements: [
      { icon: IdCard, text: 'KTP Elektronik pelaku usaha' },
      { icon: FileText, text: 'NPWP (Nomor Pokok Wajib Pajak)' },
      { icon: MapPin, text: 'Data lokasi kegiatan usaha' },
      { icon: Briefcase, text: 'Data kegiatan usaha (KBKI/KBLI)' },
    ],
    faqs: [
      { question: 'Apakah NIB berlaku selamanya?', answer: 'Ya, NIB berlaku selama pelaku usaha masih menjalankan kegiatan usaha. NIB tidak memiliki masa berlaku.' },
      { question: 'Apakah NIB gratis?', answer: 'Ya, penerbitan NIB melalui portal OSS tidak dikenai biaya.' },
      { question: 'Apa bedanya NIB dengan izin usaha?', answer: 'NIB berfungsi sebagai identitas pelaku usaha dan menggantikan izin usaha. Setelah memperoleh NIB, pelaku usaha cukup melengkapi perizinan berusaha sesuai komitmen.' },
      { question: 'Bagaimana jika data usaha berubah?', answer: 'Pelaku usaha wajib melakukan pembaruan data melalui portal OSS.' },
    ],
    externalLink: 'https://oss.go.id',
    externalLabel: 'Daftar di Portal OSS',
  },

  // ── CPIB (Cara Pembenihan Ikan yang Baik) ──────────────────
  {
    id: 'layanan-cpib',
    title: 'CPIB',
    subtitle: 'Cara Pembenihan Ikan yang Baik',
    description: 'Pedoman praktik pembenihan ikan yang baik untuk menjamin kualitas benih ikan yang sehat, bebas penyakit, dan ramah lingkungan.',
    image: '/images/layanan/cpib.png',
    accentColor: '#8B5CF6',
    accentGradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
    icon: Microscope,
    whatIsIt: 'CPIB (Cara Pembenihan Ikan yang Baik) adalah pedoman yang mengatur tata cara pembenihan ikan yang baik dan benar guna menghasilkan benih ikan berkualitas. CPIB merupakan sertifikasi yang diberikan kepada unit pembenihan ikan yang memenuhi standar tertentu.',
    benefits: [
      'Menghasilkan benih ikan berkualitas tinggi dan bebas penyakit',
      'Meningkatkan kepercayaan pembudidaya terhadap benih yang diproduksi',
      'Menjamin keberlanjutan produksi benih ikan secara bertanggung jawab',
      'Memenuhi persyaratan untuk akses pasar yang lebih luas',
      'Meningkatkan daya saing produk perikanan budidaya',
    ],
    steps: [
      { icon: Beaker, title: 'Persiapan Fasilitas', desc: 'Siapkan fasilitas pembenihan sesuai standar CPIB' },
      { icon: Droplets, title: 'Manajemen Air', desc: 'Kelola kualitas air sesuai standar untuk pembenihan' },
      { icon: FlaskConical, title: 'Pemijahan & Penetasan', desc: 'Lakukan pemijahan dan penetasan telur secara terstandar' },
      { icon: ListChecks, title: 'Pemeriksaan & Sertifikasi', desc: 'Lakukan pemeriksaan kesehatan ikan dan ajukan sertifikasi CPIB' },
    ],
    requirements: [
      { icon: MapPin, text: 'Lokasi unit pembenihan sesuai peruntukan' },
      { icon: Droplets, text: 'Sumber air memenuhi baku mutu untuk pembenihan ikan' },
      { icon: ThermometerSun, text: 'Fasilitas pembenihan memenuhi standar teknis' },
      { icon: Shield, text: 'Bebas dari penyakit ikan yang harus dilaporkan (reportable diseases)' },
      { icon: Users, text: 'Tenaga kerja yang terampil dan terlatih' },
    ],
    faqs: [
      { question: 'Berapa lama sertifikasi CPIB berlaku?', answer: 'Sertifikasi CPIB berlaku selama 3 (tiga) tahun dan dapat diperpanjang.' },
      { question: 'Siapa yang menerbitkan sertifikat CPIB?', answer: 'Sertifikat CPIB diterbitkan oleh Kementerian Kelautan dan Perikanan melalui Dinas Perikanan daerah.' },
      { question: 'Apakah CPIB wajib?', answer: 'Sertifikasi CPIB bersifat sukarela namun sangat dianjurkan untuk meningkatkan kualitas benih dan daya saing.' },
      { question: 'Apa saja jenis ikan yang bisa disertifikasi CPIB?', answer: 'Seluruh jenis ikan yang dibudidayakan dapat mengajukan sertifikasi CPIB.' },
    ],
  },

  // ── CBIB (Cara Budidaya Ikan yang Baik) ──────────────────────
  {
    id: 'layanan-cbib',
    title: 'CBIB',
    subtitle: 'Cara Budidaya Ikan yang Baik',
    description: 'Pedoman praktik budidaya ikan yang baik untuk menjamin produksi ikan yang aman dikonsumsi, ramah lingkungan, dan berkelanjutan.',
    image: '/images/layanan/cbib.png',
    accentColor: '#F59E0B',
    accentGradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    icon: Fish,
    whatIsIt: 'CBIB (Cara Budidaya Ikan yang Baik) adalah pedoman yang mengatur tata cara budidaya ikan yang baik dan benar. CBIB mencakup aspek lokasi, sarana produksi, manajemen budidaya, pengendalian hama dan penyakit, serta penanganan pasca panen untuk menghasilkan produk perikanan yang aman dan berkualitas.',
    benefits: [
      'Menghasilkan produk ikan yang aman untuk dikonsumsi',
      'Mencegah pencemaran lingkungan dari kegiatan budidaya',
      'Meningkatkan produktivitas dan efisiensi budidaya',
      'Memenuhi persyaratan untuk akses pasar nasional dan internasional',
      'Meningkatkan pendapatan pembudidaya melalui produk berkualitas',
    ],
    steps: [
      { icon: MapPin, title: 'Pemilihan Lokasi', desc: 'Pilih lokasi budidaya sesuai kelayakan dan peruntukan' },
      { icon: Waves, title: 'Persiapan Sarana', desc: 'Siapkan wadah budidaya, air, dan benih berkualitas' },
      { icon: Leaf, title: 'Manajemen Budidaya', desc: 'Kelola pakan, air, dan kesehatan ikan secara optimal' },
      { icon: Anchor, title: 'Panen & Pasca Panen', desc: 'Lakukan panen dan penanganan pasca panen sesuai standar' },
    ],
    requirements: [
      { icon: MapPin, text: 'Lokasi sesuai RTRW dan tidak di kawasan lindung' },
      { icon: Droplets, text: 'Kualitas air memenuhi baku mutu untuk budidaya ikan' },
      { icon: Fish, text: 'Benih ikan berasal dari sumber yang terpercaya' },
      { icon: Leaf, text: 'Penggunaan pakan dan obat sesuai regulasi yang berlaku' },
      { icon: Shield, text: 'Memiliki sistem pengelolaan limbah budidaya' },
    ],
    faqs: [
      { question: 'Berapa lama sertifikasi CBIB berlaku?', answer: 'Sertifikasi CBIB berlaku selama 3 (tiga) tahun dan dapat diperpanjang.' },
      { question: 'Apa perbedaan CBIB dan CPIB?', answer: 'CBIB berlaku untuk kegiatan pembesaran/pembudidayaan ikan, sedangkan CPIB berlaku untuk kegiatan pembenihan ikan.' },
      { question: 'Bagaimana cara mengajukan sertifikasi CBIB?', answer: 'Ajukan melalui Dinas Perikanan daerah setempat dengan melengkapi persyaratan administrasi dan teknis.' },
      { question: 'Apakah CBIB diperlukan untuk ekspor?', answer: 'Ya, sertifikasi CBIB salah satu syarat untuk mengakses pasar ekspor produk perikanan budidaya.' },
    ],
  },
];

// ─── Main Component ────────────────────────────────────────────
export function LayananSection() {
  const activeSection = useFilterStore((s) => s.activeSection);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const currentLayanan = LAYANAN_DATA.find((l) => l.id === activeSection);

  if (currentLayanan) {
    return <LayananDetail data={currentLayanan} isDark={isDark} />;
  }

  // Default: show all layanan overview
  return <LayananOverview isDark={isDark} />;
}

// ─── Overview (landing for layanan) ────────────────────────────
function LayananOverview({ isDark }: { isDark: boolean }) {
  const setActiveSection = useFilterStore((s) => s.setActiveSection);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-xl overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))'
              : 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.04))',
          }}
        />
        <div className="relative p-5 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}
              >
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>Layanan Perikanan</h2>
                <p className="text-xs text-muted-foreground">Informasi layanan perizinan & sertifikasi perikanan budidaya</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Dinas Pertanian Ketahanan Pangan dan Perikanan Kab. Mempawah menyediakan berbagai layanan perizinan dan sertifikasi
              untuk mendukung kegiatan perikanan budidaya yang berkelanjutan dan sesuai regulasi.
            </p>
          </div>
          <img
            src="/images/layanan/layanan-hero.png"
            alt="Layanan Perikanan"
            className="w-full sm:w-64 h-40 object-cover rounded-xl shrink-0"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
          />
        </div>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {LAYANAN_DATA.map((layanan, idx) => {
          const Icon = layanan.icon;
          return (
            <motion.div
              key={layanan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.3 }}
            >
              <Card
                className="group cursor-pointer overflow-hidden transition-all hover:shadow-lg"
                style={{
                  background: isDark
                    ? 'linear-gradient(160deg, #0D1B2E, #0A1628)'
                    : '#FFFFFF',
                  border: `1px solid ${isDark ? `${layanan.accentColor}20` : `${layanan.accentColor}15`}`,
                }}
                onClick={() => setActiveSection(layanan.id)}
              >
                <CardContent className="p-0">
                  {/* Image */}
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={layanan.image}
                      alt={layanan.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${isDark ? 'rgba(7,14,26,0.9)' : 'rgba(255,255,255,0.85)'}, transparent)` }} />
                    <div className="absolute bottom-3 left-4 flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: layanan.accentGradient, boxShadow: `0 4px 16px ${layanan.accentColor}40` }}
                      >
                        <Icon className="h-4.5 w-4.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>{layanan.title}</h3>
                        <p className="text-[10px] text-muted-foreground">{layanan.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                      {layanan.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: layanan.accentColor }}>
                      <span>Selengkapnya</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: IdCard, label: 'Kartu E-KUSUKA', desc: 'Identitas pelaku KP', color: '#10B981' },
          { icon: FileCheck, label: 'NIB', desc: 'Izin usaha online', color: '#3B82F6' },
          { icon: Microscope, label: 'CPIB', desc: 'Pembenihan yang baik', color: '#8B5CF6' },
          { icon: Fish, label: 'CBIB', desc: 'Budidaya yang baik', color: '#F59E0B' },
        ].map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
              style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${stat.color}18` }}
              >
                <StatIcon className="h-4 w-4" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{stat.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Detail Page ───────────────────────────────────────────────
function LayananDetail({ data, isDark }: { data: LayananData; isDark: boolean }) {
  const setActiveSection = useFilterStore((s) => s.setActiveSection);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const Icon = data.icon;

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs shrink-0"
          onClick={() => setActiveSection('layanan-ekusuka')}
          style={{ borderColor: `${data.accentColor}30` }}
        >
          ← Kembali
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Briefcase className="h-3 w-3" />
          <span>Layanan</span>
          <ChevronRight className="h-3 w-3" />
          <span style={{ color: data.accentColor }}>{data.title}</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative rounded-xl overflow-hidden">
        <img
          src={data.image}
          alt={data.title}
          className="w-full h-48 sm:h-64 object-cover"
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${isDark ? 'rgba(7,14,26,0.95)' : 'rgba(255,255,255,0.92)'}, ${isDark ? 'rgba(7,14,26,0.7)' : 'rgba(255,255,255,0.6)'})` }} />
        <div className="absolute inset-0 p-5 sm:p-8 flex items-center">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: data.accentGradient, boxShadow: `0 8px 32px ${data.accentColor}50` }}
            >
              <Icon className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl sm:text-2xl" style={{ fontFamily: 'Syne, sans-serif' }}>{data.title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{data.subtitle}</p>
              {data.externalLink && (
                <a
                  href={data.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                  style={{ background: data.accentGradient, color: 'white' }}
                >
                  <ExternalLink className="h-3 w-3" />
                  {data.externalLabel}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Apa Itu? */}
      <Card style={{ background: isDark ? 'linear-gradient(160deg, #0D1B2E, #0A1628)' : '#FFFFFF', border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4" style={{ color: data.accentColor }} />
            <h3 className="font-semibold text-sm" style={{ color: data.accentColor }}>Apa itu {data.title}?</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.whatIsIt}</p>
        </CardContent>
      </Card>

      {/* Manfaat / Benefits */}
      <Card style={{ background: isDark ? 'linear-gradient(160deg, #0D1B2E, #0A1628)' : '#FFFFFF', border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4" style={{ color: data.accentColor }} />
            <h3 className="font-semibold text-sm" style={{ color: data.accentColor }}>Manfaat</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {data.benefits.map((benefit, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.2 }}
                className="flex items-start gap-2.5 p-3 rounded-lg"
                style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: data.accentColor }} />
                <span className="text-xs text-muted-foreground leading-relaxed">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alur / Steps */}
      <Card style={{ background: isDark ? 'linear-gradient(160deg, #0D1B2E, #0A1628)' : '#FFFFFF', border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="h-4 w-4" style={{ color: data.accentColor }} />
            <h3 className="font-semibold text-sm" style={{ color: data.accentColor }}>Alur Layanan</h3>
          </div>
          <div className="relative">
            {/* Connecting line */}
            <div
              className="absolute left-[19px] top-8 bottom-8 w-0.5 hidden sm:block"
              style={{ background: `${data.accentColor}30` }}
            />
            <div className="space-y-3">
              {data.steps.map((step, idx) => {
                const StepIcon = step.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.25 }}
                    className="flex items-start gap-4 relative"
                  >
                    {/* Step number */}
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center relative z-10"
                        style={{ background: data.accentGradient, boxShadow: `0 4px 12px ${data.accentColor}30` }}
                      >
                        <StepIcon className="h-4.5 w-4.5 text-white" />
                      </div>
                    </div>
                    <div className="pt-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${data.accentColor}18`, color: data.accentColor }}
                        >
                          Langkah {idx + 1}
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm mt-1">{step.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Persyaratan / Requirements */}
      <Card style={{ background: isDark ? 'linear-gradient(160deg, #0D1B2E, #0A1628)' : '#FFFFFF', border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4" style={{ color: data.accentColor }} />
            <h3 className="font-semibold text-sm" style={{ color: data.accentColor }}>Persyaratan</h3>
          </div>
          <div className="space-y-2">
            {data.requirements.map((req, idx) => {
              const ReqIcon = req.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${data.accentColor}18` }}
                  >
                    <ReqIcon className="h-3.5 w-3.5" style={{ color: data.accentColor }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{req.text}</span>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card style={{ background: isDark ? 'linear-gradient(160deg, #0D1B2E, #0A1628)' : '#FFFFFF', border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-4 w-4" style={{ color: data.accentColor }} />
            <h3 className="font-semibold text-sm" style={{ color: data.accentColor }}>Pertanyaan Umum (FAQ)</h3>
          </div>
          <div className="space-y-2">
            {data.faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-lg overflow-hidden transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  border: openFaq === idx ? `1px solid ${data.accentColor}30` : '1px solid transparent',
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <span className="text-xs font-medium pr-4">{faq.question}</span>
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 transition-transform"
                    style={{
                      color: data.accentColor,
                      transform: openFaq === idx ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3">
                        <div
                          className="h-px mb-2.5"
                          style={{ background: `${data.accentColor}20` }}
                        />
                        <p className="text-xs text-muted-foreground leading-relaxed">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contoh Kartu E-KUSUKA asli (only for E-KUSUKA) */}
      {data.id === 'layanan-ekusuka' && (
        <Card style={{ background: isDark ? 'linear-gradient(160deg, #0D1B2E, #0A1628)' : '#FFFFFF', border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="h-4 w-4" style={{ color: data.accentColor }} />
              <h3 className="font-semibold text-sm" style={{ color: data.accentColor }}>Contoh Kartu E-KUSUKA</h3>
            </div>
            <div className="flex justify-center">
              <div
                className="w-full max-w-lg rounded-xl overflow-hidden"
                style={{
                  boxShadow: `0 8px 32px rgba(16,185,129,0.2), 0 0 0 1px ${isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)'}`,
                }}
              >
                <img
                  src="/images/layanan/contoh-kartu-ekusuka.png"
                  alt="Contoh Kartu E-KUSUKA Asli"
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pelaku Usaha (only for E-KUSUKA) */}
      {data.id === 'layanan-ekusuka' && (
        <Card style={{ background: isDark ? 'linear-gradient(160deg, #0D1B2E, #0A1628)' : '#FFFFFF', border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4" style={{ color: data.accentColor }} />
              <h3 className="font-semibold text-sm" style={{ color: data.accentColor }}>Kategori Pelaku Usaha</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {[
                { title: 'Nelayan', items: ['Nelayan kecil', 'Nelayan tradisional', 'Nelayan buruh', 'Nelayan pemilik'], icon: Anchor },
                { title: 'Pembudidaya Ikan', items: ['Pembudidaya ikan kecil', 'Penggarap lahan', 'Pemilik lahan'], icon: Fish },
                { title: 'Petambak Garam', items: ['Petambak garam kecil', 'Penggarap tambak', 'Pemilik tambak'], icon: Waves },
                { title: 'Pengolah Ikan', items: ['Pengolah hasil perikanan'], icon: Beaker },
                { title: 'Pemasar Perikanan', items: ['Pedagang ikan', 'Distributor'], icon: Briefcase },
                { title: 'Penyedia Jasa', items: ['Pengiriman produk KP'], icon: ExternalLink },
              ].map((category) => {
                const CatIcon = category.icon;
                return (
                  <div
                    key={category.title}
                    className="p-3 rounded-lg"
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CatIcon className="h-3.5 w-3.5" style={{ color: data.accentColor }} />
                      <span className="text-xs font-semibold">{category.title}</span>
                    </div>
                    <ul className="space-y-1">
                      {category.items.map((item, idx) => (
                        <li key={idx} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full shrink-0" style={{ background: data.accentColor }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* NIB Additional Info */}
      {data.id === 'layanan-nib' && (
        <Card style={{ background: isDark ? 'linear-gradient(160deg, #0D1B2E, #0A1628)' : '#FFFFFF', border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4" style={{ color: data.accentColor }} />
              <h3 className="font-semibold text-sm" style={{ color: data.accentColor }}>Dasar Hukum NIB</h3>
            </div>
            <div className="space-y-2">
              {[
                'UU No. 11 Tahun 2020 tentang Cipta Kerja',
                'PP No. 5 Tahun 2021 tentang Perizinan Berusaha Berbasis Risiko',
                'Permendag No. 8 Tahun 2024 tentang Penyelenggaraan OSS',
                'Perka OSS No. 2 Tahun 2021 tentang Pedoman Penerbitan NIB',
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg"
                  style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                >
                  <FileCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: data.accentColor }} />
                  <span className="text-xs text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CPIB Standards */}
      {data.id === 'layanan-cpib' && (
        <Card style={{ background: isDark ? 'linear-gradient(160deg, #0D1B2E, #0A1628)' : '#FFFFFF', border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <BadgeCheck className="h-4 w-4" style={{ color: data.accentColor }} />
              <h3 className="font-semibold text-sm" style={{ color: data.accentColor }}>Standar Kualitas CPIB</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { icon: Droplets, label: 'Kualitas Air', desc: 'Memenuhi baku mutu air untuk pembenihan ikan' },
                { icon: ThermometerSun, label: 'Suhu & pH', desc: 'Parameter fisika-kimia air terjaga optimal' },
                { icon: Shield, label: 'Bebas Penyakit', desc: 'Tidak terjangkit penyakit yang harus dilaporkan' },
                { icon: Users, label: 'SDM Terlatih', desc: 'Tenaga kerja memiliki kompetensi pembenihan' },
                { icon: Beaker, label: 'Pakan Berkualitas', desc: 'Pakan memenuhi standar nutrisi untuk larva/benih' },
                { icon: MapPin, label: 'Lokasi Sesuai', desc: 'Lokasi unit pembenihan sesuai peruntukan' },
              ].map((std) => {
                const StdIcon = std.icon;
                return (
                  <div
                    key={std.label}
                    className="flex items-start gap-2.5 p-3 rounded-lg"
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${data.accentColor}18` }}
                    >
                      <StdIcon className="h-3.5 w-3.5" style={{ color: data.accentColor }} />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{std.label}</p>
                      <p className="text-[10px] text-muted-foreground">{std.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CBIB Standards */}
      {data.id === 'layanan-cbib' && (
        <Card style={{ background: isDark ? 'linear-gradient(160deg, #0D1B2E, #0A1628)' : '#FFFFFF', border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <BadgeCheck className="h-4 w-4" style={{ color: data.accentColor }} />
              <h3 className="font-semibold text-sm" style={{ color: data.accentColor }}>Aspek Penilaian CBIB</h3>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Lokasi & Tata Ruang', desc: 'Sesuai RTRW, tidak di kawasan lindung, memiliki batas jelas', progress: 100 },
                { label: 'Sarana & Prasarana', desc: 'Wadah budidaya, gudang pakan, peralatan produksi memadai', progress: 85 },
                { label: 'Manajemen Budidaya', desc: 'Pengelolaan pakan, air, benih, dan kesehatan ikan', progress: 90 },
                { label: 'Pengendalian Hama & Penyakit', desc: 'Pencegahan, pengendalian, dan pelaporan penyakit ikan', progress: 75 },
                { label: 'Penanganan Pasca Panen', desc: 'Penanganan, pengemasan, dan transportasi produk yang baik', progress: 80 },
                { label: 'Pengelolaan Lingkungan', desc: 'Sistem pengelolaan limbah dan dampak lingkungan', progress: 70 },
              ].map((aspect) => (
                <div
                  key={aspect.label}
                  className="p-3 rounded-lg"
                  style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium">{aspect.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">{aspect.desc}</p>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: data.accentGradient }}
                      initial={{ width: 0 }}
                      animate={{ width: `${aspect.progress}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact / CTA */}
      <Card
        className="overflow-hidden"
        style={{ border: `1px solid ${isDark ? `${data.accentColor}15` : `${data.accentColor}10`}` }}
      >
        <div
          className="p-5 sm:p-6 text-center"
          style={{ background: data.accentGradient }}
        >
          <h3 className="font-bold text-sm text-white mb-1">Butuh Bantuan?</h3>
          <p className="text-xs text-white/80 mb-3">
            Hubungi Dinas Pertanian Ketahanan Pangan dan Perikanan Kab. Mempawah
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            {data.externalLink && (
              <a
                href={data.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white/20 text-white hover:bg-white/30 transition-all"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {data.externalLabel || 'Kunjungi Website'}
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs gap-1.5"
              onClick={() => setActiveSection('dashboard')}
            >
              ← Kembali ke Dashboard
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
