// ============================================================
//  GURU NANAK COLLEGE – Sports Selection 2026–27
//  Google Apps Script  |  Version 6
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
//  doGet  – handles EVERYTHING via GET + JSONP (zero CORS issues)
//
//  ?action=submit&data={...}&callback=fn  ← form submission
//  ?action=data&callback=fn               ← dashboard read
//  ?action=stats&callback=fn              ← stats
//  (no action)                            ← health check
// ============================================================
function doGet(e) {
  const params   = (e && e.parameter) ? e.parameter : {};
  const action   = params.action   || "";
  const callback = params.callback || "";

  let result;

  // ── FORM SUBMISSION (replaces doPost entirely) ───────────────
  if (action === "submit") {
    try {
      const raw = params.data || "";
      if (!raw) throw new Error("No data received");

      // Apps Script auto-decodes URL params — do NOT call decodeURIComponent again
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch(parseErr) {
        // Fallback: try decoding once in case it wasn't auto-decoded
        payload = JSON.parse(decodeURIComponent(raw));
      }
      Logger.log("submit: received for " + payload.name + " | game=" + payload.game);

      const ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
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

      (payload.achievements || []).forEach((ach, idx) => {
        achSheet.appendRow([
          submissionId,
          payload.name       || "",
          idx + 1,
          ach.representation || "",
          ach.eventName      || "",
          ach.standing       || "",
          ach.year           || "",
          "No certificate uploaded"
        ]);
      });

      Logger.log("submit: saved as " + submissionId + " | rows written=" + (1 + (payload.achievements||[]).length));
      SpreadsheetApp.flush(); // force-commit all pending writes immediately
      result = { status: "success", id: submissionId };

    } catch (err) {
      Logger.log("submit error: " + err.message);
      result = { status: "error", message: err.message };
    }

  // ── DASHBOARD DATA ───────────────────────────────────────────
  } else if (action === "data") {
    try {
      const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
      const subSh   = ss.getSheetByName(SHEET_SUBMISSIONS);
      const achSh   = ss.getSheetByName(SHEET_ACHIEVEMENTS);

      const submissions  = sheetToObjects(subSh);
      const achievements = sheetToObjects(achSh);

      const achMap = {};
      achievements.forEach(a => {
        const sid = a["Submission ID"];
        if (!achMap[sid]) achMap[sid] = [];
        achMap[sid].push(a);
      });
      submissions.forEach(s => {
        s.achievements = achMap[s["Submission ID"]] || [];
      });

      result = { status: "ok", data: submissions };
    } catch (err) {
      result = { status: "error", message: err.message };
    }

  // ── STATS ────────────────────────────────────────────────────
  } else if (action === "stats") {
    try {
      const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
      const subSh = ss.getSheetByName(SHEET_SUBMISSIONS);
      const rows  = sheetToObjects(subSh);
      const byGame = {}, byGender = {}, byLevel = {};
      rows.forEach(r => {
        const g      = r["Game / Sport"] || "Unknown";
        const gender = r["Gender"]       || "Unknown";
        const level  = r["Game Level"]   || "—";
        byGame[g]        = (byGame[g]        || 0) + 1;
        byGender[gender] = (byGender[gender] || 0) + 1;
        byLevel[level]   = (byLevel[level]   || 0) + 1;
      });
      result = { status: "ok", total: rows.length, byGame, byGender, byLevel };
    } catch (err) {
      result = { status: "error", message: err.message };
    }

  // ── HEALTH CHECK ─────────────────────────────────────────────
  } else {
    result = { status: "ok", app: "GNC Sports Selection 2026-27", version: 6 };
  }

  // ── Always return JSONP if callback given, else plain JSON ────
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(result) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  doPost – kept as fallback (not used by the form anymore)
// ============================================================
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    return doGet({ parameter: { action: "submit", data: JSON.stringify(payload) } });
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
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
    headers.forEach((h, i) => {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
    });
    return obj;
  });
}

function ensureSheet(ss, name, expectedHeaders) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(expectedHeaders);
    styleHeaderRow(sheet, expectedHeaders.length);
    return sheet;
  }
  const lastCol  = sheet.getLastColumn();
  const existing = sheet.getRange(1, 1, 1, lastCol > 0 ? lastCol : 1)
                        .getValues()[0].map(h => String(h).trim());
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

function styleHeaderRow(sheet, colCount) {
  sheet.getRange(1, 1, 1, colCount)
       .setFontWeight("bold").setFontColor("#FFFFFF")
       .setBackground("#0A2240").setWrap(true);
  sheet.setFrozenRows(1);
}

function styleHeaderCell(sheet, row, col) {
  sheet.getRange(row, col)
       .setFontWeight("bold").setFontColor("#FFFFFF")
       .setBackground("#0A2240").setWrap(true);
}

// ============================================================
//  onOpen menu
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("GNC Sports 2026–27")
    .addItem("Setup / Verify Sheets", "setupSheetsManually")
    .addItem("Get Web App URL",        "showWebAppUrl")
    .addToUi();
}
function setupSheetsManually() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet(ss, SHEET_SUBMISSIONS,  SUBMISSION_HEADERS);
  ensureSheet(ss, SHEET_ACHIEVEMENTS, ACHIEVEMENT_HEADERS);
  SpreadsheetApp.getUi().alert("Sheets created / verified successfully!");
}
function showWebAppUrl() {
  SpreadsheetApp.getUi().alert(
    "Web App URL\n\n" + ScriptApp.getService().getUrl() +
    "\n\nPaste into index.html as SCRIPT_URL and dashboard.html as EXEC_URL."
  );
}
