'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { IFRAME_INJECT_SCRIPT } from '@/lib/iframe-inject';
import { buildSrcDoc } from '@/lib/html-parser';
import { setIframeSender } from '@/lib/iframe-bridge';

export default function Canvas() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    slides, currentSlideIndex, headHtml, zoom,
    setSelectedElement, setMultiSelect, setZoom, updateSlideHtml, setClipboard,
  } = useEditorStore();

  const currentSlide = slides[currentSlideIndex];

  // Build srcDoc only when slide index changes (not on every HTML update)
  const [srcDoc, setSrcDoc] = useState('');
  const prevSlideIndexRef = useRef<number>(-1);
  const historyIndex = useEditorStore((s) => s.historyIndex);
  const prevHistoryIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!currentSlide) return;
    if (prevSlideIndexRef.current !== currentSlideIndex) {
      prevSlideIndexRef.current = currentSlideIndex;
      prevHistoryIndexRef.current = historyIndex;
      setSrcDoc(buildSrcDoc(headHtml, currentSlide.html, IFRAME_INJECT_SCRIPT));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlideIndex, headHtml]);

  // Reload srcDoc on undo/redo (historyIndex changes without slideIndex changing)
  useEffect(() => {
    if (!currentSlide) return;
    if (prevHistoryIndexRef.current !== -1 && prevHistoryIndexRef.current !== historyIndex) {
      setSrcDoc(buildSrcDoc(headHtml, currentSlide.html, IFRAME_INJECT_SCRIPT));
    }
    prevHistoryIndexRef.current = historyIndex;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIndex]);

  // Also load on initial render
  useEffect(() => {
    if (!currentSlide || srcDoc) return;
    setSrcDoc(buildSrcDoc(headHtml, currentSlide.html, IFRAME_INJECT_SCRIPT));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      const data = e.data || {};
      const { type } = data;

      if (type === 'element-selected') {
        setSelectedElement({
          xpath: data.xpath,
          tagName: data.tagName,
          textContent: data.textContent,
          computedStyles: data.computedStyles,
          rect: data.rect,
          isGroup: data.isGroup ?? false,
          groupChildCount: data.groupChildCount ?? 0,
          isLocked: data.isLocked ?? false,
        });
        setMultiSelect([]);
      }

      if (type === 'multi-select') {
        setSelectedElement(null);
        setMultiSelect(data.xpaths ?? []);
      }

      if (type === 'selection-cleared') {
        setSelectedElement(null);
        setMultiSelect([]);
      }

      if (type === 'dom-updated') {
        updateSlideHtml(currentSlideIndex, data.outerHtml);
      }

      if (type === 'clipboard-updated') {
        setClipboard(data.htmls ?? []);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentSlideIndex, setSelectedElement, setMultiSelect, updateSlideHtml, setClipboard]);

  const slideWidth = 1280;
  const slideHeight = 720;
  const scaledWidth = slideWidth * zoom;
  const scaledHeight = slideHeight * zoom;

  const sendToIframe = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  // Register sender in module-level bridge so Toolbar can call it
  useEffect(() => {
    setIframeSender(sendToIframe);
    return () => setIframeSender(null);
  }, [sendToIframe]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto flex items-center justify-center p-8"
      style={{ background: 'radial-gradient(circle at top left, rgba(0,122,255,0.08), transparent 28%), linear-gradient(180deg, #f7f7fa 0%, #f0f0f5 100%)' }}
      onClick={(e) => {
        if (e.target === containerRef.current) {
          setSelectedElement(null);
          setMultiSelect([]);
          sendToIframe({ type: 'clear-selection' });
        }
      }}
    >
      <div
        className="relative"
        style={{ width: scaledWidth, height: scaledHeight, filter: 'drop-shadow(0 24px 60px rgba(15,23,42,0.12))' }}
      >
        {srcDoc && (
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            className="absolute inset-0"
            style={{
              width: slideWidth,
              height: slideHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              border: 'none',
              background: 'transparent',
            }}
            sandbox="allow-scripts allow-same-origin"
            title={`Slide ${currentSlideIndex + 1}`}
          />
        )}

        {!currentSlide && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-gray-400">
            スライドがありません
          </div>
        )}
      </div>
    </div>
  );
}
