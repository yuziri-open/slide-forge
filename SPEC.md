# SlideForge — HTML Slide Visual Editor

## 概要
任意のHTMLプレゼンテーションファイルを読み込み、Canva風のビジュアルエディタで要素を直接編集できるWebアプリ。

## 技術スタック
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **zustand** (状態管理)
- **interact.js** (ドラッグ&リサイズ)
- **react-colorful** (カラーピッカー)

## ページ構成
- `/` — ランディング（HTMLファイルアップロード）
- `/editor` — メインエディタ

## エディタ画面レイアウト
```
┌─────────────────────────────────────────────────────┐
│ ヘッダー: ファイル名 | Undo/Redo | Export | Settings│
├───────┬───────────────────────────────┬──────────────┤
│ Left  │         Canvas Area           │   Right      │
│ Panel │  ┌─────────────────────┐      │   Panel      │
│       │  │                     │      │              │
│ Slide │  │   Selected Slide    │      │ Properties   │
│ Nav   │  │   (WYSIWYG)         │      │ Inspector    │
│       │  │                     │      │              │
│ thumb │  └─────────────────────┘      │ - Position   │
│ thumb │                               │ - Size       │
│ thumb │                               │ - Colors     │
│ thumb │                               │ - Typography │
│ thumb │                               │ - Spacing    │
│       │                               │ - Border     │
├───────┴───────────────────────────────┴──────────────┤
│ フッター: Zoom | Slide X/N                           │
└─────────────────────────────────────────────────────┘
```

## コア機能

### 1. HTMLスライド読み込み
- ファイルアップロード（drag & drop対応）
- HTMLをパースし、`div.slide` または同等のスライド単位要素を検出
- 各スライドをサムネイル生成（Canvas APIでスナップショット）
- CSSはインラインスタイル・`<style>`タグ・CSS変数すべて保持

### 2. スライドナビゲーション（左パネル）
- サムネイル一覧（クリックで切り替え）
- ドラッグで順番変更
- スライド追加・複製・削除

### 3. キャンバスエリア（中央）
- 選択中スライドを実寸表示（1280×720ベース、ズーム対応）
- **iframe内にスライドHTMLを描画**
- iframe内のクリックイベントをキャプチャして要素選択
- 選択された要素にバウンディングボックス（青い枠 + リサイズハンドル）表示
- ダブルクリックでテキスト直接編集（contenteditable）

### 4. プロパティインスペクター（右パネル）
選択要素のスタイルをリアルタイム編集：

#### テキスト
- フォントファミリー（ドロップダウン）
- フォントサイズ（スライダー + 数値入力）
- フォントウェイト（100-900）
- 行間（line-height）
- 文字間隔（letter-spacing）
- テキスト配置（left/center/right）
- テキスト内容（テキストエリア）

#### カラー
- 文字色（カラーピッカー + 16進入力）
- 背景色
- ボーダー色

#### レイアウト
- Position (X, Y) — ドラッグまたは数値入力
- Size (W, H) — リサイズまたは数値入力
- Padding (top/right/bottom/left)
- Margin
- Border radius
- Border width

#### 表示
- Opacity（スライダー）
- Display (block/flex/grid/none)
- Overflow

### 5. グローバル設定
- CSS変数エディタ（:root のカスタムプロパティを一覧表示・編集）
  - テーマカラーの一括変更が可能
- Google Fonts の追加読み込み

### 6. Undo/Redo
- 操作履歴をスタックで管理
- Ctrl+Z / Ctrl+Shift+Z

### 7. エクスポート
- 編集済みHTMLをダウンロード（元のHTML構造を維持）
- スライド単体をPNG/SVGでエクスポート（オプション）

## HTMLパース仕様
### スライド検出ロジック
1. `div.slide`, `section.slide` を探す
2. 見つからない場合、`<section>` タグをスライド単位とする
3. それもない場合、`body > div` の直下子要素をスライド候補とする
4. ユーザーにスライドセレクタのカスタマイズを許可

### CSS処理
- `<style>` タグ内のCSSをパースし、CSS変数を抽出
- インラインスタイルはそのまま保持
- 外部CSSリンク（Google Fonts等）は保持

## iframe通信アーキテクチャ
```
Editor (React)  ←→  iframe (raw HTML slide)
  │                    │
  │  postMessage       │
  │  ─────────────→    │ "select-element" (x, y)
  │  ←─────────────    │ "element-selected" (xpath, computedStyles)
  │  ─────────────→    │ "update-style" (xpath, property, value)
  │  ─────────────→    │ "update-text" (xpath, newText)
  │  ←─────────────    │ "dom-updated" (serialized HTML)
  │  ─────────────→    │ "get-thumbnail" ()
  │  ←─────────────    │ "thumbnail" (dataURL)
```

iframe内にインジェクトするスクリプト：
- クリックイベントのキャプチャ
- 選択要素のハイライト（overlay div）
- postMessage経由でスタイル変更を適用
- DOM変更をシリアライズして親に通知

## デザインシステム
- **ダークテーマ**: エディタUIは暗い背景（#1a1a1a）で、キャンバスが際立つ
- **アクセントカラー**: #3B82F6 (blue-500) — 選択枠、アクティブ要素
- **フォント**: Inter (UI), Noto Sans JP (日本語)
- **アイコン**: Lucide Icons (shadcn/uiと統合)
- **角丸**: 小さめ (4px-8px) でシャープな印象
- **パネルの区切り**: リサイズ可能なスプリッター

## ディレクトリ構造
```
apps/slide-editor/
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Upload page
│   │   └── editor/
│   │       └── page.tsx      # Editor page
│   ├── components/
│   │   ├── editor/
│   │   │   ├── Canvas.tsx         # iframe wrapper + overlay
│   │   │   ├── SlideNavigator.tsx # Left panel thumbnails
│   │   │   ├── PropertyPanel.tsx  # Right panel inspector
│   │   │   ├── Toolbar.tsx        # Top bar
│   │   │   ├── CSSVarEditor.tsx   # CSS variables editor
│   │   │   └── ElementOverlay.tsx # Selection highlight
│   │   └── ui/                    # shadcn/ui components
│   ├── lib/
│   │   ├── html-parser.ts    # HTML→slides parser
│   │   ├── iframe-bridge.ts  # postMessage communication
│   │   ├── style-utils.ts    # CSS property helpers
│   │   └── history.ts        # Undo/Redo stack
│   ├── store/
│   │   └── editor-store.ts   # Zustand store
│   └── types/
│       └── editor.ts         # TypeScript types
└── sample.html               # Test file
```

## 最優先で実装するもの（MVP）
1. HTMLアップロード → スライド検出 → 表示
2. 要素クリック選択 → バウンディングボックス
3. テキスト直接編集
4. 色変更（文字色・背景色）
5. フォントサイズ変更
6. CSS変数エディタ（テーマカラー一括変更）
7. 編集済みHTMLエクスポート

## 起動
```bash
cd apps/slide-editor
npm install
npm run dev
# → http://localhost:3010
```
ポート: 3010（他アプリとの競合回避）
