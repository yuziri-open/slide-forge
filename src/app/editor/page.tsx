'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/store/editor-store';
import Toolbar from '@/components/editor/Toolbar';
import SlideNavigator from '@/components/editor/SlideNavigator';
import Canvas from '@/components/editor/Canvas';
import PropertyPanel from '@/components/editor/PropertyPanel';
import { sendToIframe } from '@/lib/iframe-bridge';

// 自動保存のデバウンス間隔（ミリ秒）
const AUTO_SAVE_DELAY_MS = 30_000;

export default function EditorPage() {
  const router = useRouter();
  const slides = useEditorStore((s) => s.slides);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const currentSlideIndex = useEditorStore((s) => s.currentSlideIndex);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const clipboard = useEditorStore((s) => s.clipboard);
  const projectId = useEditorStore((s) => s.projectId);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const saveToCloud = useEditorStore((s) => s.saveToCloud);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 自動保存: slides が変化したとき、projectId がある場合のみ30秒後に保存
  useEffect(() => {
    const gasApiUrl = process.env.NEXT_PUBLIC_GAS_SLIDE_API || '';
    if (!gasApiUrl || !projectId) return;

    // 既存タイマーをキャンセル
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveToCloud().catch((err) => {
        console.warn('[EditorPage] auto-save failed:', err);
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, projectId]);

  useEffect(() => {
    if (slides.length === 0) router.push('/');
  }, [slides.length, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;

      if (isCtrl && (e.shiftKey && e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      if (isCtrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      if (isCtrl && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        sendToIframe({ type: e.shiftKey ? 'ungroup-selected' : 'group-selected' });
        return;
      }

      if (isTyping) return;

      if (isCtrl && e.key === 'c') {
        if (clipboard) {
          sendToIframe({ type: 'set-clipboard', htmls: clipboard });
        }
        return;
      }

      if (isCtrl && e.key === 'x') {
        sendToIframe({ type: 'cut-selection' });
        return;
      }

      if (isCtrl && e.key === 'v') {
        if (clipboard && clipboard.length > 0) {
          sendToIframe({ type: 'paste-clipboard', htmls: clipboard });
        }
        return;
      }

      if (isCtrl && e.key === 'd') {
        e.preventDefault();
        sendToIframe({ type: 'duplicate-element' });
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        sendToIframe({ type: 'delete-element' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, clipboard]);

  if (slides.length === 0) return null;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(circle at top left, rgba(0,122,255,0.08), transparent 26%), linear-gradient(180deg, #f7f7fa 0%, #f0f0f5 100%)' }}
    >
      <Toolbar />
      <div className="flex-1 flex overflow-hidden min-h-0 gap-2 px-2 pb-2">
        <SlideNavigator />
        <Canvas />
        <PropertyPanel />
      </div>
      <footer
        className="h-8 flex items-center px-4 gap-6 flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.9)', borderTop: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(16px)' }}
      >
        <span className="text-xs text-[#86868b]">
          スライド {currentSlideIndex + 1} / {slides.length}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#86868b]">ズーム:</span>
          <input
            type="range"
            min={25}
            max={150}
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(parseInt(e.target.value, 10) / 100)}
            className="w-20 sf-range"
          />
          <span className="text-xs text-[#86868b] w-10">{Math.round(zoom * 100)}%</span>
        </div>
        {lastSavedAt && (
          <span className="text-xs text-[#86868b]">
            保存済み: {new Date(lastSavedAt).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span className="text-xs text-[#86868b] ml-auto">
          Ctrl+Z/Y: 戻る/やり直し | Ctrl+C/X/V: コピー/カット/ペースト | Delete: 削除 | Ctrl+D: 複製 | Ctrl+G: グループ化
        </span>
      </footer>
    </div>
  );
}
