'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw, Crop, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ImageCropModalProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedBase64: string) => void;
  accentColor?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const CROP_SIZE = 240; // crop area diameter in px (canvas display)
const OUTPUT_SIZE = 400; // output image size in px
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const MAX_OUTPUT_BYTES = 1 * 1024 * 1024; // 1MB

// ─── Component ──────────────────────────────────────────────────────────────
export function ImageCropModal({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  accentColor = '#10B981',
}: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 320, h: 320 });
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const lastTouchDistRef = useRef(0);

  // ─── Load image when modal opens ─────────────────────────────────────────
  useEffect(() => {
    if (!open || !imageSrc) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
    };
    img.src = imageSrc;
  }, [open, imageSrc]);

  // ─── Calculate canvas size based on container ────────────────────────────
  useEffect(() => {
    if (!open) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const size = Math.min(rect.width, 400);
        setCanvasSize({ w: size, h: size });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [open]);

  // ─── Draw canvas ─────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !open) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvasSize.w;
    const ch = canvasSize.h;
    canvas.width = cw;
    canvas.height = ch;

    // Clear
    ctx.clearRect(0, 0, cw, ch);

    // Calculate image dimensions to cover the crop circle
    const cropRadius = Math.min(cw, ch) / 2 - 20;
    const cropCenterX = cw / 2;
    const cropCenterY = ch / 2;

    // Scale image so the smaller dimension fits the crop diameter
    const baseScale = (cropRadius * 2) / Math.min(img.width, img.height);
    const scale = baseScale * zoom;

    const drawW = img.width * scale;
    const drawH = img.height * scale;

    // Center the image with offset
    const drawX = cropCenterX - drawW / 2 + offset.x;
    const drawY = cropCenterY - drawH / 2 + offset.y;

    // Draw image
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Draw dark overlay outside circle
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.arc(cropCenterX, cropCenterY, cropRadius, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();

    // Draw circle border
    ctx.save();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cropCenterX, cropCenterY, cropRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Draw crosshair guides
    ctx.save();
    ctx.strokeStyle = `${accentColor}40`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    // Horizontal
    ctx.beginPath();
    ctx.moveTo(cropCenterX - cropRadius, cropCenterY);
    ctx.lineTo(cropCenterX + cropRadius, cropCenterY);
    ctx.stroke();
    // Vertical
    ctx.beginPath();
    ctx.moveTo(cropCenterX, cropCenterY - cropRadius);
    ctx.lineTo(cropCenterX, cropCenterY + cropRadius);
    ctx.stroke();
    ctx.restore();
  }, [open, canvasSize, zoom, offset, accentColor]);

  useEffect(() => {
    if (open && imgRef.current) {
      drawCanvas();
    }
  }, [drawCanvas, open]);

  // Also redraw when image finishes loading
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      if (imgRef.current?.complete) {
        drawCanvas();
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [open, drawCanvas]);

  // ─── Mouse drag handlers ─────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: dragStartRef.current.ox + dx,
      y: dragStartRef.current.oy + dy,
    });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ─── Touch pinch zoom ────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = dist - lastTouchDistRef.current;
      lastTouchDistRef.current = dist;

      const zoomDelta = delta * 0.005;
      setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + zoomDelta)));
    }
  }, []);

  // ─── Mouse wheel zoom ────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  // ─── Reset ───────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // ─── Crop & Compress ─────────────────────────────────────────────────────
  const handleCrop = useCallback(async () => {
    const img = imgRef.current;
    if (!img) return;

    setIsCropping(true);

    try {
      // Use requestAnimationFrame to ensure UI updates
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = OUTPUT_SIZE;
      cropCanvas.height = OUTPUT_SIZE;
      const ctx = cropCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Circular clip
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Calculate image drawing dimensions (same logic as display canvas)
      const displayCropRadius = Math.min(canvasSize.w, canvasSize.h) / 2 - 20;
      const baseScale = (displayCropRadius * 2) / Math.min(img.width, img.height);
      const scale = baseScale * zoom;

      const drawW = img.width * scale;
      const drawH = img.height * scale;

      // Map from display coords to output coords
      const displayCropCenterX = canvasSize.w / 2;
      const displayCropCenterY = canvasSize.h / 2;

      // The offset from display crop center
      const imgCenterOffsetX = offset.x;
      const imgCenterOffsetY = offset.y;

      // In display coords, the image top-left relative to crop center is:
      // (imgCenterOffsetX - drawW/2, imgCenterOffsetY - drawH/2)
      // The crop center in display is (displayCropCenterX, displayCropCenterY)
      // The crop radius in display is displayCropRadius

      // Scale factor from display to output
      const outputScale = (OUTPUT_SIZE / 2) / displayCropRadius;

      // Image top-left in output coords
      const outX = OUTPUT_SIZE / 2 + (imgCenterOffsetX - drawW / 2) * outputScale;
      const outY = OUTPUT_SIZE / 2 + (imgCenterOffsetY - drawH / 2) * outputScale;
      const outW = drawW * outputScale;
      const outH = drawH * outputScale;

      ctx.drawImage(img, outX, outY, outW, outH);

      // Auto-compress to fit under 1MB
      let quality = 0.92;
      let result = cropCanvas.toDataURL('image/jpeg', quality);

      while (result.length > MAX_OUTPUT_BYTES && quality > 0.1) {
        quality -= 0.08;
        result = cropCanvas.toDataURL('image/jpeg', quality);
      }

      // If still too large, reduce output size
      if (result.length > MAX_OUTPUT_BYTES) {
        const reducedSize = Math.floor(OUTPUT_SIZE * 0.7);
        cropCanvas.width = reducedSize;
        cropCanvas.height = reducedSize;
        const ctx2 = cropCanvas.getContext('2d');
        if (ctx2) {
          ctx2.beginPath();
          ctx2.arc(reducedSize / 2, reducedSize / 2, reducedSize / 2, 0, Math.PI * 2);
          ctx2.closePath();
          ctx2.clip();

          const ratio = reducedSize / OUTPUT_SIZE;
          ctx2.drawImage(img, outX * ratio, outY * ratio, outW * ratio, outH * ratio);

          quality = 0.85;
          result = cropCanvas.toDataURL('image/jpeg', quality);
          while (result.length > MAX_OUTPUT_BYTES && quality > 0.1) {
            quality -= 0.1;
            result = cropCanvas.toDataURL('image/jpeg', quality);
          }
        }
      }

      onCropComplete(result);
    } catch (err) {
      console.error('Crop error:', err);
    } finally {
      setIsCropping(false);
    }
  }, [zoom, offset, canvasSize, onCropComplete]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md rounded-2xl overflow-hidden"
          style={{
            background: 'var(--background)',
            border: `1px solid ${accentColor}30`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${accentColor}10`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 pb-2">
            <h3 className="font-bold text-base" style={{ fontFamily: 'Syne, sans-serif' }}>
              Crop Foto Profil
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground px-4 mb-3">
            Seret gambar untuk memposisikan wajah di tengah area bulat
          </p>

          {/* Canvas Area */}
          <div ref={containerRef} className="flex justify-center px-4">
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              className="rounded-xl cursor-grab active:cursor-grabbing touch-none"
              style={{
                width: canvasSize.w,
                height: canvasSize.h,
                maxWidth: '100%',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onWheel={handleWheel}
            />
          </div>

          {/* Zoom Controls */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
              <Slider
                value={[zoom]}
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                onValueChange={([v]) => setZoom(v)}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
              <span
                className="text-xs font-mono font-medium min-w-[40px] text-right"
                style={{ color: accentColor }}
              >
                {zoom.toFixed(1)}x
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 p-4 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-xs shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleCrop}
              disabled={isCropping}
              className="gap-1.5 text-xs"
              style={{ background: accentColor }}
            >
              {isCropping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crop className="h-3.5 w-3.5" />
              )}
              {isCropping ? 'Memproses...' : 'Crop & Simpan'}
            </Button>
          </div>

          {/* Size hint */}
          <div className="px-4 pb-3">
            <p className="text-[10px] text-muted-foreground text-center">
              Hasil crop akan dikompresi otomatis jika melebihi 1MB
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
