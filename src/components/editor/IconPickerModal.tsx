'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

interface IconDef {
  name: string;
  label: string;
  category: string;
  svg: string;
}

const ICONS: IconDef[] = [
  { name: 'arrow-right', label: 'Arrow Right', category: 'Arrows', svg: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>' },
  { name: 'arrow-left', label: 'Arrow Left', category: 'Arrows', svg: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>' },
  { name: 'arrow-up', label: 'Arrow Up', category: 'Arrows', svg: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>' },
  { name: 'arrow-down', label: 'Arrow Down', category: 'Arrows', svg: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>' },
  { name: 'chevron-right', label: 'Chevron Right', category: 'Arrows', svg: '<polyline points="9 18 15 12 9 6"/>' },
  { name: 'chevron-down', label: 'Chevron Down', category: 'Arrows', svg: '<polyline points="6 9 12 15 18 9"/>' },
  { name: 'refresh-cw', label: 'Refresh', category: 'Arrows', svg: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>' },
  { name: 'home', label: 'Home', category: 'UI', svg: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { name: 'settings', label: 'Settings', category: 'UI', svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
  { name: 'search', label: 'Search', category: 'UI', svg: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
  { name: 'bell', label: 'Bell', category: 'UI', svg: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
  { name: 'star', label: 'Star', category: 'UI', svg: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
  { name: 'heart', label: 'Heart', category: 'UI', svg: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
  { name: 'check', label: 'Check', category: 'UI', svg: '<polyline points="20 6 9 17 4 12"/>' },
  { name: 'x', label: 'Close', category: 'UI', svg: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' },
  { name: 'plus', label: 'Plus', category: 'UI', svg: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' },
  { name: 'minus', label: 'Minus', category: 'UI', svg: '<line x1="5" y1="12" x2="19" y2="12"/>' },
  { name: 'users', label: 'Users', category: 'Business', svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { name: 'user', label: 'User', category: 'Business', svg: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
  { name: 'briefcase', label: 'Briefcase', category: 'Business', svg: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>' },
  { name: 'building', label: 'Building', category: 'Business', svg: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>' },
  { name: 'calendar', label: 'Calendar', category: 'Business', svg: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
  { name: 'clock', label: 'Clock', category: 'Business', svg: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
  { name: 'mail', label: 'Mail', category: 'Business', svg: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>' },
  { name: 'image', label: 'Image', category: 'Media', svg: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
  { name: 'video', label: 'Video', category: 'Media', svg: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>' },
  { name: 'music', label: 'Music', category: 'Media', svg: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  { name: 'camera', label: 'Camera', category: 'Media', svg: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>' },
  { name: 'play', label: 'Play', category: 'Media', svg: '<polygon points="5 3 19 12 5 21 5 3"/>' },
  { name: 'download', label: 'Download', category: 'Media', svg: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
];

const CATEGORIES = ['All', 'Arrows', 'UI', 'Business', 'Media'];

interface Props {
  onSelect: (iconHtml: string) => void;
  onClose: () => void;
}

export default function IconPickerModal({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [color, setColor] = useState('#1d1d1f');
  const [size, setSize] = useState(48);

  const filtered = useMemo(() => {
    return ICONS.filter((icon) => {
      const matchCat = category === 'All' || icon.category === category;
      const keyword = search.toLowerCase();
      const matchSearch = !keyword || icon.label.toLowerCase().includes(keyword) || icon.name.includes(keyword);
      return matchCat && matchSearch;
    });
  }, [search, category]);

  const handleSelect = (icon: IconDef) => {
    const html = `<div class="sf-icon" style="position:absolute;left:580px;top:320px;width:${size}px;height:${size}px;color:${color};display:inline-flex;align-items:center;justify-content:center;"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${icon.svg}</svg></div>`;
    onSelect(html);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sf-panel flex flex-col" style={{ width: 560, maxHeight: '80vh', borderRadius: 20, background: 'rgba(255,255,255,0.96)' }}>
        <div className="flex items-center justify-between p-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <span className="text-sm font-semibold text-[#1d1d1f]">アイコンを追加</span>
          <button onClick={onClose} className="sf-icon-btn">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 flex-shrink-0 space-y-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b] pointer-events-none" />
            <input
              type="text"
              placeholder="検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sf-input w-full pl-8"
            />
          </div>

          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="px-2.5 py-1 text-xs rounded-lg transition-all"
                style={category === cat
                  ? { background: 'rgba(0,122,255,0.1)', border: '1px solid rgba(0,122,255,0.22)', color: '#007AFF' }
                  : { background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', color: '#86868b' }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#86868b]">色</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#86868b]">サイズ</label>
              <input
                type="range"
                min={16}
                max={120}
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value, 10))}
                className="w-20 sf-range"
              />
              <span className="text-xs text-[#86868b] w-8">{size}px</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-8 gap-1">
            {filtered.map((icon) => (
              <button
                key={icon.name}
                onClick={() => handleSelect(icon)}
                title={icon.label}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-105"
                style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,122,255,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dangerouslySetInnerHTML={{ __html: icon.svg }}
                />
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-[#86868b]">
              アイコンが見つかりません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
