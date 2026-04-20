'use client';

import { useEditorStore } from '@/store/editor-store';
import { buildThumbnailSrcDoc } from '@/lib/html-parser';
import { Plus } from 'lucide-react';

export default function SlideNavigator() {
  const { slides, headHtml, currentSlideIndex, setCurrentSlide, addSlide } = useEditorStore();

  return (
    <div className="sf-panel w-48 flex flex-col overflow-hidden flex-shrink-0 m-2 mr-0">
      <div className="p-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <span className="text-xs font-medium text-[#1d1d1f]">スライド</span>
        <span className="text-xs text-[#86868b]">{slides.length}枚</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-2">
        {slides.map((slide, index) => {
          const active = currentSlideIndex === index;
          return (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(index)}
              className="w-full relative rounded-2xl overflow-hidden transition-all duration-200"
              style={active
                ? {
                    border: '1px solid rgba(0,122,255,0.3)',
                    boxShadow: '0 0 0 2px rgba(0,122,255,0.24), 0 10px 24px rgba(0,122,255,0.12)',
                  }
                : {
                    border: '1px solid rgba(0,0,0,0.06)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}
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
                style={active
                  ? { background: 'rgba(0,122,255,0.1)', color: '#007AFF' }
                  : { background: 'rgba(255,255,255,0.92)', color: '#86868b' }}
              >
                {index + 1}
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <button
          onClick={() => addSlide()}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs transition-all"
          style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', color: '#1d1d1f' }}
          title="スライドを追加"
        >
          <Plus className="w-3.5 h-3.5 text-[#007AFF]" />
          スライド追加
        </button>
      </div>
    </div>
  );
}
