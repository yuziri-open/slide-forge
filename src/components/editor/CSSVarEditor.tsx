'use client';

import { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { HexColorPicker } from 'react-colorful';
import { parseColor } from '@/lib/style-utils';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

function isColorValue(value: string): boolean {
  const v = value.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(v) || /^rgb/.test(v) || /^hsl/.test(v);
}

function sendCssVarToIframe(name: string, value: string) {
  const iframe = document.querySelector('iframe[title^="Slide"]') as HTMLIFrameElement | null;
  iframe?.contentWindow?.postMessage({ type: 'update-css-var', name, value }, '*');
}

export default function CSSVarEditor({ onClose }: Props) {
  const { cssVariables, updateCSSVariable } = useEditorStore();
  const [activeVar, setActiveVar] = useState<string | null>(null);

  const handleChange = (name: string, value: string) => {
    updateCSSVariable(name, value);
    sendCssVarToIframe(name, value);
  };

  const colorVars = cssVariables.filter((v) => isColorValue(v.value));
  const otherVars = cssVariables.filter((v) => !isColorValue(v.value));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}>
      <div className="sf-panel w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div>
            <h2 className="font-semibold text-[#1d1d1f] text-sm">CSS変数エディタ</h2>
            <p className="text-xs text-[#86868b] mt-0.5">テーマカラーをその場で調整します</p>
          </div>
          <button onClick={onClose} className="sf-icon-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {colorVars.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[#86868b] mb-3 uppercase tracking-wider">
                Color Variables ({colorVars.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {colorVars.map((v) => (
                  <div key={v.name} className="space-y-1">
                    <label className="text-xs text-[#86868b] font-mono truncate block">{v.name}</label>
                    <div className="flex items-center gap-2">
                      <button
                        className="w-8 h-8 rounded-lg border flex-shrink-0 transition-transform hover:scale-110"
                        style={{ background: v.value, borderColor: 'rgba(0,0,0,0.08)' }}
                        onClick={() => setActiveVar(activeVar === v.name ? null : v.name)}
                      />
                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => handleChange(v.name, e.target.value)}
                        className="sf-input flex-1 min-w-0 font-mono"
                      />
                    </div>
                    {activeVar === v.name && (
                      <div className="pt-1 rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(0,0,0,0.06)', background: '#fff' }}>
                        <HexColorPicker
                          color={parseColor(v.value)}
                          onChange={(color) => handleChange(v.name, color)}
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherVars.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[#86868b] mb-3 uppercase tracking-wider">
                Other Variables ({otherVars.length})
              </h3>
              <div className="space-y-2">
                {otherVars.map((v) => (
                  <div key={v.name} className="flex items-center gap-3">
                    <span className="text-xs text-[#86868b] font-mono w-40 truncate flex-shrink-0">{v.name}</span>
                    <input
                      type="text"
                      value={v.value}
                      onChange={(e) => handleChange(v.name, e.target.value)}
                      className="sf-input flex-1 font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {cssVariables.length === 0 && (
            <div className="text-center py-8 text-[#86868b] text-sm">
              CSS変数は見つかりませんでした
            </div>
          )}
        </div>

        <div className="px-5 py-3 flex justify-end flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-white text-xs rounded-xl font-medium transition-colors"
            style={{ background: '#007AFF' }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
