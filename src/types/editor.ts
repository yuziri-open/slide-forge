export interface Slide {
  id: string;
  html: string; // outerHTML of the slide element only
}

export interface SelectedElement {
  xpath: string;
  tagName: string;
  computedStyles: Record<string, string>;
  rect: { left: number; top: number; width: number; height: number } | null;
  textContent: string;
  isGroup?: boolean;
  groupChildCount?: number;
  isLocked?: boolean;
}

export interface CSSVariable {
  name: string;
  value: string;
}

export interface EditorState {
  fileName: string;
  rawHTML: string;
  headHtml: string;
  slides: Slide[];
  currentSlideIndex: number;
  selectedElement: SelectedElement | null;
  multiSelect: string[]; // array of xpaths for multi-selected elements
  cssVariables: CSSVariable[];
  zoom: number;
  history: string[][];
  historyIndex: number;
  clipboard: string[] | null; // array of outerHTML strings

  // Cloud 永続化
  projectId: string | null;   // GAS上のプロジェクトID。nullは未保存
  isSaving: boolean;          // 保存中フラグ
  lastSavedAt: string | null; // 最終保存日時 (ISO 8601)

  // Actions
  loadHTML: (html: string, fileName: string) => void;
  setCurrentSlide: (index: number) => void;
  setSelectedElement: (element: SelectedElement | null) => void;
  setMultiSelect: (xpaths: string[]) => void;
  updateSlideHtml: (index: number, outerHtml: string) => void;
  updateCSSVariable: (name: string, value: string) => void;
  setZoom: (zoom: number) => void;
  undo: () => void;
  redo: () => void;
  exportHTML: () => string;
  setClipboard: (htmls: string[] | null) => void;
  addSlide: (html?: string) => void;
  deleteSlide: (index: number) => void;

  // Cloud Actions
  saveToCloud: () => Promise<void>;
  loadFromCloud: (id: string) => Promise<void>;
  setProjectId: (id: string | null) => void;
}
