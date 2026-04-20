'use client';

import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { HexColorPicker } from 'react-colorful';
import { parseColor, parseFontSize, FONT_FAMILIES } from '@/lib/style-utils';
import {
  ArrowDown,
  ArrowUp,
  Box,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Layers,
  Lock,
  Unlock,
} from 'lucide-react';
import { sendToIframe } from '@/lib/iframe-bridge';

function parseRotation(transform?: string) {
  if (!transform || transform === 'none') return 0;

  const rotateMatch = transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
  if (rotateMatch) {
    return Math.round(parseFloat(rotateMatch[1]));
  }

  const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
  if (matrixMatch) {
    const values = matrixMatch[1].split(',').map((v) => parseFloat(v.trim()));
    if (values.length >= 2) {
      const [a, b] = values;
      return Math.round(Math.atan2(b, a) * (180 / Math.PI));
    }
  }

  return 0;
}

function ColorPicker({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hex = parseColor(value);

  return (
    <div className="relative">
      <label className="text-xs text-[#86868b] block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <button
          className="w-8 h-8 rounded-lg flex-shrink-0 transition-transform hover:scale-110"
          style={{ background: hex, border: '1px solid rgba(0,0,0,0.08)' }}
          onClick={() => setOpen(!open)}
        />
        <input
          type="text"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="sf-input flex-1 font-mono"
        />
      </div>
      {open && (
        <div
          className="absolute z-50 mt-2 shadow-xl rounded-xl overflow-hidden"
          style={{ left: 0, background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <HexColorPicker color={hex} onChange={onChange} />
          <button
            className="w-full py-1.5 text-xs text-[#86868b] hover:text-[#1d1d1f] transition-colors"
            onClick={() => setOpen(false)}
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <button
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-[#1d1d1f] transition-colors"
        onClick={() => setOpen(!open)}
      >
        {title}
        {open ? <ChevronDown className="w-3.5 h-3.5 text-[#86868b]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#86868b]" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function NumInput({ label, value, onChange, min, max, unit = '' }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <div>
      <label className="text-xs text-[#86868b] block mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={isNaN(value) ? '' : value}
          min={min}
          max={max}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="sf-input flex-1"
        />
        {unit && <span className="text-xs text-[#86868b] w-6">{unit}</span>}
      </div>
    </div>
  );
}

export default function PropertyPanel() {
  const { selectedElement, multiSelect } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'props' | 'layers'>('props');

  const updateStyle = useCallback((property: string, value: string) => {
    if (!selectedElement) return;
    sendToIframe({ type: 'update-style', xpath: selectedElement.xpath, property, value });
  }, [selectedElement]);

  const tabBar = (
    <div className="flex border-b flex-shrink-0" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
      {(['props', 'layers'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className="flex-1 py-2 text-xs font-medium transition-colors"
          style={activeTab === tab
            ? { color: '#1d1d1f', borderBottom: '2px solid rgba(0,122,255,0.9)' }
            : { color: '#86868b' }}
        >
          {tab === 'props' ? 'プロパティ' : 'レイヤー'}
        </button>
      ))}
    </div>
  );

  if (!selectedElement && multiSelect.length === 0) {
    return (
      <div className="sf-panel w-64 flex flex-col flex-shrink-0 m-2 ml-0">
        <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <span className="text-xs font-semibold text-[#1d1d1f]">プロパティ</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <p className="text-xs text-[#86868b] leading-relaxed">
            要素をクリックして
            <br />
            プロパティを表示
          </p>
        </div>
      </div>
    );
  }

  if (multiSelect.length >= 2) {
    return (
      <div className="sf-panel w-64 flex flex-col flex-shrink-0 m-2 ml-0">
        <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <span className="text-xs font-semibold text-[#1d1d1f]">プロパティ</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.16)' }}>
            <Layers className="w-5 h-5 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#1d1d1f] mb-1">{multiSelect.length}個の要素を選択中</p>
            <p className="text-xs text-[#86868b] leading-relaxed">Ctrl+G でグループ化</p>
          </div>
          <button
            onClick={() => sendToIframe({ type: 'group-selected' })}
            className="px-4 py-2 rounded-xl text-xs font-medium text-white transition-all"
            style={{ background: '#007AFF', border: '1px solid rgba(0,122,255,0.2)' }}
          >
            グループ化
          </button>
        </div>
      </div>
    );
  }

  if (selectedElement?.isGroup) {
    return (
      <div className="sf-panel w-64 flex flex-col flex-shrink-0 m-2 ml-0">
        <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <span className="text-xs font-semibold text-[#1d1d1f]">プロパティ</span>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Box className="w-3 h-3 text-[#007AFF]" />
            <span className="text-xs text-[#007AFF] font-medium">グループ</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.16)' }}>
            <Box className="w-5 h-5 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#1d1d1f] mb-1">グループ ({selectedElement.groupChildCount ?? 0}要素)</p>
            <p className="text-xs text-[#86868b] leading-relaxed">ダブルクリックで内部要素を選択</p>
          </div>
          <button
            onClick={() => sendToIframe({ type: 'ungroup-selected' })}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', color: '#1d1d1f' }}
          >
            グループ解除
          </button>
        </div>
      </div>
    );
  }

  const s = selectedElement!.computedStyles;
  const fontSize = parseFontSize(s.fontSize);
  const opacity = Math.round((parseFloat(s.opacity ?? '1') || 1) * 100);
  const zIndex = s.zIndex === 'auto' ? 0 : parseInt(s.zIndex || '0', 10) || 0;
  const isLocked = selectedElement!.isLocked ?? false;
  const isImage = selectedElement!.tagName?.toLowerCase() === 'img';
  const rotation = parseRotation(s.transform);

  const layersTab = (
    <div className="flex-1 overflow-y-auto">
      <Section title="ロック" defaultOpen>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#86868b]">要素をロック</span>
          <button
            onClick={() => sendToIframe({
              type: isLocked ? 'unlock-element' : 'lock-element',
              xpath: selectedElement!.xpath,
            })}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={isLocked
              ? { background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.16)', color: '#ff3b30' }
              : { background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', color: '#1d1d1f' }}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isLocked ? 'ロック中' : 'ロック'}
          </button>
        </div>
      </Section>

      <Section title="前後関係" defaultOpen>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-xs text-[#86868b] block mb-1">Z-index</label>
            <input
              type="number"
              value={zIndex}
              onChange={(e) => sendToIframe({
                type: 'set-zindex',
                xpath: selectedElement!.xpath,
                value: parseInt(e.target.value || '0', 10) || 0,
              })}
              className="sf-input w-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => sendToIframe({ type: 'zindex-op', xpath: selectedElement!.xpath, op: 'front' })}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', color: '#1d1d1f' }}
          >
            <ChevronsUp className="w-3.5 h-3.5" /> 最前面
          </button>
          <button
            onClick={() => sendToIframe({ type: 'zindex-op', xpath: selectedElement!.xpath, op: 'back' })}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', color: '#1d1d1f' }}
          >
            <ChevronsDown className="w-3.5 h-3.5" /> 最背面
          </button>
          <button
            onClick={() => sendToIframe({ type: 'zindex-op', xpath: selectedElement!.xpath, op: 'forward' })}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', color: '#1d1d1f' }}
          >
            <ArrowUp className="w-3.5 h-3.5" /> 前へ
          </button>
          <button
            onClick={() => sendToIframe({ type: 'zindex-op', xpath: selectedElement!.xpath, op: 'backward' })}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', color: '#1d1d1f' }}
          >
            <ArrowDown className="w-3.5 h-3.5" /> 後ろへ
          </button>
        </div>
      </Section>

      <Section title="操作" defaultOpen>
        <button
          onClick={() => sendToIframe({ type: 'duplicate-element', xpath: selectedElement!.xpath })}
          className="w-full py-2 rounded-xl text-xs transition-all"
          style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', color: '#1d1d1f' }}
        >
          複製 (Ctrl+D)
        </button>
        <button
          onClick={() => sendToIframe({ type: 'delete-element', xpath: selectedElement!.xpath })}
          className="w-full py-2 rounded-xl text-xs transition-all"
          style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.14)', color: '#ff3b30' }}
        >
          削除 (Delete)
        </button>
      </Section>
    </div>
  );

  return (
    <div className="sf-panel w-64 flex flex-col overflow-hidden flex-shrink-0 m-2 ml-0">
      <div className="p-4 pb-0 flex-shrink-0">
        <span className="text-xs font-semibold text-[#1d1d1f]">プロパティ</span>
        <div className="mt-0.5 text-xs text-[#86868b] font-mono truncate">
          &lt;{selectedElement!.tagName?.toLowerCase()}&gt;
          {isLocked && <Lock className="inline w-3 h-3 ml-1 text-[#ff3b30]" />}
        </div>
      </div>
      {tabBar}

      {activeTab === 'layers' ? layersTab : (
        <div className="flex-1 overflow-y-auto">
          <Section title="テキスト">
            <div>
              <label className="text-xs text-[#86868b] block mb-1">
                フォントサイズ <span className="text-[#86868b] ml-1">{fontSize}px</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={6}
                  max={120}
                  value={fontSize}
                  onChange={(e) => updateStyle('fontSize', `${e.target.value}px`)}
                  className="flex-1 sf-range"
                />
                <input
                  type="number"
                  value={fontSize}
                  min={6}
                  max={200}
                  onChange={(e) => updateStyle('fontSize', `${e.target.value}px`)}
                  className="sf-input w-14"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#86868b] block mb-1">フォントファミリー</label>
              <select
                value={s.fontFamily?.split(',')[0]?.replace(/['"]/g, '').trim() || 'Inter'}
                onChange={(e) => updateStyle('fontFamily', e.target.value)}
                className="sf-select w-full"
              >
                {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#86868b] block mb-1">フォントウェイト</label>
              <select
                value={s.fontWeight || '400'}
                onChange={(e) => updateStyle('fontWeight', e.target.value)}
                className="sf-select w-full"
              >
                {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#86868b] block mb-1">テキスト配置</label>
              <div className="flex gap-1">
                {[
                  { value: 'left', label: '左' },
                  { value: 'center', label: '中' },
                  { value: 'right', label: '右' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => updateStyle('textAlign', value)}
                    className="flex-1 py-1.5 text-xs rounded-lg transition-all"
                    style={s.textAlign === value
                      ? { background: 'rgba(0,122,255,0.1)', border: '1px solid rgba(0,122,255,0.22)', color: '#007AFF' }
                      : { background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', color: '#86868b' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <NumInput label="行間" value={parseFloat(s.lineHeight) || 1.5} onChange={(v) => updateStyle('lineHeight', String(v))} />
            <NumInput label="字間(px)" value={parseFloat(s.letterSpacing) || 0} onChange={(v) => updateStyle('letterSpacing', `${v}px`)} unit="px" />
          </Section>

          <Section title="カラー">
            <ColorPicker label="文字色" value={s.color || '#000000'} onChange={(v) => updateStyle('color', v)} />
            <ColorPicker label="背景色" value={s.backgroundColor || 'transparent'} onChange={(v) => updateStyle('backgroundColor', v)} />
            <ColorPicker label="ボーダー色" value={s.borderColor || '#000000'} onChange={(v) => updateStyle('borderColor', v)} />
          </Section>

          <Section title="レイアウト" defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <NumInput label="幅" value={parseFloat(s.width)} onChange={(v) => updateStyle('width', `${v}px`)} unit="px" />
              <NumInput label="高さ" value={parseFloat(s.height)} onChange={(v) => updateStyle('height', `${v}px`)} unit="px" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumInput label="X (left)" value={parseFloat(s.left)} onChange={(v) => updateStyle('left', `${v}px`)} unit="px" />
              <NumInput label="Y (top)" value={parseFloat(s.top)} onChange={(v) => updateStyle('top', `${v}px`)} unit="px" />
            </div>
            <NumInput label="角丸" value={parseFloat(s.borderRadius)} onChange={(v) => updateStyle('borderRadius', `${v}px`)} unit="px" />
            <div>
              <label className="text-xs text-[#86868b] block mb-1">
                回転 <span className="text-[#86868b]">{rotation}°</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={rotation}
                  onChange={(e) => updateStyle('transform', `rotate(${e.target.value}deg)`)}
                  className="flex-1 sf-range"
                />
                <input
                  type="number"
                  value={rotation}
                  min={-360}
                  max={360}
                  onChange={(e) => updateStyle('transform', `rotate(${e.target.value}deg)`)}
                  className="sf-input w-16"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#86868b] block mb-1">
                不透明度 <span className="text-[#86868b]">{opacity}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={opacity}
                onChange={(e) => updateStyle('opacity', String(parseInt(e.target.value, 10) / 100))}
                className="w-full sf-range"
              />
            </div>
          </Section>

          {isImage && (
            <Section title="画像設定" defaultOpen>
              <div>
                <label className="text-xs text-[#86868b] block mb-1">フィット</label>
                <select
                  value={s.objectFit || 'cover'}
                  onChange={(e) => updateStyle('objectFit', e.target.value)}
                  className="sf-select w-full"
                >
                  <option value="cover">cover</option>
                  <option value="contain">contain</option>
                  <option value="fill">fill</option>
                  <option value="none">none</option>
                </select>
              </div>
            </Section>
          )}

          <Section title="余白" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2">
              <NumInput label="上 padding" value={parseFloat(s.paddingTop)} onChange={(v) => updateStyle('paddingTop', `${v}px`)} unit="px" />
              <NumInput label="右 padding" value={parseFloat(s.paddingRight)} onChange={(v) => updateStyle('paddingRight', `${v}px`)} unit="px" />
              <NumInput label="下 padding" value={parseFloat(s.paddingBottom)} onChange={(v) => updateStyle('paddingBottom', `${v}px`)} unit="px" />
              <NumInput label="左 padding" value={parseFloat(s.paddingLeft)} onChange={(v) => updateStyle('paddingLeft', `${v}px`)} unit="px" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumInput label="上 margin" value={parseFloat(s.marginTop)} onChange={(v) => updateStyle('marginTop', `${v}px`)} unit="px" />
              <NumInput label="右 margin" value={parseFloat(s.marginRight)} onChange={(v) => updateStyle('marginRight', `${v}px`)} unit="px" />
              <NumInput label="下 margin" value={parseFloat(s.marginBottom)} onChange={(v) => updateStyle('marginBottom', `${v}px`)} unit="px" />
              <NumInput label="左 margin" value={parseFloat(s.marginLeft)} onChange={(v) => updateStyle('marginLeft', `${v}px`)} unit="px" />
            </div>
          </Section>

          <Section title="テキスト内容" defaultOpen={false}>
            <div>
              <label className="text-xs text-[#86868b] block mb-1">内容</label>
              <textarea
                defaultValue={selectedElement!.textContent}
                rows={4}
                className="sf-input w-full resize-none"
                onBlur={(e) => {
                  sendToIframe({
                    type: 'update-text',
                    xpath: selectedElement!.xpath,
                    value: e.target.value,
                  });
                }}
              />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
