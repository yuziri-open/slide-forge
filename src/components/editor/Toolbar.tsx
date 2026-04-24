'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/store/editor-store';
import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
  Check,
  ChevronDown,
  Cloud,
  Download,
  FilePlus,
  Image as ImageIcon,
  Loader2,
  Plus,
  Redo2,
  RotateCcw,
  Settings,
  Shapes,
  Smile,
  Type,
  Undo2,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import CSSVarEditor from './CSSVarEditor';
import IconPickerModal from './IconPickerModal';
import { sendToIframe as bridgeSendToIframe } from '@/lib/iframe-bridge';

type ShapeDef = {
  label: string;
  key: string;
  svg: string;
};

type TextPreset = {
  label: string;
  style: string;
  previewStyle: CSSProperties;
  placeholder: string;
};

type AlignOption = {
  label: string;
  key: string;
  icon: typeof AlignLeft;
};

const SHAPES: ShapeDef[] = [
  { label: 'Rectangle', key: 'rect', svg: '<rect x="2" y="2" width="196" height="196" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/>' },
  { label: 'Rounded Rect', key: 'round-rect', svg: '<rect x="2" y="2" width="196" height="196" rx="20" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/>' },
  { label: 'Circle', key: 'circle', svg: '<ellipse cx="100" cy="100" rx="98" ry="98" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/>' },
  { label: 'Ellipse', key: 'ellipse', svg: '<ellipse cx="100" cy="100" rx="98" ry="60" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/>' },
  { label: 'Triangle', key: 'triangle', svg: '<polygon points="100,2 198,198 2,198" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/>' },
  { label: 'Arrow Right', key: 'arrow-right', svg: '<polygon points="2,80 140,80 140,40 198,100 140,160 140,120 2,120" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/>' },
  { label: 'Arrow Down', key: 'arrow-down', svg: '<polygon points="80,2 120,2 120,140 160,140 100,198 40,140 80,140" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/>' },
  { label: 'Arrow Both', key: 'arrow-both', svg: '<polygon points="2,100 60,40 60,80 140,80 140,40 198,100 140,160 140,120 60,120 60,160" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/>' },
  { label: 'Line H', key: 'line-h', svg: '<line x1="2" y1="100" x2="198" y2="100" stroke="#2563EB" stroke-width="6" stroke-linecap="round"/>' },
  { label: 'Line V', key: 'line-v', svg: '<line x1="100" y1="2" x2="100" y2="198" stroke="#2563EB" stroke-width="6" stroke-linecap="round"/>' },
  { label: 'Line D', key: 'line-d', svg: '<line x1="2" y1="2" x2="198" y2="198" stroke="#2563EB" stroke-width="6" stroke-linecap="round"/>' },
  { label: 'Star', key: 'star', svg: '<polygon points="100,5 122,73 195,73 136,117 158,185 100,142 42,185 64,117 5,73 78,73" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/>' },
  { label: 'Diamond', key: 'diamond', svg: '<polygon points="100,2 198,100 100,198 2,100" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/>' },
  { label: 'Callout', key: 'callout', svg: '<rect x="2" y="2" width="196" height="150" rx="16" fill="#4B9EFF" stroke="#2563EB" stroke-width="3"/><polygon points="50,152 80,152 60,198" fill="#4B9EFF" stroke="#2563EB" stroke-width="2"/>' },
];

const TEXT_PRESETS: TextPreset[] = [
  { label: 'Heading', style: 'font-size:32px;font-weight:700;color:#1d1d1f;', previewStyle: { fontSize: 32, fontWeight: 700, color: '#1d1d1f' }, placeholder: 'Heading Text' },
  { label: 'Subheading', style: 'font-size:24px;font-weight:600;color:#1d1d1f;', previewStyle: { fontSize: 24, fontWeight: 600, color: '#1d1d1f' }, placeholder: 'Subheading Text' },
  { label: 'Body', style: 'font-size:16px;font-weight:400;color:#1d1d1f;', previewStyle: { fontSize: 16, fontWeight: 400, color: '#1d1d1f' }, placeholder: 'Body Text' },
  { label: 'Caption', style: 'font-size:12px;font-weight:400;color:#86868b;', previewStyle: { fontSize: 12, fontWeight: 400, color: '#86868b' }, placeholder: 'Caption' },
];

const ALIGN_OPTIONS: AlignOption[] = [
  { label: 'Align Left', key: 'left', icon: AlignLeft },
  { label: 'Center X', key: 'centerX', icon: AlignCenter },
  { label: 'Align Right', key: 'right', icon: AlignRight },
  { label: 'Align Top', key: 'top', icon: AlignStartVertical },
  { label: 'Center Y', key: 'centerY', icon: AlignCenterVertical },
  { label: 'Align Bottom', key: 'bottom', icon: AlignEndVertical },
  { label: 'Distribute X', key: 'distributeX', icon: AlignHorizontalSpaceBetween },
  { label: 'Distribute Y', key: 'distributeY', icon: AlignVerticalSpaceBetween },
];

const modalCardStyle: CSSProperties = {
  width: 'min(100%, 720px)',
  maxHeight: '80vh',
  borderRadius: 20,
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 24px 64px rgba(15,23,42,0.16)',
};

const tileStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

function ModalFrame({
  title,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sf-panel flex flex-col overflow-hidden" style={{ ...modalCardStyle, maxWidth: width }}>
        <div className="flex items-center justify-between p-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <span className="text-sm font-semibold text-[#1d1d1f]">{title}</span>
          <button type="button" onClick={onClose} className="sf-icon-btn" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ShapePickerModal({ onSelect, onClose }: { onSelect: (shape: ShapeDef) => void; onClose: () => void; }) {
  return (
    <ModalFrame title="Insert Shape" onClose={onClose} width={760}>
      <div className="overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SHAPES.map((shape) => (
            <button
              key={shape.key}
              type="button"
              onClick={() => {
                onSelect(shape);
                onClose();
              }}
              className="rounded-2xl p-4 text-left transition-all hover:scale-[1.01]"
              style={tileStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,122,255,0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            >
              <div className="mb-3 flex h-28 items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <svg width="88" height="88" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" dangerouslySetInnerHTML={{ __html: shape.svg }} />
              </div>
              <div className="text-sm font-medium text-[#1d1d1f]">{shape.label}</div>
            </button>
          ))}
        </div>
      </div>
    </ModalFrame>
  );
}

function TextPickerModal({ onSelect, onClose }: { onSelect: (preset: TextPreset) => void; onClose: () => void; }) {
  return (
    <ModalFrame title="Insert Text" onClose={onClose} width={640}>
      <div className="overflow-y-auto p-4 space-y-3">
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              onSelect(preset);
              onClose();
            }}
            className="w-full rounded-2xl p-4 text-left transition-all"
            style={tileStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,122,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
          >
            <div className="mb-1 text-xs uppercase tracking-[0.18em] text-[#86868b]">{preset.label}</div>
            <div style={preset.previewStyle}>{preset.placeholder}</div>
          </button>
        ))}
      </div>
    </ModalFrame>
  );
}

function AlignPickerModal({
  onAlign,
  onClose,
  multiSelectCount,
}: {
  onAlign: (alignType: string) => void;
  onClose: () => void;
  multiSelectCount: number;
}) {
  return (
    <ModalFrame title="Align" onClose={onClose} width={620}>
      <div className="p-4">
        {multiSelectCount < 2 ? (
          <div className="rounded-2xl px-4 py-8 text-center text-sm text-[#86868b]" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
            Select at least two elements
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {ALIGN_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    onAlign(opt.key);
                    onClose();
                  }}
                  className="flex items-center gap-3 rounded-2xl p-4 text-left transition-all"
                  style={tileStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,122,255,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <Icon className="w-4 h-4 text-[#1d1d1f]" />
                  </div>
                  <span className="text-sm text-[#1d1d1f]">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </ModalFrame>
  );
}

export default function Toolbar() {
  const {
    fileName, undo, redo, zoom, setZoom, exportHTML,
    historyIndex, history, multiSelect, addSlide, loadHTML, slides, headHtml,
    saveToCloud, isSaving, lastSavedAt,
  } = useEditorStore();
  const [showCSSVars, setShowCSSVars] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showNewSlideDialog, setShowNewSlideDialog] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showTextPicker, setShowTextPicker] = useState(false);
  const [showAlignPicker, setShowAlignPicker] = useState(false);
  const [pptxProgress, setPptxProgress] = useState<{ label: string; current: number; total: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // GAS API URL が設定されているか確認（クライアントサイドで判定）
  const gasApiUrl = process.env.NEXT_PUBLIC_GAS_SLIDE_API || '';
  const isCloudEnabled = gasApiUrl.trim().length > 0;

  // 保存成功後に「Saved」表示を3秒で消す
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setSaveStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleSaveToCloud = async () => {
    if (isSaving) return;
    try {
      await saveToCloud();
      setSaveStatus('saved');
    } catch (err) {
      console.error('[Toolbar] save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleExport = () => {
    const html = exportHTML();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'edited-slides.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPPTX = async () => {
    if (pptxProgress) return;
    try {
      const { exportToPPTX } = await import('@/lib/pptx-export');
      await exportToPPTX(headHtml, slides, fileName || 'slides', (label, current, total) => {
        setPptxProgress({ label, current, total });
      });
    } catch (e) {
      console.error('PPTX export failed:', e);
      alert('PPTXエクスポートに失敗しました。');
    } finally {
      setPptxProgress(null);
    }
  };

  const insertShape = (shape: ShapeDef) => {
    const html = `<div class="sf-shape" style="position:absolute;left:440px;top:260px;width:200px;height:200px;"><svg width="100%" height="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${shape.svg}</svg></div>`;
    bridgeSendToIframe({ type: 'insert-element', html, x: 440, y: 260 });
  };

  const insertText = (preset: TextPreset) => {
    const html = `<div class="sf-text" style="position:absolute;left:200px;top:300px;min-width:200px;min-height:40px;${preset.style}padding:8px;">${preset.placeholder}</div>`;
    bridgeSendToIframe({ type: 'insert-element', html, x: 200, y: 300 });
  };

  const insertIcon = (iconHtml: string) => {
    bridgeSendToIframe({ type: 'insert-element', html: iconHtml });
    setShowIconPicker(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const html = `<img class="sf-image" src="${src}" style="position:absolute;left:440px;top:260px;width:200px;height:200px;object-fit:cover;border-radius:0px;" alt=""/>`;
      bridgeSendToIframe({ type: 'insert-element', html, x: 440, y: 260 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAlign = (alignType: string) => {
    if (multiSelect.length < 2) return;
    bridgeSendToIframe({ type: 'align-elements', xpaths: multiSelect, alignType });
  };

  const btnStyle: CSSProperties = {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.06)',
    color: '#1d1d1f',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  };

  const softBtnStyle: CSSProperties = {
    background: 'rgba(0,0,0,0.03)',
    border: '1px solid rgba(0,0,0,0.06)',
    color: '#1d1d1f',
  };

  return (
    <>
      <header className="relative z-50 h-14 flex items-center px-3 gap-3 flex-shrink-0" style={{ background: 'transparent' }}>
        <div className="flex items-center gap-2 px-3 py-2 flex-1 sf-toolbar overflow-x-auto">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 mr-2 flex-shrink-0 hover:opacity-70 transition-opacity"
            title="ホームに戻る"
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#007AFF', boxShadow: '0 4px 12px rgba(0,122,255,0.24)' }}>
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-[#1d1d1f] tracking-tight" style={{ fontFamily: '-apple-system, "SF Pro Display", sans-serif' }}>
              SlideForge
            </span>
          </button>

          <div className="min-w-0 mr-2 flex-shrink" style={{ maxWidth: 180 }}>
            <span className="text-xs text-[#86868b] truncate block">{fileName || 'untitled.html'}</span>
          </div>

          <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.08)' }} />

          <button onClick={() => setShowNewSlideDialog(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-all flex-shrink-0" style={btnStyle} title="New slide">
            <FilePlus className="w-3.5 h-3.5 text-[#007AFF]" />
            <span className="hidden sm:inline">New</span>
          </button>

          <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.08)' }} />

          <button onClick={() => setShowShapePicker(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-all flex-shrink-0" style={btnStyle} title="Insert shape">
            <Shapes className="w-3.5 h-3.5 text-[#007AFF]" />
            <span className="hidden sm:inline">Shape</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-all flex-shrink-0" style={btnStyle} title="Insert image">
            <ImageIcon className="w-3.5 h-3.5 text-[#007AFF]" />
            <span className="hidden sm:inline">Image</span>
          </button>
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp" className="hidden" onChange={handleImageUpload} />

          <button onClick={() => setShowIconPicker(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-all flex-shrink-0" style={btnStyle} title="Insert icon">
            <Smile className="w-3.5 h-3.5 text-[#007AFF]" />
            <span className="hidden sm:inline">Icon</span>
          </button>

          <button onClick={() => setShowTextPicker(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-all flex-shrink-0" style={btnStyle} title="Insert text">
            <Type className="w-3.5 h-3.5 text-[#007AFF]" />
            <span className="hidden sm:inline">Text</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          <button
            onClick={() => setShowAlignPicker(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-all flex-shrink-0"
            style={multiSelect.length >= 2
              ? { background: 'rgba(0,122,255,0.1)', border: '1px solid rgba(0,122,255,0.22)', color: '#007AFF', boxShadow: '0 1px 2px rgba(0,122,255,0.08)' }
              : { ...btnStyle, color: '#86868b' }}
            title="Align"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Align</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.08)' }} />

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={undo} disabled={historyIndex <= 0} className="sf-icon-btn" title="Undo">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1} className="sf-icon-btn" title="Redo">
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.08)' }} />

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={() => setZoom(Math.max(0.25, zoom - 0.1))} className="sf-icon-btn">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-[#86868b] w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="sf-icon-btn">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setZoom(1)} className="sf-icon-btn" title="Reset zoom">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.08)' }} />

          <button onClick={() => setShowCSSVars(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all flex-shrink-0" style={btnStyle} title="Theme variables">
            <Settings className="w-3.5 h-3.5 text-[#007AFF]" />
            <span className="hidden sm:inline">Theme</span>
          </button>

          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white font-medium transition-all hover:opacity-90 flex-shrink-0" style={{ background: '#007AFF', border: '1px solid rgba(0,122,255,0.3)', boxShadow: '0 8px 20px rgba(0,122,255,0.2)' }}>
            <Download className="w-3.5 h-3.5" />
            HTML
          </button>

          <button
            onClick={handleExportPPTX}
            disabled={!!pptxProgress}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white font-medium transition-all hover:opacity-90 flex-shrink-0 disabled:opacity-60"
            style={{ background: '#34C759', border: '1px solid rgba(52,199,89,0.3)', boxShadow: '0 8px 20px rgba(52,199,89,0.2)' }}
          >
            <Download className="w-3.5 h-3.5" />
            {pptxProgress ? `${pptxProgress.current}/${pptxProgress.total}` : 'PPTX'}
          </button>

          {/* Save to Cloud: GAS_API_URL が設定されている場合のみ表示 */}
          {isCloudEnabled && (
            <button
              onClick={handleSaveToCloud}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white font-medium transition-all hover:opacity-90 flex-shrink-0 disabled:opacity-60"
              style={
                saveStatus === 'saved'
                  ? { background: '#30D158', border: '1px solid rgba(48,209,88,0.3)', boxShadow: '0 8px 20px rgba(48,209,88,0.2)' }
                  : saveStatus === 'error'
                  ? { background: '#FF3B30', border: '1px solid rgba(255,59,48,0.3)', boxShadow: '0 8px 20px rgba(255,59,48,0.2)' }
                  : { background: '#5856D6', border: '1px solid rgba(88,86,214,0.3)', boxShadow: '0 8px 20px rgba(88,86,214,0.2)' }
              }
              title={lastSavedAt ? `最終保存: ${new Date(lastSavedAt).toLocaleString('ja-JP')}` : 'クラウドに保存'}
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saveStatus === 'saved' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Cloud className="w-3.5 h-3.5" />
              )}
              {isSaving ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Save'}
            </button>
          )}
        </div>
      </header>

      {showCSSVars && <CSSVarEditor onClose={() => setShowCSSVars(false)} />}
      {showIconPicker && <IconPickerModal onSelect={insertIcon} onClose={() => setShowIconPicker(false)} />}
      {showShapePicker && <ShapePickerModal onSelect={insertShape} onClose={() => setShowShapePicker(false)} />}
      {showTextPicker && <TextPickerModal onSelect={insertText} onClose={() => setShowTextPicker(false)} />}
      {showAlignPicker && <AlignPickerModal onAlign={handleAlign} onClose={() => setShowAlignPicker(false)} multiSelectCount={multiSelect.length} />}

      {showNewSlideDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewSlideDialog(false);
          }}
        >
          <div className="sf-panel p-6 space-y-4" style={{ width: 360, borderRadius: 20, background: 'rgba(255,255,255,0.96)' }}>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">New Slide</h2>
            <p className="text-xs text-[#86868b]">Add a slide to the current deck or start from a blank document.</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  addSlide();
                  setShowNewSlideDialog(false);
                }}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-left px-4"
                style={{ background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.18)', color: '#1d1d1f' }}
              >
                <Plus className="inline w-4 h-4 mr-1.5 text-[#007AFF]" />
                Add slide
                <div className="text-xs font-normal mt-0.5 text-[#86868b]">Append a new slide to the current presentation.</div>
              </button>
              <button
                onClick={() => {
                  setShowNewSlideDialog(false);
                  router.push('/');
                }}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-left px-4"
                style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.14)', color: '#1d1d1f' }}
              >
                Start blank
                <div className="text-xs font-normal mt-0.5 text-[#86868b]">ホーム画面に戻り、新しいプレゼンテーションを開始します。</div>
              </button>
              <button onClick={() => setShowNewSlideDialog(false)} className="w-full py-2 rounded-xl text-sm transition-all" style={softBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
