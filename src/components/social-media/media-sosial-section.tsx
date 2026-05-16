'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Instagram,
  Facebook,
  Youtube,
  Twitter,
  ExternalLink,
  Plus,
  Trash2,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  Settings,
  X,
  Loader2,
  Link2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Heart,
  MessageCircle,
  Share2,
  ImageIcon,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFilterStore } from '@/store/filter-store';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SocialMediaPost {
  id: string;
  platform: string;
  postUrl: string;
  embedUrl: string;
  caption: string;
  thumbnailUrl: string;
  isPinned: boolean;
  sortOrder: number;
  isActive: boolean;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SocialAccount {
  platform: string;
  username: string;
  url: string;
  displayName: string;
  followers?: string;
}

// ─── Platform Config ─────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, {
  icon: typeof Instagram;
  label: string;
  color: string;
  gradient: string;
  bgClass: string;
  placeholder: string;
}> = {
  instagram: {
    icon: Instagram,
    label: 'Instagram',
    color: '#E4405F',
    gradient: 'linear-gradient(135deg, #833AB4, #E4405F, #F77737)',
    bgClass: 'from-purple-500 via-pink-500 to-orange-400',
    placeholder: 'https://www.instagram.com/p/xxxxx/',
  },
  facebook: {
    icon: Facebook,
    label: 'Facebook',
    color: '#1877F2',
    gradient: 'linear-gradient(135deg, #1877F2, #42A5F5)',
    bgClass: 'from-blue-600 to-blue-400',
    placeholder: 'https://www.facebook.com/xxxxx/posts/xxxxx',
  },
  youtube: {
    icon: Youtube,
    label: 'YouTube',
    color: '#FF0000',
    gradient: 'linear-gradient(135deg, #FF0000, #FF4444)',
    bgClass: 'from-red-600 to-red-400',
    placeholder: 'https://www.youtube.com/watch?v=xxxxx',
  },
  tiktok: {
    icon: Share2,
    label: 'TikTok',
    color: '#000000',
    gradient: 'linear-gradient(135deg, #25F4EE, #FE2C55)',
    bgClass: 'from-cyan-400 to-pink-500',
    placeholder: 'https://www.tiktok.com/@xxxxx/video/xxxxx',
  },
  twitter: {
    icon: Twitter,
    label: 'X (Twitter)',
    color: '#1DA1F2',
    gradient: 'linear-gradient(135deg, #1DA1F2, #0D8BD9)',
    bgClass: 'from-sky-500 to-sky-400',
    placeholder: 'https://twitter.com/xxxxx/status/xxxxx',
  },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function MediaSosialSection() {
  const isAdmin = useFilterStore((s) => s.isAdmin);
  const setActiveSection = useFilterStore((s) => s.setActiveSection);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, accountsRes] = await Promise.all([
        fetch('/api/social-media'),
        fetch('/api/social-media/accounts'),
      ]);
      const postsData = await postsRes.json();
      const accountsData = await accountsRes.json();
      setPosts(postsData.posts || []);
      setAccounts(accountsData.accounts || []);
    } catch (error) {
      console.error('Failed to fetch social media data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter posts by platform
  const filteredPosts = selectedPlatform === 'all'
    ? posts
    : posts.filter((p) => p.platform === selectedPlatform);

  // Group posts by platform for stats
  const platformStats = posts.reduce((acc, post) => {
    acc[post.platform] = (acc[post.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className="rounded-xl p-5 sm:p-6"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(228,64,95,0.12), rgba(131,58,180,0.08), rgba(247,119,55,0.08))'
            : 'linear-gradient(135deg, rgba(228,64,95,0.06), rgba(131,58,180,0.04), rgba(247,119,55,0.04))',
          border: `1px solid ${isDark ? 'rgba(228,64,95,0.2)' : 'rgba(228,64,95,0.12)'}`,
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #833AB4, #E4405F, #F77737)',
                boxShadow: '0 4px 20px rgba(228,64,95,0.4)',
              }}
            >
              <Instagram className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                Media Sosial Dinas
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ikuti akun resmi Dinas Pertanian Ketahanan Pangan dan Perikanan Kab. Mempawah
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs shrink-0"
              style={{
                borderColor: isDark ? 'rgba(228,64,95,0.3)' : 'rgba(228,64,95,0.2)',
                color: '#E4405F',
              }}
            >
              <Settings className="h-3.5 w-3.5" />
              {showAdminPanel ? 'Tutup Panel' : 'Kelola'}
            </Button>
          )}
        </div>
      </div>

      {/* Social Media Account Cards */}
      <SocialAccountCards accounts={accounts} isDark={isDark} onUpdate={fetchData} />

      {/* Platform Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setSelectedPlatform('all')}
          className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
          style={{
            background: selectedPlatform === 'all'
              ? 'linear-gradient(135deg, #833AB4, #E4405F, #F77737)'
              : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            color: selectedPlatform === 'all' ? 'white' : 'var(--muted-foreground)',
            border: `1px solid ${selectedPlatform === 'all' ? 'transparent' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          }}
        >
          Semua ({posts.length})
        </button>
        {Object.entries(PLATFORM_CONFIG).map(([key, config]) => {
          if (!platformStats[key]) return null;
          return (
            <button
              key={key}
              onClick={() => setSelectedPlatform(key)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5"
              style={{
                background: selectedPlatform === key
                  ? config.gradient
                  : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                color: selectedPlatform === key ? 'white' : 'var(--muted-foreground)',
                border: `1px solid ${selectedPlatform === key ? 'transparent' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              }}
            >
              <config.icon className="h-3 w-3" />
              {config.label} ({platformStats[key]})
            </button>
          );
        })}
      </div>

      {/* Admin Panel */}
      <AnimatePresence>
        {showAdminPanel && isAdmin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AdminPanel
              posts={posts}
              accounts={accounts}
              isDark={isDark}
              onUpdate={fetchData}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts Gallery */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#E4405F' }} />
        </div>
      ) : filteredPosts.length === 0 ? (
        <EmptyState isDark={isDark} />
      ) : (
        <PostsGallery posts={filteredPosts} isDark={isDark} />
      )}
    </div>
  );
}

// ─── Social Account Cards ────────────────────────────────────────────────────

function SocialAccountCards({
  accounts,
  isDark,
}: {
  accounts: SocialAccount[];
  isDark: boolean;
  onUpdate: () => void;
}) {
  // Default accounts if none configured
  const displayAccounts = accounts.length > 0 ? accounts : [
    { platform: 'instagram', username: '@dkppmempawah', url: 'https://instagram.com/dkppmempawah', displayName: 'DKPP Mempawah', followers: '' },
    { platform: 'facebook', username: 'DKPP Mempawah', url: 'https://facebook.com/dkppmempawah', displayName: 'DKPP Mempawah', followers: '' },
    { platform: 'youtube', username: 'DKPP Mempawah', url: '#', displayName: 'DKPP Mempawah', followers: '' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {displayAccounts.map((account) => {
        const config = PLATFORM_CONFIG[account.platform];
        if (!config) return null;
        const Icon = config.icon;

        return (
          <a
            key={account.platform}
            href={account.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <Card
              className={`transition-all hover:scale-[1.02] ${isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10 hover:border-cyan-500/20' : 'bg-white border-gray-200 hover:border-gray-300'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: config.gradient, boxShadow: `0 4px 16px ${config.color}33` }}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{account.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{account.username}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                {account.followers && (
                  <p className="text-[10px] text-muted-foreground mt-2 ml-[52px]">
                    {account.followers} pengikut
                  </p>
                )}
              </CardContent>
            </Card>
          </a>
        );
      })}
    </div>
  );
}

// ─── Posts Gallery ───────────────────────────────────────────────────────────

function PostsGallery({ posts, isDark }: { posts: SocialMediaPost[]; isDark: boolean }) {
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  return (
    <>
      {/* Instagram-style Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post, index) => {
          const config = PLATFORM_CONFIG[post.platform];
          const isExpanded = expandedPost === post.id;

          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <Card
                className={`overflow-hidden transition-all hover:shadow-lg ${isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}`}
              >
                {/* Post Header */}
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {config && (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: config.gradient }}
                      >
                        <config.icon className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                    <span className="text-xs font-medium">{config?.label || post.platform}</span>
                    {post.isPinned && (
                      <Pin className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                {/* Embedded Content */}
                <div className="px-3 pb-2">
                  {post.embedUrl && post.platform === 'instagram' ? (
                    <div
                      className="relative rounded-lg overflow-hidden bg-black/5"
                      style={{ minHeight: 380 }}
                    >
                      {isExpanded ? (
                        <iframe
                          src={post.embedUrl}
                          className="w-full border-0 rounded-lg"
                          style={{ minHeight: 480, maxHeight: 600 }}
                          loading="lazy"
                          title={`Instagram post`}
                        />
                      ) : (
                        <div
                          className="relative cursor-pointer group"
                          onClick={() => setExpandedPost(post.id)}
                          style={{ minHeight: 380 }}
                        >
                          <iframe
                            src={post.embedUrl}
                            className="w-full border-0 rounded-lg pointer-events-none"
                            style={{ minHeight: 380, maxHeight: 400 }}
                            loading="lazy"
                            title={`Instagram post preview`}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                              <ExternalLink className="h-4 w-4 text-gray-700" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : post.embedUrl && post.platform === 'youtube' ? (
                    <div className="relative rounded-lg overflow-hidden" style={{ paddingTop: '56.25%' }}>
                      <iframe
                        src={post.embedUrl}
                        className="absolute inset-0 w-full h-full border-0 rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                        title={`YouTube video`}
                      />
                    </div>
                  ) : post.embedUrl && post.platform === 'tiktok' ? (
                    <div className="rounded-lg overflow-hidden" style={{ minHeight: 500 }}>
                      <iframe
                        src={post.embedUrl}
                        className="w-full border-0 rounded-lg"
                        style={{ minHeight: 500 }}
                        loading="lazy"
                        title={`TikTok video`}
                      />
                    </div>
                  ) : post.embedUrl && post.platform === 'facebook' ? (
                    <div className="rounded-lg overflow-hidden" style={{ minHeight: 300 }}>
                      <iframe
                        src={post.embedUrl}
                        className="w-full border-0 rounded-lg"
                        style={{ minHeight: 300, maxWidth: 500 }}
                        loading="lazy"
                        title={`Facebook post`}
                      />
                    </div>
                  ) : (
                    /* Fallback: Link card */
                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div
                        className="rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-all hover:scale-[1.02]"
                        style={{
                          background: isDark
                            ? 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))'
                            : 'linear-gradient(135deg, rgba(0,0,0,0.04), rgba(0,0,0,0.02))',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                          minHeight: 160,
                        }}
                      >
                        {config ? (
                          <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{ background: config.gradient, boxShadow: `0 4px 16px ${config.color}33` }}
                          >
                            <config.icon className="h-7 w-7 text-white" />
                          </div>
                        ) : (
                          <Link2 className="h-7 w-7 text-muted-foreground" />
                        )}
                        <p className="text-xs text-muted-foreground text-center">
                          Lihat di {config?.label || post.platform}
                        </p>
                        <div className="flex items-center gap-1 text-xs" style={{ color: config?.color || '#06B6D4' }}>
                          <ExternalLink className="h-3 w-3" />
                          Buka Link
                        </div>
                      </div>
                    </a>
                  )}
                </div>

                {/* Caption */}
                {post.caption && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {post.caption}
                    </p>
                  </div>
                )}

                {/* Footer with date */}
                <div
                  className="px-4 py-2 flex items-center justify-between"
                  style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}
                >
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(post.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Heart className="h-3 w-3 text-muted-foreground" />
                    <MessageCircle className="h-3 w-3 text-muted-foreground" />
                    <Share2 className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Expanded Post Modal */}
      <AnimatePresence>
        {expandedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setExpandedPost(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-xl overflow-hidden"
              style={{
                background: isDark ? '#0D1B2E' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(0,0,0,0.1)'}`,
                maxHeight: '90vh',
              }}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="text-sm font-semibold">Instagram Post</h3>
                <button onClick={() => setExpandedPost(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-3 pb-3">
                {(() => {
                  const post = posts.find((p) => p.id === expandedPost);
                  if (!post?.embedUrl) return null;
                  return (
                    <iframe
                      src={post.embedUrl}
                      className="w-full border-0 rounded-lg"
                      style={{ minHeight: 500, maxHeight: '75vh' }}
                      title="Instagram post expanded"
                    />
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 rounded-xl"
      style={{
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'linear-gradient(135deg, rgba(228,64,95,0.15), rgba(131,58,180,0.1))',
        }}
      >
        <ImageIcon className="h-8 w-8" style={{ color: '#E4405F' }} />
      </div>
      <p className="text-sm font-medium mb-1">Belum Ada Post</p>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Postingan media sosial akan ditampilkan di sini. Admin dapat menambahkan link post Instagram, Facebook, YouTube, dan lainnya.
      </p>
    </div>
  );
}

// ─── Admin Panel ─────────────────────────────────────────────────────────────

function AdminPanel({
  posts,
  accounts,
  isDark,
  onUpdate,
}: {
  posts: SocialMediaPost[];
  accounts: SocialAccount[];
  isDark: boolean;
  onUpdate: () => void;
}) {
  const [tab, setTab] = useState<'add-post' | 'manage-posts' | 'accounts'>('add-post');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add post form state
  const [newPostUrl, setNewPostUrl] = useState('');
  const [newPostPlatform, setNewPostPlatform] = useState('instagram');
  const [newPostCaption, setNewPostCaption] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Accounts form state
  const [accountForms, setAccountForms] = useState<SocialAccount[]>(accounts.length > 0 ? accounts : [
    { platform: 'instagram', username: '', url: '', displayName: '' },
    { platform: 'facebook', username: '', url: '', displayName: '' },
    { platform: 'youtube', username: '', url: '', displayName: '' },
  ]);

  // Update account forms when accounts change
  useEffect(() => {
    if (accounts.length > 0) {
      setAccountForms(accounts);
    }
  }, [accounts]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Add a new post
  const handleAddPost = async () => {
    if (!newPostUrl.trim() || !adminPassword.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postUrl: newPostUrl.trim(),
          platform: newPostPlatform,
          caption: newPostCaption.trim(),
          adminPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('success', 'Post berhasil ditambahkan!');
        setNewPostUrl('');
        setNewPostCaption('');
        onUpdate();
      } else {
        showMessage('error', data.error || 'Gagal menambahkan post');
      }
    } catch {
      showMessage('error', 'Gagal menambahkan post');
    } finally {
      setSaving(false);
    }
  };

  // Delete a post
  const handleDeletePost = async (id: string) => {
    if (!adminPassword.trim()) {
      showMessage('error', 'Masukkan password admin terlebih dahulu');
      return;
    }
    try {
      const res = await fetch('/api/social-media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, adminPassword }),
      });
      if (res.ok) {
        showMessage('success', 'Post berhasil dihapus');
        onUpdate();
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Gagal menghapus post');
      }
    } catch {
      showMessage('error', 'Gagal menghapus post');
    }
  };

  // Toggle pin
  const handleTogglePin = async (post: SocialMediaPost) => {
    if (!adminPassword.trim()) {
      showMessage('error', 'Masukkan password admin terlebih dahulu');
      return;
    }
    try {
      const res = await fetch('/api/social-media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, isPinned: !post.isPinned, adminPassword }),
      });
      if (res.ok) {
        showMessage('success', post.isPinned ? 'Pin dihapus' : 'Post di-pin');
        onUpdate();
      }
    } catch {
      showMessage('error', 'Gagal mengubah pin');
    }
  };

  // Toggle active
  const handleToggleActive = async (post: SocialMediaPost) => {
    if (!adminPassword.trim()) {
      showMessage('error', 'Masukkan password admin terlebih dahulu');
      return;
    }
    try {
      const res = await fetch('/api/social-media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, isActive: !post.isActive, adminPassword }),
      });
      if (res.ok) {
        showMessage('success', post.isActive ? 'Post disembunyikan' : 'Post ditampilkan');
        onUpdate();
      }
    } catch {
      showMessage('error', 'Gagal mengubah status');
    }
  };

  // Move post order
  const handleMovePost = async (post: SocialMediaPost, direction: 'up' | 'down') => {
    if (!adminPassword.trim()) return;
    const currentIndex = posts.findIndex((p) => p.id === post.id);
    const swapWith = direction === 'up' ? posts[currentIndex - 1] : posts[currentIndex + 1];
    if (!swapWith) return;
    try {
      await Promise.all([
        fetch('/api/social-media', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: post.id, sortOrder: swapWith.sortOrder, adminPassword }),
        }),
        fetch('/api/social-media', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: swapWith.id, sortOrder: post.sortOrder, adminPassword }),
        }),
      ]);
      onUpdate();
    } catch {
      showMessage('error', 'Gagal mengubah urutan');
    }
  };

  // Save accounts
  const handleSaveAccounts = async () => {
    if (!adminPassword.trim()) {
      showMessage('error', 'Masukkan password admin terlebih dahulu');
      return;
    }
    setSaving(true);
    try {
      const validAccounts = accountForms.filter((a) => a.url.trim());
      const res = await fetch('/api/social-media/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: validAccounts, adminPassword }),
      });
      if (res.ok) {
        showMessage('success', 'Akun media sosial berhasil disimpan!');
        onUpdate();
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Gagal menyimpan akun');
      }
    } catch {
      showMessage('error', 'Gagal menyimpan akun');
    } finally {
      setSaving(false);
    }
  };

  const adminTabs = [
    { id: 'add-post' as const, label: 'Tambah Post', icon: Plus },
    { id: 'manage-posts' as const, label: 'Kelola Post', icon: GripVertical },
    { id: 'accounts' as const, label: 'Akun Sosmed', icon: Instagram },
  ];

  return (
    <Card className={isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}>
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Admin Password */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Password Admin
          </label>
          <Input
            type="password"
            placeholder="Masukkan password admin..."
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {adminTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5"
              style={{
                background: tab === t.id
                  ? 'linear-gradient(135deg, #833AB4, #E4405F)'
                  : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                color: tab === t.id ? 'white' : 'var(--muted-foreground)',
              }}
            >
              <t.icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Message */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 p-2.5 rounded-lg text-xs"
              style={{
                background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                color: message.type === 'success' ? '#10B981' : '#EF4444',
              }}
            >
              {message.type === 'success' ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab: Add Post */}
        {tab === 'add-post' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Platform
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(PLATFORM_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setNewPostPlatform(key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                    style={{
                      background: newPostPlatform === key ? config.gradient : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      color: newPostPlatform === key ? 'white' : 'var(--muted-foreground)',
                      border: `1px solid ${newPostPlatform === key ? 'transparent' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    }}
                  >
                    <config.icon className="h-3 w-3" />
                    {config.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                URL Post
              </label>
              <Input
                type="url"
                placeholder={PLATFORM_CONFIG[newPostPlatform]?.placeholder || 'Masukkan URL post...'}
                value={newPostUrl}
                onChange={(e) => setNewPostUrl(e.target.value)}
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Contoh: https://www.instagram.com/p/ABC123/
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Caption (opsional)
              </label>
              <Input
                type="text"
                placeholder="Deskripsi singkat post..."
                value={newPostCaption}
                onChange={(e) => setNewPostCaption(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <Button
              onClick={handleAddPost}
              disabled={saving || !newPostUrl.trim() || !adminPassword.trim()}
              className="w-full h-9 text-xs gap-2"
              style={{ background: 'linear-gradient(135deg, #833AB4, #E4405F)' }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Tambah Post
            </Button>
          </div>
        )}

        {/* Tab: Manage Posts */}
        {tab === 'manage-posts' && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {posts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Belum ada post yang ditambahkan</p>
            ) : (
              posts.map((post, index) => {
                const config = PLATFORM_CONFIG[post.platform];
                const Icon = config?.icon || Link2;
                return (
                  <div
                    key={post.id}
                    className="flex items-center gap-2 p-2.5 rounded-lg"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      opacity: post.isActive ? 1 : 0.5,
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: config?.gradient || 'rgba(255,255,255,0.1)' }}
                    >
                      <Icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium truncate">{post.caption || post.postUrl}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {config?.label} {post.isPinned && '• 📌 Di-pin'} {!post.isActive && '• 👁️ Tersembunyi'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {index > 0 && (
                        <button
                          onClick={() => handleMovePost(post, 'up')}
                          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                      )}
                      {index < posts.length - 1 && (
                        <button
                          onClick={() => handleMovePost(post, 'down')}
                          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleTogglePin(post)}
                        className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-yellow-500"
                        title={post.isPinned ? 'Lepas pin' : 'Pin post'}
                      >
                        {post.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={() => handleToggleActive(post)}
                        className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                        title={post.isActive ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {post.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab: Accounts */}
        {tab === 'accounts' && (
          <div className="space-y-3">
            {accountForms.map((account, index) => {
              const config = PLATFORM_CONFIG[account.platform];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div
                  key={account.platform}
                  className="p-3 rounded-lg space-y-2"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                      style={{ background: config.gradient }}
                    >
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-medium">{config.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nama tampilan"
                      value={account.displayName}
                      onChange={(e) => {
                        const updated = [...accountForms];
                        updated[index] = { ...updated[index], displayName: e.target.value };
                        setAccountForms(updated);
                      }}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="Username / Handle"
                      value={account.username}
                      onChange={(e) => {
                        const updated = [...accountForms];
                        updated[index] = { ...updated[index], username: e.target.value };
                        setAccountForms(updated);
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Input
                    placeholder="URL profil (https://...)"
                    value={account.url}
                    onChange={(e) => {
                      const updated = [...accountForms];
                      updated[index] = { ...updated[index], url: e.target.value };
                      setAccountForms(updated);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              );
            })}
            <Button
              onClick={handleSaveAccounts}
              disabled={saving || !adminPassword.trim()}
              className="w-full h-9 text-xs gap-2"
              style={{ background: 'linear-gradient(135deg, #833AB4, #E4405F)' }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Simpan Akun Media Sosial
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
