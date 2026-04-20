/**
 * SlideForge GAS API クライアント
 * 目的: GAS Web App を通じて Google Spreadsheet にスライドプロジェクトを保存・読込する
 * 作成日: 2026-04-20
 *
 * GAS_API_URL 未設定時は全関数がシレントに失敗（既存機能に影響なし）
 *
 * 注意: GAS はリダイレクトするため credentials: 'omit', redirect: 'follow' が必須
 */

// GAS Web App URL。環境変数で設定するか、デプロイ後にここに直接貼り付ける。
const GAS_API_URL =
  process.env.NEXT_PUBLIC_GAS_SLIDE_API || '';

// ============================================================
// 型定義
// ============================================================

export interface ProjectSummary {
  projectId: string;
  fileName: string;
  updatedAt: string;
}

export interface ProjectData {
  projectId: string;
  fileName: string;
  headHtml: string;
  slides: { id: string; html: string }[];
  cssVariables: { name: string; value: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveResult {
  projectId: string;
  updatedAt: string;
  createdAt?: string;
}

// ============================================================
// 内部ヘルパー
// ============================================================

/**
 * GAS_API_URL が設定されているか確認する。
 * 未設定の場合は false を返し、呼び出し元で機能を無効化する。
 */
function isApiConfigured(): boolean {
  return typeof GAS_API_URL === 'string' && GAS_API_URL.trim().length > 0;
}

/**
 * GAS GET リクエスト共通処理
 * GAS はリダイレクトするため redirect: 'follow' が必須
 */
async function gasGet<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(GAS_API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
    // GAS は CORS ヘッダーを付けないため credentials は omit
    credentials: 'omit',
  });

  if (!res.ok) {
    throw new Error(`GAS GET failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`GAS error: ${data.message}`);
  }
  return data as T;
}

/**
 * GAS POST リクエスト共通処理
 */
async function gasPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_API_URL, {
    method: 'POST',
    redirect: 'follow',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`GAS POST failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`GAS error: ${data.message}`);
  }
  return data as T;
}

// ============================================================
// 公開 API
// ============================================================

/**
 * プロジェクト一覧を取得する（軽量: id/fileName/updatedAt のみ）
 * GAS_API_URL 未設定時は空配列を返す
 */
export async function listProjects(): Promise<ProjectSummary[]> {
  if (!isApiConfigured()) return [];

  const data = await gasGet<{ projects: ProjectSummary[] }>({ action: 'list' });
  return data.projects || [];
}

/**
 * プロジェクトの全データを取得する
 * @param id - プロジェクトID (UUID)
 */
export async function loadProject(id: string): Promise<ProjectData> {
  if (!isApiConfigured()) {
    throw new Error('GAS API URL is not configured');
  }

  return gasGet<ProjectData>({ action: 'load', id });
}

/**
 * プロジェクトを保存する（新規 or 上書き）
 * - projectId を指定すると上書き保存
 * - projectId を省略すると新規作成し、新しい projectId を返す
 * @param data - 保存するプロジェクトデータ
 */
export async function saveProject(data: Omit<ProjectData, 'createdAt' | 'updatedAt'>): Promise<SaveResult> {
  if (!isApiConfigured()) {
    throw new Error('GAS API URL is not configured');
  }

  return gasPost<SaveResult>({
    action: 'save',
    projectId:    data.projectId || undefined,
    fileName:     data.fileName,
    headHtml:     data.headHtml,
    slides:       data.slides,
    cssVariables: data.cssVariables,
  });
}

/**
 * プロジェクトを削除する
 * @param id - プロジェクトID (UUID)
 */
export async function deleteProject(id: string): Promise<void> {
  if (!isApiConfigured()) {
    throw new Error('GAS API URL is not configured');
  }

  await gasPost<{ deleted: boolean }>({ action: 'delete', projectId: id });
}
