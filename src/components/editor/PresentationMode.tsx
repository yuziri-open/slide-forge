'use client';

/**
 * PresentationMode.tsx
 * Purpose : Full-screen slideshow overlay for SlideForge.
 * Created : 2026-04-25
 * Author  : Dev-Forge (Forge)
 *
 * Behaviour:
 *  - Full-screen fixed overlay (z-[100], black background)
 *  - Slides rendered via iframe with NO inject script (read-only, no selection)
 *  - Arrow keys / click to navigate; Escape to exit
 *  - Slide counter fades after 2 s of no navigation
 *  - Smooth CSS fade transition between slides
 *  - Cursor auto-hides after 3 s of no mouse movement
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { buildSrcDoc } from '@/lib/html-parser';

/**
 * Build a presentation-safe srcDoc — identical to buildSrcDoc but
 * always passes an empty string for the inject script so no editor
 * bridge code runs inside the iframe.
 */
function buildPresentationSrcDoc(headHtml: string, slideHtml: string): string {
  return buildSrcDoc(headHtml, slideHtml, '');
}

interface PresentationModeProps {
  onClose: () => void;
  /** Initial slide index (defaults to currentSlideIndex from store) */
  startIndex?: number;
}

export default function PresentationMode({ onClose, startIndex }: PresentationModeProps) {
  const slides = useEditorStore((s) => s.slides);
  const headHtml = useEditorStore((s) => s.headHtml);
  const storeIndex = useEditorStore((s) => s.currentSlideIndex);

  const [index, setIndex] = useState(startIndex ?? storeIndex);
  // 'visible' | 'hidden' — controls the counter fade
  const [counterVisible, setCounterVisible] = useState(true);
  // 'in' | 'out' — drives the CSS transition on the iframe wrapper
  const [fadePhase, setFadePhase] = useState<'in' | 'out'>('in');
  // While transitioning we keep the src of the OUTGOING slide so it
  // doesn't flash blank during the fade-out.
  const [displayIndex, setDisplayIndex] = useState(startIndex ?? storeIndex);
  const transitioning = useRef(false);

  // Timers
  const counterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ── Cursor hide/show ──────────────────────────────────────────────
  const showCursor = useCallback(() => {
    if (overlayRef.current) overlayRef.current.style.cursor = 'default';
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = setTimeout(() => {
      if (overlayRef.current) overlayRef.current.style.cursor = 'none';
    }, 3000);
  }, []);

  // ── Counter show/hide ─────────────────────────────────────────────
  const showCounter = useCallback(() => {
    setCounterVisible(true);
    if (counterTimerRef.current) clearTimeout(counterTimerRef.current);
    counterTimerRef.current = setTimeout(() => {
      setCounterVisible(false);
    }, 2000);
  }, []);

  // ── Navigate ──────────────────────────────────────────────────────
  const navigate = useCallback(
    (delta: number) => {
      if (transitioning.current) return;
      const next = index + delta;
      if (next < 0 || next >= slides.length) return;

      transitioning.current = true;
      showCounter();
      showCursor();

      // Phase 1: fade out current
      setFadePhase('out');

      setTimeout(() => {
        // Phase 2: swap to next slide (invisible)
        setIndex(next);
        setDisplayIndex(next);
        setFadePhase('in');
        transitioning.current = false;
      }, 200); // matches CSS transition duration
    },
    [index, slides.length, showCounter, showCursor]
  );

  // ── Keyboard handler ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        navigate(1);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigate(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, onClose]);

  // ── Mouse move ────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = () => showCursor();
    window.addEventListener('mousemove', onMove);
    // Start cursor hide timer immediately
    showCursor();
    return () => window.removeEventListener('mousemove', onMove);
  }, [showCursor]);

  // ── Show counter on mount ─────────────────────────────────────────
  useEffect(() => {
    showCounter();
    return () => {
      if (counterTimerRef.current) clearTimeout(counterTimerRef.current);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, [showCounter]);

  // ── Click to advance ─────────────────────────────────────────────
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore right-click
    if (e.button !== 0) return;
    // If clicking on the left 20% → go back, otherwise → forward
    const x = e.clientX / window.innerWidth;
    navigate(x < 0.2 ? -1 : 1);
  };

  // ── Compute iframe dimensions (16:9 fit) ──────────────────────────
  // We use a CSS approach: a fixed container with aspect-ratio and
  // max dimensions derived from viewport.
  const currentSlide = slides[displayIndex];
  const srcDoc = currentSlide
    ? buildPresentationSrcDoc(headHtml, currentSlide.html)
    : '';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center select-none"
      style={{ background: '#000', cursor: 'none' }}
      onClick={handleClick}
      // Prevent context menu during presentation
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── Slide iframe ── */}
      <div
        style={{
          // Maintain 16:9 inside viewport with padding
          width: 'min(100vw, calc(100vh * 16 / 9))',
          aspectRatio: '16 / 9',
          position: 'relative',
          boxShadow: '0 32px 96px rgba(0,0,0,0.72)',
          borderRadius: 4,
          overflow: 'hidden',
          opacity: fadePhase === 'in' ? 1 : 0,
          transition: 'opacity 200ms ease-in-out',
        }}
      >
        <iframe
          key={displayIndex}
          srcDoc={srcDoc}
          title={`Slide ${displayIndex + 1}`}
          sandbox="allow-same-origin allow-scripts"
          style={{
            border: 'none',
            width: 1280,
            height: 720,
            // Scale the 1280×720 iframe to fill the container exactly
            transform: 'scale(var(--slide-scale, 1))',
            transformOrigin: 'top left',
            position: 'absolute',
            inset: 0,
          }}
          // Compute the scale dynamically via an inline ref callback
          ref={(el) => {
            if (!el) return;
            const parent = el.parentElement;
            if (!parent) return;
            const scaleX = parent.clientWidth / 1280;
            const scaleY = parent.clientHeight / 720;
            const scale = Math.min(scaleX, scaleY);
            el.style.transform = `scale(${scale})`;
          }}
        />
      </div>

      {/* ── Slide counter ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 32,
          color: 'rgba(255,255,255,0.9)',
          fontSize: 13,
          fontFamily: '-apple-system, "SF Pro Text", sans-serif',
          fontWeight: 500,
          letterSpacing: '0.04em',
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 20,
          padding: '6px 14px',
          opacity: counterVisible ? 1 : 0,
          transition: 'opacity 600ms ease',
          pointerEvents: 'none',
          zIndex: 101,
        }}
      >
        {index + 1} / {slides.length}
      </div>

      {/* ── Exit hint (shown on mount, fades with counter) ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: 32,
          color: 'rgba(255,255,255,0.5)',
          fontSize: 11,
          fontFamily: '-apple-system, "SF Pro Text", sans-serif',
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 20,
          padding: '6px 14px',
          opacity: counterVisible ? 1 : 0,
          transition: 'opacity 600ms ease',
          pointerEvents: 'none',
          zIndex: 101,
        }}
      >
        Esc to exit
      </div>
    </div>
  );
}
