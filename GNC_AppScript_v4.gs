// ============================================================
//  GURU NANAK COLLEGE – Sports Selection 2026–27
//  Google Apps Script  |  Version 4
//  Sheet : https://docs.google.com/spreadsheets/d/1jgAraXG4HpyPHRrYn9-MSDhbwgE9QPZuElh6DR9CvK8
// ============================================================

const SPREADSHEET_ID    = "1jgAraXG4HpyPHRrYn9-MSDhbwgE9QPZuElh6DR9CvK8";
const DRIVE_FOLDER_NAME = "GNC Sports Certificates 2026-27";
const SHEET_SUBMISSIONS  = "Submissions";
const SHEET_ACHIEVEMENTS = "Achievements";

const SUBMISSION_HEADERS = [
  "Submission ID", "Timestamp", "Full Name", "Date of Birth",
  "Gender", "Contact Number", "Email ID",
  "School / Institution", "Board of Studies",
  "Game / Sport", "Game Level", "Game Ranking",
  "Total Achievements"
];
const ACHIEVEMENT_HEADERS = [
  "Submission ID", "Student Name", "Achievement #",
  "Representation Level", "Event Name & Details",
  "Standing", "Year", "Certificate Link(s)"
];

// ============================================================
//  doGet  – serves data to the monitoring dashboard
//  ?action=data   → full submissions + achievements JSON
//  ?action=stats  → summary counts only
//  (no action)    → health check
// ============================================================
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";

  if (action === "data") {
    try {
      const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
      const subSh   = ss.getSheetByName(SHEET_SUBMISSIONS);
      const achSh   = ss.getSheetByName(SHEET_ACHIEVEMENTS);

      const submissions  = sheetToObjects(subSh);
      const achievements = sheetToObjects(achSh);

      // Group achievements by Submission ID
      const achMap = {};
      achievements.forEach(a => {
        const sid = a["Submission ID"];
        if (!achMap[sid]) achMap[sid] = [];
        achMap[sid].push(a);
      });

      // Attach achievements to each submission
      submissions.forEach(s => {
        s.achievements = achMap[s["Submission ID"]] || [];
      });

      return jsonResponse({ status: "ok", data: submissions });
    } catch (err) {
      return jsonResponse({ status: "error", message: err.message });
    }
  }

  if (action === "stats") {
    try {
      const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
      const subSh = ss.getSheetByName(SHEET_SUBMISSIONS);
      const rows  = sheetToObjects(subSh);

      const byGame   = {};
      const byGender = {};
      const byLevel  = {};
      rows.forEach(r => {
        const g = r["Game / Sport"] || "Unknown";
        const gender = r["Gender"]   || "Unknown";
        const level  = r["Game Level"] || "—";
        byGame[g]     = (byGame[g]     || 0) + 1;
        byGender[gender] = (byGender[gender] || 0) + 1;
        byLevel[level]   = (byLevel[level]   || 0) + 1;
      });

      return jsonResponse({
        status: "ok",
        total: rows.length,
        byGame, byGender, byLevel
      });
    } catch (err) {
      return jsonResponse({ status: "error", message: err.message });
    }
  }

  return jsonResponse({ status: "ok", app: "GNC Sports Selection 2026-27" });
}

// ============================================================
//  doPost  – receives form submissions
// ============================================================
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
    const subSheet = ensureSheet(ss, SHEET_SUBMISSIONS,  SUBMISSION_HEADERS);
    const achSheet = ensureSheet(ss, SHEET_ACHIEVEMENTS, ACHIEVEMENT_HEADERS);

    const timestamp    = new Date();
    const submissionId = "GNC-" + timestamp.getTime();

    subSheet.appendRow([
      submissionId, timestamp,
      payload.name        || "",
      payload.dob         || "",
      payload.gender      || "",
      payload.contact     || "",
      payload.email       || "",
      payload.school      || "",
      payload.board       || "",
      payload.game        || "",
      payload.gameLevel   || "",
      payload.gameRanking || "",
      (payload.achievements || []).length
    ]);

    const folder = getDriveFolder(submissionId);
    (payload.achievements || []).forEach((ach, idx) => {
      const certLinks = [];
      (ach.certificates || []).forEach(cert => {
        try {
          const blob = Utilities.newBlob(Utilities.base64Decode(cert.data), cert.mimeType, cert.name);
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          certLinks.push(file.getUrl());
        } catch (fe) { Logger.log("File error: " + fe.message); }
      });
      achSheet.appendRow([
        submissionId, payload.name || "", idx + 1,
        ach.representation || "", ach.eventName || "",
        ach.standing || "", ach.year || "",
        certLinks.join("\n") || "No certificate uploaded"
      ]);
    });

    return jsonResponse({ status: "success", id: submissionId });
  } catch (err) {
    Logger.log("doPost error: " + err.message);
    return jsonResponse({ status: "error", message: err.message });
  }
}

// ============================================================
//  Helpers
// ============================================================
function sheetToObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i]; });
    return obj;
  });
}

function ensureSheet(ss, name, expectedHeaders) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); }
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(expectedHeaders);
    styleHeaderRow(sheet, expectedHeaders.length);
    return sheet;
  }
  const lastCol = sheet.getLastColumn();
  const existing = sheet.getRange(1, 1, 1, lastCol > 0 ? lastCol : 1).getValues()[0].map(h => String(h).trim());
  const headerMap = {};
  existing.forEach((h, i) => { if (h) headerMap[h] = i + 1; });
  let appended = false;
  expectedHeaders.forEach(h => {
    if (!headerMap[h]) {
      const nc = sheet.getLastColumn() + 1;
      sheet.getRange(1, nc).setValue(h);
      styleHeaderCell(sheet, 1, nc);
      appended = true;
    }
  });
  if (appended) sheet.setFrozenRows(1);
  return sheet;
}

function getDriveFolder(submissionId) {
  const q = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  const root = q.hasNext() ? q.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
  return root.createFolder(submissionId);
}

function styleHeaderRow(sheet, colCount) {
  sheet.getRange(1,1,1,colCount).setFontWeight("bold").setFontColor("#FFFFFF").setBackground("#0A2240").setWrap(true);
  sheet.setFrozenRows(1);
}
function styleHeaderCell(sheet, row, col) {
  sheet.getRange(row,col).setFontWeight("bold").setFontColor("#FFFFFF").setBackground("#0A2240").setWrap(true);
}
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("GNC Sports 2026–27")
    .addItem("Setup / Verify Sheets", "setupSheetsManually")
    .addItem("Get Web App URL", "showWebAppUrl")
    .addToUi();
}
function setupSheetsManually() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet(ss, SHEET_SUBMISSIONS,  SUBMISSION_HEADERS);
  ensureSheet(ss, SHEET_ACHIEVEMENTS, ACHIEVEMENT_HEADERS);
  SpreadsheetApp.getUi().alert("✅ Sheets created / verified successfully!");
}
function showWebAppUrl() {
  SpreadsheetApp.getUi().alert("Web App URL\n\n" + ScriptApp.getService().getUrl() + "\n\nPaste this into your HTML form as SCRIPT_URL.");
}
