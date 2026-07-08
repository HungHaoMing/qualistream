/**
 * ==================================================================
 * 📋 GOOGLE APPS SCRIPT (GAS) 后台设置指引
 * ==================================================================
 * 请在 Google Apps Script (https://script.google.com) 建立新专案，
 * 贴入以下程式码，并部署为「网路应用程式」(Web App)。
 *
 * 部署设定：
 * - 以「我」的身分执行
 * - 谁可以存取：「所有人」(Anyone)
 *
 * ─────────────────────────────────────────────────────────────────
 */

const SHEET_NAME_PROJECTS   = "Projects";
const SHEET_NAME_INTERVIEWS = "Interviews";
const SHEET_NAME_SEGMENTS   = "Segments";

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let result = {};
  try {
    if (action === "getAll") {
      result = {
        projects:   getSheetData(ss, SHEET_NAME_PROJECTS),
        interviews: getSheetData(ss, SHEET_NAME_INTERVIEWS),
        segments:   getSheetData(ss, SHEET_NAME_SEGMENTS)
      };
    }
  } catch(err) { result = { error: err.toString() }; }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let body, result = {};
  try {
    body = JSON.parse(e.postData.contents);
    const { action, payload } = body;
    if (action === "saveProject") {
      result = upsertRow(ss, SHEET_NAME_PROJECTS, payload, "id");
    } else if (action === "saveInterview") {
      result = upsertRow(ss, SHEET_NAME_INTERVIEWS, payload, "id");
    } else if (action === "saveSegments") {
      deleteRowsWhere(ss, SHEET_NAME_SEGMENTS, "interview_id", payload.interview_id);
      payload.segments.forEach(seg => {
        seg.interview_id = payload.interview_id;
        upsertRow(ss, SHEET_NAME_SEGMENTS, seg, "id");
      });
      result = { ok: true };
    } else if (action === "deleteInterview") {
      deleteRowsWhere(ss, SHEET_NAME_INTERVIEWS, "id", payload.id);
      deleteRowsWhere(ss, SHEET_NAME_SEGMENTS, "interview_id", payload.id);
      result = { ok: true };
    } else if (action === "deleteProject") {
      deleteRowsWhere(ss, SHEET_NAME_PROJECTS, "id", payload.id);
      result = { ok: true };
    }
  } catch(err) { result = { error: err.toString() }; }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(ss, name) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function upsertRow(ss, name, obj, keyField) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  const data = sheet.getDataRange().getValues();
  let headers;
  if (data.length === 0) {
    headers = Object.keys(obj);
    sheet.appendRow(headers);
  } else {
    headers = data[0];
    Object.keys(obj).forEach(k => {
      if (!headers.includes(k)) {
        headers.push(k);
        sheet.getRange(1, headers.length).setValue(k);
      }
    });
  }
  const rows = sheet.getDataRange().getValues();
  const keyCol = headers.indexOf(keyField);
  let found = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][keyCol]) === String(obj[keyField])) { found = i + 1; break; }
  }
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : "");
  if (found > 0) {
    sheet.getRange(found, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { ok: true };
}

function deleteRowsWhere(ss, name, field, value) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  const col = data[0].indexOf(field);
  if (col < 0) return;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col]) === String(value)) sheet.deleteRow(i + 1);
  }
}
