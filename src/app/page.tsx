'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cloud, FileText, Loader2, Trash2, Upload, Zap } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { listProjects, deleteProject, type ProjectSummary } from '@/lib/gas-api';

// GAS_API_URL が設定されているか確認（クライアントサイド）
const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_SLIDE_API || '';
const isCloudEnabled = GAS_API_URL.trim().length > 0;

export default function HomePage() {
  const router = useRouter();
  const loadHTML = useEditorStore((s) => s.loadHTML);
  const loadFromCloud = useEditorStore((s) => s.loadFromCloud);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  // クラウドプロジェクト一覧
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // クラウドプロジェクト一覧を取得
  const fetchProjects = useCallback(async () => {
    if (!isCloudEnabled) return;
    setProjectsLoading(true);
    setProjectsError('');
    try {
      const list = await listProjects();
      setProjects(list);
    } catch (err) {
      console.error('[HomePage] fetchProjects failed:', err);
      setProjectsError('プロジェクト一覧の取得に失敗しました');
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // クラウドプロジェクトを開く
  const handleLoadProject = useCallback(async (id: string) => {
    if (loadingId) return;
    setLoadingId(id);
    try {
      await loadFromCloud(id);
      router.push('/editor');
    } catch (err) {
      console.error('[HomePage] loadFromCloud failed:', err);
      alert('プロジェクトの読み込みに失敗しました');
    } finally {
      setLoadingId(null);
    }
  }, [loadFromCloud, loadingId, router]);

  // クラウドプロジェクトを削除
  const handleDeleteProject = useCallback(async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？この操作は元に戻せません。`)) return;
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.projectId !== id));
    } catch (err) {
      console.error('[HomePage] deleteProject failed:', err);
      alert('削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      setError('HTMLファイルを選択してください');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const html = e.target?.result as string;
      loadHTML(html, file.name);
      router.push('/editor');
    };
    reader.readAsText(file, 'UTF-8');
  }, [loadHTML, router]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="min-h-screen bg-[#f0f0f5] flex flex-col items-center justify-center p-8">
      <div className="mb-12 text-center">
        <div className="flex items-center gap-3 mb-3 justify-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: '#007AFF' }}
          >
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#1d1d1f]">SlideForge</h1>
        </div>
        <p className="text-[#86868b] text-lg">HTMLプレゼンをビジュアル編集</p>
      </div>

      <div
        className={`
          relative w-full max-w-2xl border-2 border-dashed rounded-[28px] p-16
          flex flex-col items-center justify-center cursor-pointer transition-all duration-200
          ${isDragging
            ? 'border-[#007AFF] bg-[rgba(0,122,255,0.06)]'
            : 'border-[#c7c7cc] bg-white hover:border-[#007AFF] hover:bg-[rgba(255,255,255,0.96)]'
          }
        `}
        style={{ boxShadow: '0 18px 50px rgba(15,23,42,0.08)' }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".html,.htm"
          className="hidden"
          onChange={handleFileInput}
        />

        <div
          className={`w-20 h-20 rounded-[24px] flex items-center justify-center mb-6 transition-colors ${
            isDragging ? 'bg-[rgba(0,122,255,0.08)]' : 'bg-[rgba(0,0,0,0.04)]'
          }`}
        >
          <Upload className={`w-10 h-10 transition-colors ${isDragging ? 'text-[#007AFF]' : 'text-[#86868b]'}`} />
        </div>

        <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">
          HTMLファイルをドロップ
        </h2>
        <p className="text-[#86868b] text-sm mb-6">
          またはクリックしてファイルを選択
        </p>

        <div className="flex items-center gap-2 text-xs text-[#86868b]">
          <FileText className="w-4 h-4" />
          <span>.html / .htm ファイル対応</span>
        </div>

        {error && (
          <p className="mt-4 text-[#ff3b30] text-sm">{error}</p>
        )}
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl w-full">
        {[
          { icon: '⌘', title: '直感的な編集', desc: 'クリックして選択し、その場でレイアウトを調整できます。' },
          { icon: '◌', title: 'CSSスタイル編集', desc: '色や文字、余白まで UI から直接編集できます。' },
          { icon: '↺', title: 'ライブプレビュー', desc: '編集内容を保ったまま HTML として書き出せます。' },
        ].map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl p-5"
            style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <div className="text-2xl mb-3 text-[#007AFF]">{feature.icon}</div>
            <h3 className="font-medium text-[#1d1d1f] text-sm mb-1">{feature.title}</h3>
            <p className="text-[#86868b] text-xs leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Cloud Projects セクション: GAS_API_URL が設定されている場合のみ表示 */}
      {isCloudEnabled && (
        <div className="mt-12 w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#5856D6]" />
              <h2 className="text-sm font-semibold text-[#1d1d1f]">Cloud Projects</h2>
            </div>
            <button
              onClick={fetchProjects}
              disabled={projectsLoading}
              className="text-xs text-[#007AFF] hover:opacity-70 transition-opacity disabled:opacity-40"
            >
              {projectsLoading ? '読み込み中...' : '更新'}
            </button>
          </div>

          {projectsError && (
            <div className="rounded-2xl px-4 py-3 text-xs text-[#FF3B30] mb-3"
              style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.14)' }}>
              {projectsError}
            </div>
          )}

          {projectsLoading && projects.length === 0 ? (
            <div className="rounded-2xl px-4 py-8 flex items-center justify-center gap-2"
              style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)' }}>
              <Loader2 className="w-4 h-4 text-[#86868b] animate-spin" />
              <span className="text-xs text-[#86868b]">読み込み中...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl px-4 py-8 text-center"
              style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-xs text-[#86868b]">保存されたプロジェクトはありません</p>
              <p className="text-xs text-[#c7c7cc] mt-1">エディタの「Save」ボタンで保存できます</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.projectId}
                  className="flex items-center justify-between rounded-2xl px-4 py-3"
                  style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1d1d1f] truncate">{project.fileName}</p>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      {project.updatedAt
                        ? new Date(project.updatedAt).toLocaleString('ja-JP', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })
                        : '—'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    {/* 読み込みボタン */}
                    <button
                      onClick={() => handleLoadProject(project.projectId)}
                      disabled={loadingId === project.projectId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50"
                      style={{ background: 'rgba(0,122,255,0.1)', border: '1px solid rgba(0,122,255,0.2)', color: '#007AFF' }}
                    >
                      {loadingId === project.projectId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      開く
                    </button>

                    {/* 削除ボタン */}
                    <button
                      onClick={() => handleDeleteProject(project.projectId, project.fileName)}
                      disabled={deletingId === project.projectId}
                      className="flex items-center justify-center w-7 h-7 rounded-xl transition-all hover:opacity-80 disabled:opacity-50"
                      style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.14)', color: '#FF3B30' }}
                      title="削除"
                    >
                      {deletingId === project.projectId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
