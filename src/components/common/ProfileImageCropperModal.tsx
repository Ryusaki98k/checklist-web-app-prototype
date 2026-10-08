"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  X,
  Upload,
  AlertCircle,
  Crop,
} from "lucide-react";

interface ProfileImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob, previewUrl: string) => void;
}

export function ProfileImageCropperModal({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
}: ProfileImageCropperModalProps) {
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when a new image is loaded
  useEffect(() => {
    if (isOpen && imageSrc) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setErrorMsg(null);
    }
  }, [isOpen, imageSrc]);

  // Load natural dimensions of image
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Drag handlers using Pointer Events (compatible with mouse, touch, and stylus)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.08 : -0.08;
    setScale((prev) => Math.min(3, Math.max(0.5, Number((prev + zoomFactor).toFixed(2)))));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleConfirmCrop = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const container = containerRef.current;
      const img = imgRef.current;

      const containerRect = container.getBoundingClientRect();
      const outputSize = 400; // 400x400 high-res 1:1 output

      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("ไม่สามารถสร้าง Canvas สำหรับตัดรูปภาพได้");
      }

      // Fill canvas background with white
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outputSize, outputSize);

      // Calculations relative to crop circle
      const scaleRatio = outputSize / containerRect.width;

      // Current visible image dimensions inside container
      const currentImgWidth = containerRect.width * scale;
      const currentImgHeight = (containerRect.width * (naturalSize.height / (naturalSize.width || 1))) * scale;

      // Image center offset from container center
      const centerX = outputSize / 2 + position.x * scaleRatio;
      const centerY = outputSize / 2 + position.y * scaleRatio;

      const drawWidth = currentImgWidth * scaleRatio;
      const drawHeight = currentImgHeight * scaleRatio;

      ctx.save();
      ctx.drawImage(
        img,
        centerX - drawWidth / 2,
        centerY - drawHeight / 2,
        drawWidth,
        drawHeight
      );
      ctx.restore();

      canvas.toBlob(
        (blob) => {
          setIsProcessing(false);
          if (!blob) {
            setErrorMsg("เกิดข้อผิดพลาดในการประมวลผลไฟล์รูปภาพ");
            return;
          }
          const previewUrl = URL.createObjectURL(blob);
          onCropComplete(blob, previewUrl);
          onClose();
        },
        "image/webp",
        0.92
      );
    } catch (err: any) {
      console.error("Crop error:", err);
      setIsProcessing(false);
      setErrorMsg(err?.message || "ตัดรูปภาพไม่สำเร็จ");
    }
  }, [naturalSize, onCropComplete, onClose, position.x, position.y, scale]);

  if (!isOpen || !imageSrc || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex min-h-screen items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="เครื่องมือตัดรูปโปรไฟล์ 1:1"
    >
      <div
        className="relative w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl p-6 sm:p-7 space-y-6 flex flex-col max-h-[92vh] overflow-y-auto my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Crop size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--color-text)] tracking-tight">
                ปรับแต่งรูปโปรไฟล์ (อัตราส่วน 1:1)
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                ลากรูปเพื่อจัดตำแหน่ง หรือหมุน/ซูมเพื่อให้พอดีกับกรอบ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
            title="ปิด"
            aria-label="ปิดหน้าต่าง"
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2.5">
            <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Interactive Cropping Viewport */}
        <div className="flex flex-col items-center justify-center space-y-3 py-2">
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden shadow-inner border-4 border-amber-500/60 dark:border-amber-400/50 bg-black/80 cursor-grab active:cursor-grabbing select-none touch-none ring-8 ring-amber-500/10"
            title="ลากเพื่อเลื่อนตำแหน่งรูปภาพ"
          >
            {/* The Image being moved and scaled */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="พรีวิวรูปโปรไฟล์"
              onLoad={onImageLoad}
              draggable={false}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.05s ease-out",
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                pointerEvents: "none",
              }}
              className="absolute inset-0 m-auto select-none"
            />

            {/* Circular Vignette Overlay Guide */}
            <div className="absolute inset-0 pointer-events-none rounded-full border border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
          </div>

          <p className="text-[11px] text-[var(--color-text-muted)] font-medium text-center">
            💡 คลิกแล้วลากเพื่อปรับมุมมอง • เลื่อนลูกกลิ้งเมาส์หรือใช้แถบเลื่อนเพื่อซูม
          </p>
        </div>

        {/* Zoom & Alignment Controls */}
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text)]">
            <span className="flex items-center gap-1.5">
              <ZoomIn size={14} className="text-amber-600 dark:text-amber-400" />
              การซูมรูปภาพ:
            </span>
            <span className="font-mono bg-[var(--color-surface)] px-2 py-0.5 rounded-lg border border-[var(--color-border)] text-amber-700 dark:text-amber-300">
              {Math.round(scale * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setScale((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))))}
              className="p-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text)] transition-colors cursor-pointer shadow-2xs"
              title="ย่อขนาด"
            >
              <ZoomOut size={16} />
            </button>

            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="flex-1 accent-amber-500 cursor-pointer h-2 bg-[var(--color-border)] rounded-lg"
              aria-label="แถบเลื่อนซูมรูปภาพ"
            />

            <button
              type="button"
              onClick={() => setScale((prev) => Math.min(3, Number((prev + 0.1).toFixed(2))))}
              className="p-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text)] transition-colors cursor-pointer shadow-2xs"
              title="ขยายขนาด"
            >
              <ZoomIn size={16} />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text)] transition-colors cursor-pointer shadow-2xs ml-1"
              title="รีเซ็ตตำแหน่งและขนาด"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all cursor-pointer min-h-[42px]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleConfirmCrop}
            className="px-6 py-2.5 rounded-2xl bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-100 text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-2 min-h-[42px] disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>กำลังบันทึกรูป...</span>
              </>
            ) : (
              <>
                <Check size={18} strokeWidth={2.5} />
                <span>ยืนยันรูปภาพ 1:1</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
