'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, User, Sparkles, Trash2, Loader2, Settings, Key, CheckCircle2, AlertCircle, Eye, EyeOff, Wifi, WifiOff, Camera, CameraOff } from 'lucide-react';
import { useFilterStore } from '@/store/filter-store';
import { useQueryClient } from '@tanstack/react-query';
import type { StatsResponse } from '@/hooks/use-fish-farms';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIConfig {
  zai: { available: boolean; model: string; note?: string };
  nara: { configured: boolean; source: string; model: string; keyHint: string | null };
  gemini: { configured: boolean; source: string; model: string; keyHint: string | null };
  groq: { configured: boolean; source: string; model: string; keyHint: string | null };
}

interface AITestResult {
  zai: { available: boolean; testResult: string; latencyMs: number; error: string | null; model?: string };
  nara: { keyFound: boolean; keySource: string; keyHint: string | null; testResult: string; latencyMs: number; error: string | null; model?: string };
  gemini: { keyFound: boolean; keySource: string; keyHint: string | null; testResult: string; latencyMs: number; error: string | null };
  groq: { keyFound: boolean; keySource: string; keyHint: string | null; testResult: string; latencyMs: number; error: string | null };
  dbConnection: { ok: boolean; error: string | null };
  summary: string;
}

const QUICK_PROMPTS = [
  '📊 Ringkasan produksi tahun ini',
  '👥 Daftar kelompok pembudidaya',
  '📈 Kecamatan mana yang produksinya tertinggi?',
  '🐟 Jenis ikan apa yang paling banyak diproduksi?',
  '📉 Bagaimana tren produksi 5 tahun terakhir?',
  '🎯 Berapa jumlah RTP dan kelompok?',
  '🧠 Hapus semua memori AI',
];

// [H-10] `formatContent` has no closure deps on component state, so it lives
// at module scope and is stable across renders (no per-render re-creation).
function formatContent(content: string) {
  // Split by newlines and handle bullet points
  return content.split('\n').map((line, i) => {
    // Bold text
    const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet points
    if (line.trimStart().startsWith('- ') || line.trimStart().startsWith('• ') || line.trimStart().startsWith('* ')) {
      return (
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="shrink-0">•</span>
          <span dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^[\s]*[-•*]\s*/, '') }} />
        </div>
      );
    }
    // Numbered lists
    const numMatch = line.trimStart().match(/^(\d+)\.\s/);
    if (numMatch) {
      return (
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="shrink-0">{numMatch[1]}.</span>
          <span dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^\s*\d+\.\s/, '') }} />
        </div>
      );
    }
    // Empty line = paragraph break
    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }
    return <div key={i} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
  });
}

// [H-10] Message list is extracted to a memoized component so typing in the
// input box (which re-renders AIChatWidget) does NOT re-render the entire
// chat history. The `messages` array reference only changes when a new
// message is added/removed — which is exactly when we want a re-render.
// Stable keys: timestamp is unique per message; index fallback is safe
// because messages are append-only.
const MessageList = memo(function MessageList({ messages }: { messages: Message[] }) {
  return (
    <>
      {messages.map((msg, i) => {
        const key = `${msg.role}-${msg.timestamp.getTime()}-${i}`;
        return (
          <div
            key={key}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div
                className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-1"
                style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
              >
                <Bot className="h-3 w-3 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-br-md'
                  : 'rounded-bl-md'
              }`}
              style={{
                background:
                  msg.role === 'user'
                    ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
                    : 'var(--muted)',
                color: msg.role === 'user' ? 'white' : 'var(--foreground)',
              }}
            >
              {msg.role === 'user' ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <div className="space-y-0.5">{formatContent(msg.content)}</div>
              )}
            </div>
            {msg.role === 'user' && (
              <div
                className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-1"
                style={{ background: 'var(--muted)' }}
              >
                <User className="h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
});

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [configNaraKey, setConfigNaraKey] = useState('');
  const [configGeminiKey, setConfigGeminiKey] = useState('');
  const [configGroqKey, setConfigGroqKey] = useState('');
  const [configPassword, setConfigPassword] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNaraKey, setShowNaraKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<AITestResult | null>(null);
  const [screenshotMode, setScreenshotMode] = useState(false); // 📸 VLM Mode toggle
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🧠 Persistent session ID — stored in localStorage so memories survive across browser sessions
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'default';
    const stored = localStorage.getItem('sipbd-ai-session-id');
    if (stored) return stored;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem('sipbd-ai-session-id', newId);
    return newId;
  });

  // [H-9] Removed the 6 per-slice `useFilterStore((s) => s.X)` subscriptions
  // and the `useFishFarmStats()` subscription. Those values were ONLY used
  // inside the `sendMessage` callback, but each subscription caused
  // AIChatWidget to re-render on every filter change and every stats
  // refetch — which in turn re-rendered the entire chat history.
  // We now read filters via `useFilterStore.getState()` and stats via
  // `queryClient.getQueryData(...)` INSIDE the callback (lazy read).
  const queryClient = useQueryClient();

  // Fetch AI config when panel opens
  const fetchAIConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/config');
      if (res.ok) {
        const data = await res.json();
        setAiConfig(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchAIConfig();
  }, [isOpen, fetchAIConfig]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current && !showConfig) {
      inputRef.current.focus();
    }
  }, [isOpen, showConfig]);

  const saveConfig = async () => {
    setIsSavingConfig(true);
    setConfigMessage(null);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: configPassword,
          naraApiKey: configNaraKey || undefined,
          geminiApiKey: configGeminiKey || undefined,
          groqApiKey: configGroqKey || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigMessage({ type: 'success', text: '✅ Konfigurasi AI berhasil disimpan!' });
        setConfigNaraKey('');
        setConfigGeminiKey('');
        setConfigGroqKey('');
        setConfigPassword('');
        fetchAIConfig();
        // Auto-test after saving
        testAIConnection();
      } else {
        setConfigMessage({ type: 'error', text: `❌ ${data.error || 'Gagal menyimpan'}` });
      }
    } catch {
      setConfigMessage({ type: 'error', text: '❌ Gagal terhubung ke server' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const testAIConnection = async () => {
    setIsTestingAI(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/test');
      if (res.ok) {
        const data = await res.json();
        setTestResult(data.results);
      } else {
        setTestResult({
          zai: { available: false, testResult: 'failed', latencyMs: 0, error: 'Failed to fetch test results' },
          nara: { keyFound: false, keySource: 'none', keyHint: null, testResult: 'failed', latencyMs: 0, error: 'Failed to fetch test results' },
          gemini: { keyFound: false, keySource: 'none', keyHint: null, testResult: 'failed', latencyMs: 0, error: 'Failed to fetch test results' },
          groq: { keyFound: false, keySource: 'none', keyHint: null, testResult: 'failed', latencyMs: 0, error: 'Failed to fetch test results' },
          dbConnection: { ok: false, error: 'Test endpoint failed' },
          summary: 'Test endpoint returned error',
        });
      }
    } catch (err) {
      setTestResult({
        zai: { available: false, testResult: 'failed', latencyMs: 0, error: 'Network error' },
        nara: { keyFound: false, keySource: 'none', keyHint: null, testResult: 'failed', latencyMs: 0, error: 'Network error' },
        gemini: { keyFound: false, keySource: 'none', keyHint: null, testResult: 'failed', latencyMs: 0, error: 'Network error' },
        groq: { keyFound: false, keySource: 'none', keyHint: null, testResult: 'failed', latencyMs: 0, error: 'Network error' },
        dbConnection: { ok: false, error: 'Network error' },
        summary: 'Network error - cannot reach test endpoint',
      });
    } finally {
      setIsTestingAI(false);
    }
  };

  /**
   * 📸 Capture screenshot of current page (excluding the chat widget itself).
   * Uses html2canvas-pro (handles modern CSS like oklch colors).
   * Returns a JPEG data URL compressed to ~70% quality, max 1280px wide.
   *
   * The chat widget is temporarily hidden during capture to avoid recursion.
   */
  const captureScreenshot = async (): Promise<string | null> => {
    try {
      // Dynamic import — html2canvas-pro is heavy, only load when needed
      const html2canvas = (await import('html2canvas-pro')).default;

      // Hide the chat widget container during capture so it doesn't appear in screenshot
      // Find the chat widget's outermost container (the AnimatePresence motion.div parent)
      const chatWidgetEl = document.querySelector('[data-ai-chat-widget]') as HTMLElement | null;

      // Capture the main page content (document.body minus chat widget)
      const target = document.body;

      const canvas = await html2canvas(target, {
        // Skip the chat widget itself + any fixed/overlay UI we don't want
        ignoreElements: (el) => {
          // Skip the chat widget container
          if (chatWidgetEl && (chatWidgetEl.contains(el) || el === chatWidgetEl)) return true;
          // Skip elements explicitly marked
          if (el.dataset && el.dataset.html2canvasIgnore !== undefined) return true;
          return false;
        },
        // Limit max dimensions to keep payload reasonable
        windowWidth: Math.min(window.innerWidth, 1280),
        windowHeight: window.innerHeight,
        scale: window.innerWidth < 768 ? 1 : 1.5, // lower scale on mobile to reduce size
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Compress to JPEG at 70% quality — small enough for API but readable
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      console.log(`[Screenshot] Captured: ${canvas.width}x${canvas.height}, size=${Math.round(dataUrl.length / 1024)}KB`);
      return dataUrl;
    } catch (err) {
      console.error('[Screenshot] Capture failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setScreenshotError(`Gagal capture screenshot: ${errMsg.substring(0, 100)}`);
      // Clear error after 5 seconds
      setTimeout(() => setScreenshotError(null), 5000);
      return null;
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // 📸 If Screenshot Mode is ON, capture the page before sending
    let screenshotDataUrl: string | null = null;
    if (screenshotMode) {
      console.log('[AI Chat] Screenshot mode ON — capturing page...');
      // Show loading indicator immediately, then capture
      // Brief delay so React can render the loading state before html2canvas blocks
      await new Promise(resolve => setTimeout(resolve, 100));
      screenshotDataUrl = await captureScreenshot();
      if (!screenshotDataUrl) {
        // Capture failed — inform user but still send text-only
        const failMsg: Message = {
          role: 'assistant',
          content: '⚠️ **Gagal mengambil screenshot halaman.** Pertanyaan Anda tetap dikirim tanpa screenshot (mode teks). Coba aktifkan kembali Mode Lihat Halaman atau refresh halaman.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, failMsg]);
      }
    }

    try {
      // Build conversation history (last 10 messages)
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // [H-9] Lazy-read filter state + stats cache inside the callback.
      // Reading here (instead of subscribing at the top of the component)
      // means filter changes and stats refetches don't trigger a re-render
      // of the chat widget — we only consult the latest values at the
      // moment the user actually sends a message.
      const filterState = useFilterStore.getState();
      const years = filterState.years;
      const kecamatan = filterState.kecamatan;
      const desa = filterState.desa;
      const fishType = filterState.fishType;
      const containerType = filterState.containerType;
      const businessType = filterState.businessType;
      const stats = queryClient.getQueryData<StatsResponse>([
        'fish-farms-stats',
        years,
        kecamatan,
        desa,
        filterState.groupName,
        fishType,
        containerType,
        businessType,
        filterState.search,
      ]);

      // Build stats context with filter info
      const statsContext = stats
        ? {
            periodLabel: stats.periodLabel,
            currentYear: stats.currentYear,
            pembesaranProduction: stats.pembesaranProduction,
            pembenihanProduction: stats.pembenihanProduction,
            totalRtp: stats.totalRtp,
            totalFarmer: stats.totalFarmer,
            totalGroup: stats.totalGroup,
            totalKusuka: stats.totalKusuka,
            rtpByBusinessType: stats.rtpByBusinessType,
            farmerByBusinessType: stats.farmerByBusinessType,
            productionByFishType: stats.productionByFishType,
            productionByKecamatan: stats.productionByKecamatan,
            productionByContainer: stats.productionByContainer,
            productionByKecamatanDetail: stats.productionByKecamatanDetail,
            productionByFishTypeDetail: stats.productionByFishTypeDetail,
            trend5Year: stats.trend5Year,
            targetVsRealisasiPembesaran: stats.targetVsRealisasiPembesaran,
            targetVsRealisasiPembenihan: stats.targetVsRealisasiPembenihan,
            commodityPrices: stats.commodityPrices,
            activeFilters: {
              years: years.length > 0 ? years : 'Semua tahun',
              kecamatan: kecamatan.length > 0 ? kecamatan : 'Semua kecamatan',
              desa: desa.length > 0 ? desa : 'Semua desa',
              fishType: fishType.length > 0 ? fishType : 'Semua jenis ikan',
              containerType: containerType.length > 0 ? containerType : 'Semua wadah',
              businessType: businessType.length > 0 ? businessType : 'Semua jenis usaha',
            },
          }
        : null;

      // Send filters so the backend can fetch data context server-side
      const filters = {
        years: years.length > 0 ? years : [],
        kecamatan: kecamatan.length > 0 ? kecamatan : [],
        desa: desa.length > 0 ? desa : [],
        fishType: fishType.length > 0 ? fishType : [],
        containerType: containerType.length > 0 ? containerType : [],
        businessType: businessType.length > 0 ? businessType : [],
      };

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          messages: history,
          statsContext,
          filters,
          sessionId,  // 🧠 Session ID for memory persistence
          ...(screenshotDataUrl ? { screenshot: screenshotDataUrl } : {}),  // 📸 VLM mode
        }),
      });

      const data = await response.json();

      if (data.success && data.response) {
        const aiMessage: Message = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        const errorDetail = data.detail || data.error || '';
        // Check if it's a missing API key error
        const isKeyMissing = errorDetail.includes('API Key belum dikonfigurasi') || errorDetail.includes('Z.AI tidak tersedia');
        const isRateLimited = errorDetail.includes('Batas permintaan') || errorDetail.includes('rate');
        const isInvalidKey = errorDetail.includes('API Key tidak valid') || errorDetail.includes('INVALID_API_KEY');
        const errorMessage: Message = {
          role: 'assistant',
          content: isKeyMissing
            ? '⚠️ **Provider AI tidak tersedia.**\n\nZ.AI sedang tidak dapat diakses, dan API key NaraRouter/Gemini/Groq belum dikonfigurasi.\n\nKlik ikon ⚙️ di header chat untuk:\n- Cek status Z.AI\n- Atur API key NaraRouter (https://router.bynara.id — akses Claude & Mistral gratis) / Gemini / Groq sebagai fallback\n\n**Gratis & mudah:**\n- NaraRouter: https://router.bynara.id (Claude Sonnet 4.5, Mistral Large)\n- Gemini: https://aistudio.google.com/apikey\n- Groq: https://console.groq.com'
            : isRateLimited
              ? `⏳ **Batas permintaan tercapai.**\n\n${errorDetail}\n\nTunggu 1-2 menit lalu coba lagi. Gunakan ⚙️ → Test Koneksi untuk diagnose.`
              : isInvalidKey
                ? `🔑 **API Key tidak valid.**\n\n${errorDetail}\n\nPeriksa API key di pengaturan (⚙️). Pastikan key yang dimasukkan benar.`
                : errorDetail
                  ? `Maaf, terjadi kesalahan: ${errorDetail}. Silakan coba lagi. 🙏`
                  : 'Maaf, terjadi kesalahan saat memproses pertanyaan Anda. Silakan coba lagi. 🙏',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);

        // Auto-show config if keys are missing
        if (isKeyMissing) {
          fetchAIConfig();
        }
      }
    } catch (err) {
      console.error('Chat fetch error:', err);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Maaf, koneksi AI sedang bermasalah. Silakan coba lagi dalam beberapa saat. 🙏',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Check if any AI provider is available
  const isAIConfigured = aiConfig?.zai?.available || aiConfig?.nara?.configured || aiConfig?.gemini?.configured || aiConfig?.groq?.configured;

  // [H-10] `formatContent` and the message list rendering have been hoisted
  // out to module scope (see `formatContent` and `MessageList` above). The
  // memoized MessageList only re-renders when the `messages` array reference
  // changes — not on every keystroke.

  // Render test result badge
  const renderTestBadge = (result: 'success' | 'failed' | 'testing' | 'not_tested' | 'empty_response', label: string) => {
    if (result === 'success') return <span className="text-green-600 font-medium">✅ {label} OK</span>;
    if (result === 'failed') return <span className="text-red-600 font-medium">❌ {label} GAGAL</span>;
    if (result === 'testing') return <span className="text-amber-600">⏳ Testing...</span>;
    if (result === 'empty_response') return <span className="text-amber-600">⚠️ {label} kosong</span>;
    return <span className="text-gray-400">⏸ Belum ditest</span>;
  };

  return (
    <div data-ai-chat-widget>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center group"
            style={{
              background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
              boxShadow: '0 4px 20px rgba(6,182,212,0.4)',
            }}
            aria-label="Buka Asisten AI"
          >
            <MessageSquare className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
            {!isAIConfigured && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                <Key className="h-2.5 w-2.5 text-amber-900" />
              </span>
            )}
            {isAIConfigured && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] flex flex-col rounded-2xl overflow-hidden border"
            style={{
              height: 'min(620px, calc(100vh - 120px))',
              background: 'var(--background)',
              borderColor: 'var(--border)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(6,182,212,0.1)',
            }}
          >
            {/* Header */}
            <div
              className="shrink-0 px-4 py-3 flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">Asisten AI Perikanan</div>
                <div className="text-[10px] text-cyan-100">
                  SIPBD · Mempawah · {isAIConfigured ? '✅ AI Aktif' : '⚠️ Belum diatur'}
                </div>
              </div>
              <button
                onClick={() => { setShowConfig(!showConfig); fetchAIConfig(); }}
                className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                title="Pengaturan AI"
              >
                <Settings className="h-3.5 w-3.5 text-white" />
              </button>
              <button
                onClick={clearChat}
                className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                title="Hapus percakapan"
              >
                <Trash2 className="h-3.5 w-3.5 text-white" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                title="Tutup"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>

            {/* Config panel */}
            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto" style={{ background: 'var(--card)' }}>
                    <div className="text-xs font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                      <Key className="h-3.5 w-3.5" /> Konfigurasi AI Provider
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                      Z.AI (chat.z.ai) adalah provider utama — otomatis tersedia, tanpa API key! NaraRouter (akses Claude & Mistral gratis), Gemini, dan Groq sebagai fallback opsional.
                    </p>

                    {/* Status indicators */}
                    <div className="flex gap-2 flex-wrap">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] ${aiConfig?.zai?.available ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {aiConfig?.zai?.available ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        Z.AI {aiConfig?.zai?.available ? '✓' : '✗'} <span className="opacity-60">(primary)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] ${aiConfig?.nara?.configured ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                        {aiConfig?.nara?.configured ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        NaraRouter {aiConfig?.nara?.configured ? '✓' : '✗'}
                        {aiConfig?.nara?.keyHint && <span className="opacity-60">({aiConfig.nara.keyHint})</span>}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] ${aiConfig?.gemini?.configured ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                        {aiConfig?.gemini?.configured ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        Gemini {aiConfig?.gemini?.configured ? '✓' : '✗'}
                        {aiConfig?.gemini?.keyHint && <span className="opacity-60">({aiConfig.gemini.keyHint})</span>}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] ${aiConfig?.groq?.configured ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                        {aiConfig?.groq?.configured ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        Groq {aiConfig?.groq?.configured ? '✓' : '✗'}
                        {aiConfig?.groq?.keyHint && <span className="opacity-60">({aiConfig.groq.keyHint})</span>}
                      </div>
                    </div>

                    {/* NaraRouter Key Input */}
                    <div>
                      <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--foreground)' }}>
                        NaraRouter API Key <span className="opacity-50">(fallback 1 — https://router.bynara.id — Claude & Mistral gratis)</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showNaraKey ? 'text' : 'password'}
                          value={configNaraKey}
                          onChange={(e) => setConfigNaraKey(e.target.value)}
                          placeholder={aiConfig?.nara?.configured ? 'Kosongkan jika tidak ingin mengubah' : 'sk-nry-...'}
                          className="w-full text-[11px] px-3 py-1.5 rounded-lg border pr-8 outline-none focus:ring-1 focus:ring-cyan-400"
                          style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNaraKey(!showNaraKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70"
                        >
                          {showNaraKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Gemini Key Input */}
                    <div>
                      <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--foreground)' }}>
                        Gemini API Key <span className="opacity-50">(fallback 2 — https://aistudio.google.com/apikey)</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showGeminiKey ? 'text' : 'password'}
                          value={configGeminiKey}
                          onChange={(e) => setConfigGeminiKey(e.target.value)}
                          placeholder={aiConfig?.gemini?.configured ? 'Kosongkan jika tidak ingin mengubah' : 'AIzaSy...'}
                          className="w-full text-[11px] px-3 py-1.5 rounded-lg border pr-8 outline-none focus:ring-1 focus:ring-cyan-400"
                          style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowGeminiKey(!showGeminiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70"
                        >
                          {showGeminiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Groq Key Input */}
                    <div>
                      <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--foreground)' }}>
                        Groq API Key <span className="opacity-50">(fallback 3 — https://console.groq.com)</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showGroqKey ? 'text' : 'password'}
                          value={configGroqKey}
                          onChange={(e) => setConfigGroqKey(e.target.value)}
                          placeholder={aiConfig?.groq?.configured ? 'Kosongkan jika tidak ingin mengubah' : 'gsk_...'}
                          className="w-full text-[11px] px-3 py-1.5 rounded-lg border pr-8 outline-none focus:ring-1 focus:ring-cyan-400"
                          style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowGroqKey(!showGroqKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70"
                        >
                          {showGroqKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Admin Password */}
                    <div>
                      <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--foreground)' }}>
                        Password Admin
                      </label>
                      <input
                        type="password"
                        value={configPassword}
                        onChange={(e) => setConfigPassword(e.target.value)}
                        placeholder="Masukkan password admin"
                        className="w-full text-[11px] px-3 py-1.5 rounded-lg border outline-none focus:ring-1 focus:ring-cyan-400"
                        style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                      />
                    </div>

                    {/* Save button */}
                    <button
                      onClick={saveConfig}
                      disabled={isSavingConfig || !configPassword}
                      className="w-full text-[11px] px-3 py-2 rounded-lg text-white font-medium transition-all disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
                    >
                      {isSavingConfig ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan...
                        </span>
                      ) : '💾 Simpan Konfigurasi'}
                    </button>

                    {/* Config message */}
                    {configMessage && (
                      <div className={`text-[10px] px-2 py-1 rounded ${configMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {configMessage.text}
                      </div>
                    )}

                    {/* Test Connection Section */}
                    <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        {testResult?.zai?.testResult === 'success' || testResult?.gemini?.testResult === 'success' || testResult?.groq?.testResult === 'success' ? (
                          <Wifi className="h-3.5 w-3.5 text-green-500" />
                        ) : testResult ? (
                          <WifiOff className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <Wifi className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                        )}
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--foreground)' }}>
                          Diagnosa Koneksi AI
                        </span>
                      </div>

                      <button
                        onClick={testAIConnection}
                        disabled={isTestingAI}
                        className="w-full text-[11px] px-3 py-2 rounded-lg border font-medium transition-all disabled:opacity-40 hover:bg-accent"
                        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      >
                        {isTestingAI ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" /> Testing koneksi...
                          </span>
                        ) : '🔍 Test Koneksi AI'}
                      </button>

                      {/* Test Results */}
                      {testResult && (
                        <div className="mt-2 space-y-1.5 text-[10px]">
                          {/* Summary */}
                          {'summary' in testResult && testResult.summary && (
                            <div className="px-2 py-1.5 rounded bg-cyan-50 text-cyan-700 font-medium">
                              {testResult.summary}
                            </div>
                          )}

                          {/* Z.AI Result */}
                          {'zai' in testResult && testResult.zai && (
                            <div className={`px-2 py-1 rounded ${testResult.zai.testResult === 'success' ? 'bg-green-50 text-green-700' : testResult.zai.available ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
                              {testResult.zai.testResult === 'success'
                                ? `✅ Z.AI OK${testResult.zai.model ? ` (${testResult.zai.model})` : ''} — ${testResult.zai.latencyMs}ms`
                                : testResult.zai.available
                                  ? `❌ Z.AI GAGAL — ${testResult.zai.error?.substring(0, 150) || 'Unknown error'}`
                                  : '⏸ Z.AI tidak tersedia (set ZAI_BASE_URL + ZAI_API_KEY)'
                              }
                            </div>
                          )}

                          {/* NaraRouter Result */}
                          {'nara' in testResult && testResult.nara && (
                            <div className={`px-2 py-1 rounded ${testResult.nara.testResult === 'success' ? 'bg-green-50 text-green-700' : testResult.nara.keyFound ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
                              {testResult.nara.testResult === 'success'
                                ? `✅ NaraRouter OK${testResult.nara.model ? ` (${testResult.nara.model})` : ''} — ${testResult.nara.latencyMs}ms`
                                : testResult.nara.keyFound
                                  ? `❌ NaraRouter GAGAL — ${testResult.nara.error?.substring(0, 150) || 'Unknown error'}`
                                  : '⏸ NaraRouter belum dikonfigurasi (dapatkan key di router.bynara.id)'
                              }
                              {testResult.nara.keyFound && (
                                <span className="opacity-60 ml-1">({testResult.nara.keySource})</span>
                              )}
                            </div>
                          )}

                          {/* DB Connection */}
                          <div className={`px-2 py-1 rounded ${testResult.dbConnection?.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {testResult.dbConnection?.ok ? '✅ Database: Terhubung' : `❌ Database: ${testResult.dbConnection?.error || 'Gagal'}`}
                          </div>

                          {/* Gemini Result */}
                          <div className={`px-2 py-1 rounded ${testResult.gemini.testResult === 'success' ? 'bg-green-50 text-green-700' : testResult.gemini.keyFound ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
                            {renderTestBadge(testResult.gemini.testResult, 'Gemini')}
                            {testResult.gemini.keyFound && (
                              <span className="opacity-60 ml-1">({testResult.gemini.keySource}, {testResult.gemini.latencyMs}ms)</span>
                            )}
                            {testResult.gemini.error && (
                              <div className="mt-0.5 opacity-70 break-all">{testResult.gemini.error.substring(0, 200)}</div>
                            )}
                          </div>

                          {/* Groq Result */}
                          <div className={`px-2 py-1 rounded ${testResult.groq.testResult === 'success' ? 'bg-green-50 text-green-700' : testResult.groq.keyFound ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
                            {renderTestBadge(testResult.groq.testResult, 'Groq')}
                            {testResult.groq.keyFound && (
                              <span className="opacity-60 ml-1">({testResult.groq.keySource}, {testResult.groq.latencyMs}ms)</span>
                            )}
                            {testResult.groq.error && (
                              <div className="mt-0.5 opacity-70 break-all">{testResult.groq.error.substring(0, 200)}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
              {/* Welcome message */}
              {messages.length === 0 && (
                <div className="text-center py-4">
                  <div
                    className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
                  >
                    <Bot className="h-7 w-7 text-white" />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Halo! Saya Asisten AI 👋
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    Tanyakan tentang data perikanan budidaya, kelompok, pembudidaya, dan produksi di Kab. Mempawah
                  </p>

                  {isAIConfigured && (
                    <div className="mt-3 p-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-[10px]">
                      ✅ AI aktif — {aiConfig?.zai?.available ? 'Z.AI (primary)' : aiConfig?.gemini?.configured ? 'Gemini' : 'Groq'}
                    </div>
                  )}
                  {!isAIConfigured && (
                    <div className="mt-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px]">
                      ⚠️ Provider AI belum tersedia. Klik ⚙️ di atas untuk mengatur API key (NaraRouter/Gemini/Groq) sebagai fallback.
                    </div>
                  )}

                  {/* Quick prompts */}
                  <div className="mt-4 space-y-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors hover:bg-accent"
                        style={{
                          borderColor: 'var(--border)',
                          color: 'var(--muted-foreground)',
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat messages — [H-10] extracted to memoized <MessageList> */}
              <MessageList messages={messages} />

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
                  >
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                  <div
                    className="rounded-2xl rounded-bl-md px-4 py-3"
                    style={{ background: 'var(--muted)' }}
                  >
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" style={{ color: '#06B6D4' }} />
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Sedang berpikir...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div
              className="shrink-0 p-3 border-t"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              {/* 📸 Screenshot mode indicator */}
              {screenshotMode && (
                <div
                  className="mb-2 px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px]"
                  style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06B6D4' }}
                >
                  <Camera className="h-3 w-3" />
                  <span className="flex-1">📸 Mode Lihat Halaman AKTIF — AI akan melihat screenshot halaman ini</span>
                </div>
              )}
              {/* Screenshot error (auto-dismiss) */}
              {screenshotError && (
                <div
                  className="mb-2 px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px]"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
                >
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span className="flex-1 truncate">{screenshotError}</span>
                </div>
              )}
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 border"
                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={screenshotMode ? "AI bisa lihat halaman ini — tanyakan apa saja..." : "Tanyakan tentang kelompok, produksi, RTP..."}
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  style={{ color: 'var(--foreground)' }}
                  disabled={isLoading}
                />
                {/* 📸 Toggle Screenshot Mode button */}
                <button
                  onClick={() => setScreenshotMode(prev => !prev)}
                  disabled={isLoading}
                  title={screenshotMode ? "Nonaktifkan Mode Lihat Halaman" : "Aktifkan Mode Lihat Halaman (AI bisa melihat screenshot halaman)"}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 disabled:opacity-30"
                  style={{
                    background: screenshotMode ? 'linear-gradient(135deg, #06B6D4, #0891B2)' : 'var(--muted)',
                  }}
                >
                  {screenshotMode ? (
                    <Camera className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <CameraOff className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                  )}
                </button>
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 disabled:opacity-30"
                  style={{
                    background: input.trim() ? 'linear-gradient(135deg, #06B6D4, #0891B2)' : 'var(--muted)',
                  }}
                >
                  <Send className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
              <div className="text-[9px] text-center mt-1.5" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
                {screenshotMode
                  ? '📸 Screenshot halaman aktif akan dikirim · Vision mode lebih lambat (3-5s)'
                  : 'Data dari filter aktif · AI bisa membuat kesalahan'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
