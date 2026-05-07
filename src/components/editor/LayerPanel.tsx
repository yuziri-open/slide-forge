'use client';

/**
 * LayerPanel.tsx
 * 目的: 現在のスライドの要素を一覧表示し、選択・z-index操作を提供する
 * 作成日: 2026-04-30
 * 依頼元: Jack (COO) / SlideForge Layer Panel 追加タスク
 * 実行方法: src/app/editor/page.tsx の左カラムに配置
 *
 * 依存:
 * - useEditorStore: slides, currentSlideIndex, selectedElement
 * - sendToIframe: select-element, zindex-op メッセージ送信
 * - lucide-react: Shapes, Type, Image, Group, Box, ChevronUp, ChevronDown, Lock
 */

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { sendToIframe } from '@/lib/iframe-bridge';
import {
  Shapes,
  Type,
  ImageIcon,
  Group,
  Box,
  ChevronUp,
  ChevronDown,
  Lock,
} from 'lucide-react';

// ------------------------------------------------------------
// 型定義
// ------------------------------------------------------------

interface LayerItem {
  /** 表示ラベル（テキスト内容 or 要素タイプ） */
  label: string;
  /** 要素クラス ("sf-shape", "sf-text", "sf-image", "sf-group", その他) */
  elementClass: string;
  /** ロック状態 (data-sf-locked 属性) */
  isLocked: boolean;
  /**
   * この要素を特定するためのシンプルな index（0始まり）。
   * iframe 内の click 選択は postMessage で xpath を使う。
   * xpath は .slide の直下 index から組み立てる。
   */
  index: number;
  /** iframe に送る xpath（/html/body/div[1]/div[N+1] 形式） */
  xpath: string;
}

// ------------------------------------------------------------
// ユーティリティ
// ------------------------------------------------------------

/**
 * .slide 直下の要素から LayerItem 配列を生成する。
 * 末尾の要素が最前面（z-index的に上）なので reverse して表示する。
 */
function parseLayerItems(html: string): LayerItem[] {
  if (typeof window === 'undefined') return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const slide = doc.querySelector('.slide');
  if (!slide) return [];

  const children = Array.from(slide.children) as HTMLElement[];
  return children.map((el, index) => {
    const classes = Array.from(el.classList);
    const elementClass = classes.find((c) =>
      ['sf-shape', 'sf-text', 'sf-image', 'sf-group'].includes(c)
    ) ?? 'other';

    // ラベル: テキスト内容（最大20文字）、なければ要素タイプ
    const rawText = el.textContent?.trim().replace(/\s+/g, ' ') ?? '';
    const label = rawText.length > 0
      ? rawText.slice(0, 24) + (rawText.length > 24 ? '…' : '')
      : elementClass === 'sf-image'
        ? 'Image'
        : elementClass === 'sf-shape'
          ? 'Shape'
          : elementClass === 'sf-group'
            ? 'Group'
            : 'Element';

    // iframe-inject sets data-sf-locked="1" (truthy check suffices)
    const isLocked = !!el.getAttribute('data-sf-locked');

    // xpath: /html/body/div[1]/div[childIndex+1]
    // DOMParser の body 内に .slide が入るので body/div[1] = slide要素
    // .slide の子要素は div[1]始まり
    const xpath = `/html/body/div[1]/div[${index + 1}]`;

    return { label, elementClass, isLocked, index, xpath };
  });
}

/**
 * 要素クラスに対応するアイコンコンポーネントを返す。
 */
function ElementIcon({ elementClass, size = 12 }: { elementClass: string; size?: number }) {
  const props = { size, strokeWidth: 1.8 };
  switch (elementClass) {
    case 'sf-shape': return <Shapes {...props} />;
    case 'sf-text':  return <Type {...props} />;
    case 'sf-image': return <ImageIcon {...props} />;
    case 'sf-group': return <Group {...props} />;
    default:         return <Box {...props} />;
  }
}

// ------------------------------------------------------------
// LayerPanel コンポーネント
// ------------------------------------------------------------

export default function LayerPanel() {
  const slides = useEditorStore((s) => s.slides);
  const currentSlideIndex = useEditorStore((s) => s.currentSlideIndex);
  const selectedElement = useEditorStore((s) => s.selectedElement);

  // ホバー中のアイテム index を管理（z-index ボタン表示制御）
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 現在のスライド HTML が変わるたびに再パース
  const layers = useMemo(() => {
    const slide = slides[currentSlideIndex];
    if (!slide) return [];
    // 最前面が上に来るよう reverse
    return parseLayerItems(slide.html).reverse();
  }, [slides, currentSlideIndex]);

  if (layers.length === 0) return null;

  /**
   * レイヤーアイテムをクリック → iframe に select-element を送信
   * iframe 側で該当 xpath の要素を選択させる
   */
  const handleSelect = (xpath: string) => {
    sendToIframe({ type: 'select-element', xpath });
  };

  /**
   * z-index 操作ボタン
   */
  const handleZIndex = (e: React.MouseEvent, xpath: string, op: 'forward' | 'backward') => {
    e.stopPropagation();
    sendToIframe({ type: 'zindex-op', xpath, op });
  };

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(0,0,0,0.07)',
        backdropFilter: 'blur(12px)',
        minWidth: 160,
        maxWidth: 200,
      }}
    >
      {/* ヘッダー */}
      <div
        className="px-3 py-2 flex items-center gap-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
      >
        <Shapes size={11} strokeWidth={2} style={{ color: '#86868b' }} />
        <span className="text-xs font-medium" style={{ color: '#3a3a3c' }}>
          レイヤー
        </span>
        <span
          className="ml-auto text-xs tabular-nums"
          style={{ color: '#86868b' }}
        >
          {layers.length}
        </span>
      </div>

      {/* レイヤーリスト */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: 220 }}
      >
        {layers.map((item) => {
          const isSelected = selectedElement?.xpath === item.xpath;
          const isHovered = hoveredIndex === item.index;

          return (
            <div
              key={item.index}
              className="relative flex items-center gap-1.5 px-2 cursor-pointer select-none"
              style={{
                height: 28,
                background: isSelected
                  ? 'rgba(0,122,255,0.10)'
                  : isHovered
                    ? 'rgba(0,0,0,0.03)'
                    : 'transparent',
                borderLeft: isSelected
                  ? '2px solid #007AFF'
                  : '2px solid transparent',
                transition: 'background 0.1s',
              }}
              onClick={() => handleSelect(item.xpath)}
              onMouseEnter={() => setHoveredIndex(item.index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* 要素アイコン */}
              <span
                style={{
                  color: isSelected ? '#007AFF' : '#86868b',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ElementIcon elementClass={item.elementClass} size={11} />
              </span>

              {/* ラベル */}
              <span
                className="text-xs truncate flex-1"
                style={{
                  color: isSelected ? '#007AFF' : '#3a3a3c',
                  fontWeight: isSelected ? 500 : 400,
                  maxWidth: 90,
                }}
              >
                {item.label}
              </span>

              {/* ロックアイコン（常時表示） */}
              {item.isLocked && (
                <Lock
                  size={9}
                  strokeWidth={2}
                  style={{ color: '#86868b', flexShrink: 0 }}
                />
              )}

              {/* z-index ボタン（ホバー時のみ表示） */}
              {isHovered && (
                <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
                  <button
                    className="flex items-center justify-center rounded"
                    style={{
                      width: 16,
                      height: 16,
                      background: 'rgba(0,0,0,0.06)',
                      color: '#3a3a3c',
                    }}
                    title="前面へ"
                    onClick={(e) => handleZIndex(e, item.xpath, 'forward')}
                  >
                    <ChevronUp size={10} strokeWidth={2.5} />
                  </button>
                  <button
                    className="flex items-center justify-center rounded"
                    style={{
                      width: 16,
                      height: 16,
                      background: 'rgba(0,0,0,0.06)',
                      color: '#3a3a3c',
                    }}
                    title="背面へ"
                    onClick={(e) => handleZIndex(e, item.xpath, 'backward')}
                  >
                    <ChevronDown size={10} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
