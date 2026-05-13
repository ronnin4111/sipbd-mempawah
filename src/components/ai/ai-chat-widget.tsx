'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, User, Sparkles, Trash2, Loader2 } from 'lucide-react';
import { useFilterStore } from '@/store/filter-store';
import { useFishFarmStats } from '@/hooks/use-fish-farms';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  // Get current filter state for context
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);

  // Get stats data for AI context
  const { data: stats } = useFishFarmStats();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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

    try {
      // Build conversation history (last 10 messages)
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

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
        const errorMessage: Message = {
          role: 'assistant',
          content: errorDetail
            ? `Maaf, terjadi kesalahan: ${errorDetail}. Silakan coba lagi. 🙏`
            : 'Maaf, terjadi kesalahan saat memproses pertanyaan Anda. Silakan coba lagi. 🙏',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
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

  // Format message content with simple markdown-like rendering
  const formatContent = (content: string) => {
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
  };

  return (
    <>
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
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
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
                <div className="text-[10px] text-cyan-100">SIPBD · Data Mempawah</div>
              </div>
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

              {/* Chat messages */}
              {messages.map((msg, i) => (
                <div
                  key={i}
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
              ))}

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
                  placeholder="Tanyakan tentang kelompok, produksi, RTP..."
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  style={{ color: 'var(--foreground)' }}
                  disabled={isLoading}
                />
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
                Data dari filter aktif · AI bisa membuat kesalahan
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
