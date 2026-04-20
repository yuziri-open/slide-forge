import { create } from 'zustand';
import { EditorState, Slide, SelectedElement, CSSVariable } from '@/types/editor';
import { parseHTMLSlides, exportUpdatedHTML } from '@/lib/html-parser';
import { saveProject, loadProject } from '@/lib/gas-api';

const BLANK_SLIDE_HTML = '<div class="slide" style="position:relative;width:1280px;height:720px;background:white;overflow:hidden;"></div>';

export const useEditorStore = create<EditorState>((set, get) => ({
  fileName: '',
  rawHTML: '',
  headHtml: '',
  slides: [],
  currentSlideIndex: 0,
  selectedElement: null,
  multiSelect: [],
  cssVariables: [],
  zoom: 0.75,
  history: [],
  historyIndex: -1,
  clipboard: null,

  // Cloud 永続化 state
  projectId: null,
  isSaving: false,
  lastSavedAt: null,

  loadHTML: (html: string, fileName: string) => {
    const { headHtml, slides, cssVariables } = parseHTMLSlides(html);
    set({
      fileName,
      rawHTML: html,
      headHtml,
      slides,
      currentSlideIndex: 0,
      selectedElement: null,
      multiSelect: [],
      cssVariables,
      history: [slides.map(s => s.html)],
      historyIndex: 0,
      clipboard: null,
    });
  },

  setCurrentSlide: (index: number) => {
    set({ currentSlideIndex: index, selectedElement: null, multiSelect: [] });
  },

  setSelectedElement: (element: SelectedElement | null) => {
    set({ selectedElement: element });
  },

  setMultiSelect: (xpaths: string[]) => {
    set({ multiSelect: xpaths });
  },

  updateSlideHtml: (index: number, outerHtml: string) => {
    const { slides, history, historyIndex } = get();
    const newSlides = slides.map((s, i) =>
      i === index ? { ...s, html: outerHtml } : s
    );
    // Push to history (trim redo stack)
    const newHistoryEntry = newSlides.map(s => s.html);
    const newHistory = history.slice(0, historyIndex + 1).concat([newHistoryEntry]);
    const trimmed = newHistory.slice(-50); // max 50 entries
    set({
      slides: newSlides,
      history: trimmed,
      historyIndex: trimmed.length - 1,
    });
  },

  updateCSSVariable: (name: string, value: string) => {
    const { cssVariables } = get();
    const newVars = cssVariables.map(v => v.name === name ? { ...v, value } : v);
    set({ cssVariables: newVars });
  },

  setZoom: (zoom: number) => {
    set({ zoom });
  },

  setClipboard: (htmls: string[] | null) => {
    set({ clipboard: htmls });
  },

  addSlide: (html?: string) => {
    const { slides, history, historyIndex } = get();
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      html: html ?? BLANK_SLIDE_HTML,
    };
    const newSlides = [...slides, newSlide];
    const newHistoryEntry = newSlides.map(s => s.html);
    const newHistory = history.slice(0, historyIndex + 1).concat([newHistoryEntry]);
    const trimmed = newHistory.slice(-50);
    set({
      slides: newSlides,
      currentSlideIndex: newSlides.length - 1,
      selectedElement: null,
      multiSelect: [],
      history: trimmed,
      historyIndex: trimmed.length - 1,
    });
  },

  deleteSlide: (index: number) => {
    const { slides, currentSlideIndex, history, historyIndex } = get();
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_, i) => i !== index);
    const newIndex = Math.min(currentSlideIndex, newSlides.length - 1);
    const newHistoryEntry = newSlides.map(s => s.html);
    const newHistory = history.slice(0, historyIndex + 1).concat([newHistoryEntry]);
    const trimmed = newHistory.slice(-50);
    set({
      slides: newSlides,
      currentSlideIndex: newIndex,
      selectedElement: null,
      multiSelect: [],
      history: trimmed,
      historyIndex: trimmed.length - 1,
    });
  },

  undo: () => {
    const { history, historyIndex, slides } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const slideHtmls = history[newIndex];
    const newSlides = slides.map((s, i) => ({
      ...s,
      html: slideHtmls[i] ?? s.html,
    }));
    set({ historyIndex: newIndex, slides: newSlides, selectedElement: null, multiSelect: [] });
  },

  redo: () => {
    const { history, historyIndex, slides } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const slideHtmls = history[newIndex];
    const newSlides = slides.map((s, i) => ({
      ...s,
      html: slideHtmls[i] ?? s.html,
    }));
    set({ historyIndex: newIndex, slides: newSlides, selectedElement: null, multiSelect: [] });
  },

  exportHTML: () => {
    const { rawHTML, slides, cssVariables } = get();
    return exportUpdatedHTML(rawHTML, slides, cssVariables);
  },

  // ============================================================
  // Cloud Actions
  // ============================================================

  /**
   * 現在のプロジェクトを GAS に保存する。
   * - projectId がある場合は上書き保存
   * - ない場合は新規作成し、返ってきた projectId を state に保存
   * - GAS_API_URL 未設定時は何もしない（エラーにしない）
   */
  saveToCloud: async () => {
    const { fileName, headHtml, slides, cssVariables, projectId } = get();
    if (typeof process !== 'undefined' &&
        !process.env.NEXT_PUBLIC_GAS_SLIDE_API) {
      // URL未設定: シレントにスキップ
      return;
    }

    set({ isSaving: true });
    try {
      const result = await saveProject({
        projectId: projectId || '',
        fileName:  fileName || 'untitled.html',
        headHtml,
        slides,
        cssVariables,
      });
      set({
        projectId:   result.projectId,
        lastSavedAt: result.updatedAt,
        isSaving:    false,
      });
    } catch (err) {
      console.error('[SlideForge] saveToCloud failed:', err);
      set({ isSaving: false });
      throw err;
    }
  },

  /**
   * GAS から指定 projectId のデータを読み込み、エディタ状態を置き換える。
   * rawHTML はスライドと headHtml から再構築する。
   */
  loadFromCloud: async (id: string) => {
    const data = await loadProject(id);

    // slides と headHtml から rawHTML を再組み立て（exportUpdatedHTML 互換）
    const slidesHtml = data.slides.map(s => s.html).join('\n');
    const reconstructedRaw = `<!DOCTYPE html><html><head>${data.headHtml}</head><body>${slidesHtml}</body></html>`;

    set({
      projectId:         data.projectId,
      fileName:          data.fileName,
      headHtml:          data.headHtml,
      rawHTML:           reconstructedRaw,
      slides:            data.slides,
      cssVariables:      data.cssVariables,
      currentSlideIndex: 0,
      selectedElement:   null,
      multiSelect:       [],
      history:           [data.slides.map(s => s.html)],
      historyIndex:      0,
      clipboard:         null,
      lastSavedAt:       data.updatedAt || null,
    });
  },

  /**
   * projectId を直接セットする。
   * GAS から一覧を選んで開く際など外部から ID を注入する用途。
   */
  setProjectId: (id: string | null) => {
    set({ projectId: id });
  },
}));
