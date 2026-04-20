# SlideForge GAS Web App — デプロイ手順

## 概要

Google Apps Script を Web App としてデプロイし、Next.js スライドエディタのプロジェクトデータを Google Spreadsheet に永続化する。

---

## 1. Spreadsheet の準備

1. [Google Spreadsheet](https://sheets.google.com) で新規スプレッドシートを作成
2. シート名を `projects` に変更（シートタブをダブルクリックして変更）
3. URL からスプレッドシートIDをコピー
   - URL 例: `https://docs.google.com/spreadsheets/d/1ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn/edit`
   - スプレッドシートID: `1ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn`

---

## 2. GAS プロジェクトの作成

1. [Google Apps Script](https://script.google.com/) にアクセス
2. 「新しいプロジェクト」をクリック
3. `Code.gs` の内容を貼り付け（既存内容を全削除してから）
4. 冒頭の定数を設定:

```javascript
var SPREADSHEET_ID = 'ここにスプレッドシートIDを貼り付ける';
var SHEET_NAME = 'projects'; // シート名を変えた場合のみ変更
```

5. 「保存」（Ctrl+S）

---

## 3. Web App としてデプロイ

1. 「デプロイ」→「新しいデプロイ」をクリック
2. 種類の選択:「ウェブアプリ」を選択
3. 設定:
   - 説明: `SlideForge API v1`
   - 次のユーザーとして実行: **自分（あなたのGoogleアカウント）**
   - アクセスできるユーザー: **全員**（匿名を含む）
4. 「デプロイ」をクリック
5. 権限承認ダイアログが出たら「アクセスを承認」→ Googleアカウントでログイン → 「許可」
6. デプロイ完了後、「ウェブアプリのURL」をコピー
   - 例: `https://script.google.com/macros/s/AKfycby.../exec`

---

## 4. フロントエンドへの設定

Next.js アプリの `.env.local` に URL を設定:

```env
NEXT_PUBLIC_GAS_SLIDE_API=https://script.google.com/macros/s/AKfycby.../exec
```

または `src/lib/gas-api.ts` の定数を直接書き換え:

```typescript
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycby.../exec';
```

---

## 5. 動作確認

### 一覧取得（ブラウザから確認可能）

```
https://script.google.com/macros/s/{YOUR_ID}/exec?action=list
```

期待レスポンス:
```json
{"projects":[]}
```

### curl で確認

```bash
# 一覧取得
curl -sL "https://script.google.com/macros/s/{YOUR_ID}/exec?action=list"

# 保存テスト
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"save","fileName":"test.html","headHtml":"","slides":[{"id":"s1","html":"<div>test</div>"}],"cssVariables":[]}' \
  "https://script.google.com/macros/s/{YOUR_ID}/exec"
```

> `-sL` の `-L` はリダイレクト追跡。GAS は必ずリダイレクトするため必須。

---

## 6. 更新デプロイ（Code.gs を変更した場合）

1. 「デプロイ」→「デプロイを管理」
2. 鉛筆アイコン（編集）をクリック
3. バージョン: 「新しいバージョン」を選択
4. 「デプロイ」をクリック

> URL は変わらない（同じ exec URL を使い続けられる）

---

## 7. Spreadsheet 列定義

| 列 | 内容 | 型 |
|----|------|----|
| A  | projectId | UUID文字列 |
| B  | fileName | 文字列 |
| C  | headHtml | HTML文字列 |
| D  | slidesJson | JSON文字列 |
| E  | cssVarsJson | JSON文字列 |
| F  | createdAt | ISO 8601文字列 |
| G  | updatedAt | ISO 8601文字列 |

---

## 8. トラブルシューティング

### `{"error":true,"message":"...")` が返ってくる

- `SPREADSHEET_ID` が正しいか確認
- Spreadsheet に `projects` シートがあるか確認
- GAS の実行ユーザーがそのスプレッドシートにアクセス権を持っているか確認

### CORS エラーが出る

- GAS は CORS ヘッダーを付与しない仕様。フロントエンドから直接 `fetch` する場合はブラウザの CORS 制限がかかる
- 回避策: `mode: 'no-cors'` は使えない（レスポンスが読めない）
- 正しい回避策: GAS の `ContentService` を使っているため、通常は問題ない。もし発生する場合は Next.js API Route (proxy) 経由にする

### 保存が反映されない

- GAS の実行ログを確認（スクリプトエディタ →「実行数」）
- デプロイが最新バージョンを指しているか確認
