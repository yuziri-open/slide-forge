/**
 * SlideForge GAS Web App
 * 目的: Next.js スライドエディタのプロジェクトデータをSpreadsheetに永続化する
 * 作成日: 2026-04-20
 * 依頼元: Jack (COO) / Forge (Dev)
 *
 * デプロイ方法: gas/README.md を参照
 *
 * Spreadsheet構造 (シート名: projects):
 *   A: projectId (UUID)
 *   B: fileName
 *   C: headHtml
 *   D: slidesJson  (JSON.stringify(slides))
 *   E: cssVarsJson (JSON.stringify(cssVariables))
 *   F: createdAt   (ISO 8601)
 *   G: updatedAt   (ISO 8601)
 *
 * API:
 *   GET  ?action=list              → プロジェクト一覧 (id/fileName/updatedAt)
 *   GET  ?action=load&id={id}      → プロジェクト全データ
 *   POST action=save               → 新規作成 or 上書き保存
 *   POST action=delete&id={id}     → 削除
 */

// ============================================================
// 設定: デプロイ時にこの値を書き換える
// ============================================================
var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // SpreadsheetのURL末尾のID
var SHEET_NAME = 'projects';

// ============================================================
// エントリーポイント
// ============================================================

/**
 * GETリクエストハンドラ
 * @param {GoogleAppsScript.Events.DoGet} e
 */
function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) || '';

    if (action === 'list') {
      return handleList();
    }

    if (action === 'load') {
      var id = e.parameter.id || '';
      if (!id) return errorResponse('id is required');
      return handleLoad(id);
    }

    return errorResponse('Unknown action: ' + action);

  } catch (err) {
    return errorResponse('Server error: ' + err.message);
  }
}

/**
 * POSTリクエストハンドラ
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  try {
    var action = (e.parameter && e.parameter.action) || '';

    // action=save はbodyのJSONから取得することもある
    var body = {};
    if (e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
        // bodyにactionがあればそちらを優先
        if (body.action) action = body.action;
      } catch (parseErr) {
        return errorResponse('Invalid JSON body: ' + parseErr.message);
      }
    }

    if (action === 'save') {
      return handleSave(body);
    }

    if (action === 'delete') {
      var id = (e.parameter && e.parameter.id) || body.projectId || '';
      if (!id) return errorResponse('id is required');
      return handleDelete(id);
    }

    return errorResponse('Unknown action: ' + action);

  } catch (err) {
    return errorResponse('Server error: ' + err.message);
  }
}

// ============================================================
// ハンドラ実装
// ============================================================

/**
 * 一覧取得: projectId / fileName / updatedAt のみ返す（軽量）
 */
function handleList() {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();

  // ヘッダー行がある場合はスキップ（1行目がヘッダーの場合）
  // 本実装ではヘッダーなし。全行をデータとして扱う
  var projects = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    // 空行スキップ
    if (!row[0]) continue;
    projects.push({
      projectId: row[0],
      fileName:  row[1],
      updatedAt: row[6]
    });
  }

  // updatedAt 降順ソート（新しいものが上）
  projects.sort(function(a, b) {
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });

  return jsonResponse({ projects: projects });
}

/**
 * プロジェクト全データ取得
 * @param {string} id
 */
function handleLoad(id) {
  var sheet = getSheet();
  var rowIndex = findRowIndexById(sheet, id);

  if (rowIndex === -1) {
    return errorResponse('Project not found: ' + id, 404);
  }

  var row = sheet.getRange(rowIndex + 1, 1, 1, 7).getValues()[0];

  var slides = [];
  var cssVariables = [];

  try { slides = JSON.parse(row[3] || '[]'); } catch(e) { slides = []; }
  try { cssVariables = JSON.parse(row[4] || '[]'); } catch(e) { cssVariables = []; }

  return jsonResponse({
    projectId:    row[0],
    fileName:     row[1],
    headHtml:     row[2],
    slides:       slides,
    cssVariables: cssVariables,
    createdAt:    row[5],
    updatedAt:    row[6]
  });
}

/**
 * 保存（新規 or 上書き）
 * @param {Object} body - { projectId?, fileName, headHtml, slides, cssVariables }
 */
function handleSave(body) {
  if (!body.fileName) return errorResponse('fileName is required');

  var sheet = getSheet();
  var now = new Date().toISOString();

  // slidesとcssVariablesはJSON文字列に変換
  var slidesJson   = JSON.stringify(body.slides || []);
  var cssVarsJson  = JSON.stringify(body.cssVariables || []);
  var headHtml     = body.headHtml || '';

  if (body.projectId) {
    // 上書き保存
    var rowIndex = findRowIndexById(sheet, body.projectId);

    if (rowIndex === -1) {
      // IDが指定されているが見つからない場合は新規作成
      return insertNewProject(sheet, body.projectId, body.fileName, headHtml, slidesJson, cssVarsJson, now);
    }

    // 既存行を更新 (createdAt = F列 は変えない)
    var range = sheet.getRange(rowIndex + 1, 1, 1, 7);
    var existingRow = range.getValues()[0];
    var createdAt = existingRow[5] || now;

    range.setValues([[
      body.projectId,
      body.fileName,
      headHtml,
      slidesJson,
      cssVarsJson,
      createdAt,
      now
    ]]);

    return jsonResponse({ projectId: body.projectId, updatedAt: now });

  } else {
    // 新規作成
    var newId = generateUUID();
    return insertNewProject(sheet, newId, body.fileName, headHtml, slidesJson, cssVarsJson, now);
  }
}

/**
 * 削除
 * @param {string} id
 */
function handleDelete(id) {
  var sheet = getSheet();
  var rowIndex = findRowIndexById(sheet, id);

  if (rowIndex === -1) {
    return errorResponse('Project not found: ' + id, 404);
  }

  sheet.deleteRow(rowIndex + 1);
  return jsonResponse({ deleted: true, projectId: id });
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * Spreadsheetのprojectsシートを取得（なければ作成）
 */
function getSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

/**
 * projectIdで行インデックスを検索（0始まり）
 * 見つからない場合は -1
 */
function findRowIndexById(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === id) return i;
  }
  return -1;
}

/**
 * 新規行を末尾に追加してレスポンスを返す
 */
function insertNewProject(sheet, projectId, fileName, headHtml, slidesJson, cssVarsJson, now) {
  sheet.appendRow([projectId, fileName, headHtml, slidesJson, cssVarsJson, now, now]);
  return jsonResponse({ projectId: projectId, createdAt: now, updatedAt: now });
}

/**
 * UUID v4 生成（GASにはcrypto.randomUUIDがないため手動実装）
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * JSON レスポンスを返す（CORS対応）
 * GASはリダイレクトするためクライアント側は redirect:'follow' が必要
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * エラーレスポンス
 * @param {string} message
 * @param {number} [code]
 */
function errorResponse(message, code) {
  return jsonResponse({
    error: true,
    message: message,
    code: code || 400
  });
}
