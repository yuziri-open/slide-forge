'use client';

import { useEditorStore } from '@/store/editor-store';
import { buildThumbnailSrcDoc } from '@/lib/html-parser';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

/**
 * SlideNavigator — sidebar thumbnail list with native HTML5 drag-and-drop reordering.
 *
 * Drag mechanics:
 *  - draggable={true} on each slide wrapper
 *  - onDragStart  → record the dragged index in a ref
 *  - onDragOver   → compute the drop position (before / after each item) and
 *                   store it as dropIndicatorIndex (0 = before first, n = after last)
 *  - onDrop       → call reorderSlides(from, to) converting indicator position to
 *                   a final array index
 *  - onDragEnd    → reset all drag state
 *
 * Visual cues:
 *  - Dragged thumbnail: opacity 0.4
 *  - Drop indicator: 2px #007AFF horizontal line rendered between/around slides
 *  - cursor: grab on hover, grabbing while dragging
 *  - Hover action buttons (duplicate / delete) hidden while any drag is active
 */
export default function SlideNavigator() {
  const {
    slides,
    headHtml,
    currentSlideIndex,
    setCurrentSlide,
    addSlide,
    deleteSlide,
    reorderSlides,
  } = useEditorStore();

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Index of the slide being dragged (-1 = none)
  const dragIndexRef = useRef<number>(-1);

  // dropIndicatorIndex: 0 means "before slide 0", 1 means "before slide 1" …
  // slides.length means "after the last slide"
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);

  // Whether any drag is currently in progress (suppress hover buttons)
  const [isDragging, setIsDragging] = useState(false);

  // ─── Drag handlers ───────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, index: number) {
    dragIndexRef.current = index;
    setIsDragging(true);
    // Required for Firefox
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Determine whether the pointer is in the top or bottom half of this item
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const indicator = e.clientY < midY ? index : index + 1;
    setDropIndicatorIndex(indicator);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === -1 || dropIndicatorIndex === null) return;

    // Convert indicator position to target array index.
    // The indicator says "insert before position N in the current array".
    // After removing `from`, the effective insertion index shifts when from < N.
    let to: number;
    if (dropIndicatorIndex <= from) {
      to = dropIndicatorIndex;
    } else {
      // indicator is after `from`, so once `from` is removed the slot shifts left
      to = dropIndicatorIndex - 1;
    }

    resetDragState();
    reorderSlides(from, to);
  }

  function handleDragEnd() {
    resetDragState();
  }

  function resetDragState() {
    dragIndexRef.current = -1;
    setDropIndicatorIndex(null);
    setIsDragging(false);
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="sf-panel w-48 flex flex-col overflow-hidden flex-shrink-0 m-2 mr-0">
      {/* Header */}
      <div
        className="p-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
      >
        <span className="text-xs font-medium text-[#1d1d1f]">スライド</span>
        <span className="text-xs text-[#86868b]">{slides.length}枚</span>
      </div>

      {/* Slide list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {slides.map((slide, index) => {
          const active = currentSlideIndex === index;
          const hovered = hoveredIndex === index;
          const beingDragged = isDragging && dragIndexRef.current === index;

          return (
            <div key={slide.id}>
              {/* Drop indicator ABOVE this slide */}
              {dropIndicatorIndex === index && (
                <div
                  style={{
                    height: 2,
                    background: '#007AFF',
                    borderRadius: 1,
                    margin: '2px 0',
                    boxShadow: '0 0 4px rgba(0,122,255,0.6)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Slide item wrapper — draggable */}
              <div
                className="relative mb-2"
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onMouseEnter={() => !isDragging && setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  opacity: beingDragged ? 0.4 : 1,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  transition: 'opacity 0.15s ease',
                  userSelect: 'none',
                }}
              >
                {/* Thumbnail button */}
                <button
                  onClick={() => !isDragging && setCurrentSlide(index)}
                  draggable={false}
                  className="w-full relative rounded-2xl overflow-hidden transition-all duration-200"
                  style={
                    active
                      ? {
                          border: '1px solid rgba(0,122,255,0.3)',
                          boxShadow:
                            '0 0 0 2px rgba(0,122,255,0.24), 0 10px 24px rgba(0,122,255,0.12)',
                        }
                      : {
                          border: '1px solid rgba(0,0,0,0.06)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        }
                  }
                >
                  <div className="relative bg-white" style={{ paddingBottom: '56.25%' }}>
                    <div className="absolute inset-0 overflow-hidden bg-white">
                      <iframe
                        srcDoc={buildThumbnailSrcDoc(headHtml, slide.html)}
                        style={{
                          width: 1280,
                          height: 720,
                          transform: 'scale(0.137)',
                          transformOrigin: 'top left',
                          border: 'none',
                          pointerEvents: 'none',
                        }}
                        sandbox="allow-scripts allow-same-origin"
                        title={`Thumbnail ${index + 1}`}
                      />
                    </div>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 py-1 text-center text-[11px] font-medium"
                    style={
                      active
                        ? { background: 'rgba(0,122,255,0.1)', color: '#007AFF' }
                        : { background: 'rgba(255,255,255,0.92)', color: '#86868b' }
                    }
                  >
                    {index + 1}
                  </div>
                </button>

                {/* Hover action buttons — hidden while dragging */}
                {hovered && !isDragging && (
                  <div className="absolute top-1.5 right-1.5 flex gap-1 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addSlide(slide.html);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
                      style={{
                        background: 'rgba(0,122,255,0.9)',
                        boxShadow: '0 2px 8px rgba(0,122,255,0.3)',
                        cursor: 'pointer',
                      }}
                      title="スライドを複製"
                    >
                      <Copy className="w-3 h-3 text-white" />
                    </button>
                    {slides.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSlide(index);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
                        style={{
                          background: 'rgba(255,59,48,0.9)',
                          boxShadow: '0 2px 8px rgba(255,59,48,0.3)',
                          cursor: 'pointer',
                        }}
                        title="スライドを削除"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Drop indicator at the very end of the list */}
        {dropIndicatorIndex === slides.length && (
          <div
            style={{
              height: 2,
              background: '#007AFF',
              borderRadius: 1,
              margin: '2px 0',
              boxShadow: '0 0 4px rgba(0,122,255,0.6)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Add slide button */}
      <div
        className="p-2 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
      >
        <button
          onClick={() => addSlide()}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs transition-all"
          style={{
            background: 'rgba(0,0,0,0.03)',
            border: '1px solid rgba(0,0,0,0.06)',
            color: '#1d1d1f',
          }}
          title="スライドを追加"
        >
          <Plus className="w-3.5 h-3.5 text-[#007AFF]" />
          スライド追加
        </button>
      </div>
    </div>
  );
}
