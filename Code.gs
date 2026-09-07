/* =========================================================
   CASE TRACKING + SECURITY KEY + OTP
   GOOGLE APPS SCRIPT
   ---------------------------------------------------------
   ستون I = redirectUrl / Link
   لینک ستون I دستکاری یا منتقل نمی‌شود.
   ========================================================= */

const SHEET_NAME = "Sheet1";
const OTP_WAIT_SECONDS = 60;

function doGet(e) {
  try {
    e = e || {};
    const params = e.parameter || {};
    const action = String(params.action || "").trim();

    if (!action) {
      return jsonOutput({
        success: true,
        message: "Case Tracking API is running.",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "checkStatus") {
      return jsonOutput(
        checkStatus(String(params.sessionId || "").trim())
      );
    }

    return jsonOutput({
      success: false,
      message: "Action نامعتبر است."
    });

  } catch (error) {
    return jsonOutput({
      success: false,
      message: error.message
    });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOutput({
        success: false,
        message: "POST data موجود نیست."
      });
    }

    let data = {};

    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return jsonOutput({
        success: false,
        message: "اطلاعات ارسالی JSON معتبر نیست."
      });
    }

    const action = String(data.action || "").trim();

    if (action === "verifySecurity") {
      return jsonOutput(verifySecurity(data));
    }

    if (action === "requestOTP") {
      return jsonOutput(requestOTP(data));
    }

    return jsonOutput({
      success: false,
      message: "Action نامعتبر است."
    });

  } catch (error) {
    return jsonOutput({
      success: false,
      message: error.message
    });
  }
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  createHeaders(sheet);
  return sheet;
}

function createHeaders(sheet) {
  /*
    A sessionId
    B caseName
    C trackingNumber
    D caseYear
    E caseMonth
    F otp
    G adminStatus
    H waiting
    I redirectUrl  <-- فقط لینک
    J captchaInput
    K securityVerified
    L createdAt
    M updatedAt
  */

  const headers = [
    "sessionId",
    "caseName",
    "trackingNumber",
    "caseYear",
    "caseMonth",
    "otp",
    "adminStatus",
    "waiting",
    "redirectUrl",
    "captchaInput",
    "securityVerified",
    "createdAt",
    "updatedAt"
  ];

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);
  } else {
    const current = sheet
      .getRange(1, 1, 1, headers.length)
      .getValues()[0];

    let changed = false;

    for (let i = 0; i < headers.length; i++) {
      if (String(current[i] || "").trim() === "") {
        current[i] = headers[i];
        changed = true;
      }
    }

    if (changed) {
      sheet
        .getRange(1, 1, 1, headers.length)
        .setValues([current]);
    }
  }

  sheet.setFrozenRows(1);
}

function findRow(sheet, sessionId) {
  if (!sessionId) return 0;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const values = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues();

  for (let i = 0; i < values.length; i++) {
    if (
      String(values[i][0] || "").trim() === sessionId
    ) {
      return i + 2;
    }
  }

  return 0;
}

function createRow(sheet, sessionId) {
  let row = findRow(sheet, sessionId);

  if (row) return row;

  row = sheet.getLastRow() + 1;
  const now = new Date();

  /*
    IMPORTANT:
    Column I is intentionally blank for a newly-created session.
    Existing links in existing rows are never overwritten.
  */
  sheet.getRange(row, 1, 1, 13).setValues([[
    sessionId,       // A
    "",              // B
    "",              // C
    "",              // D
    "",              // E
    "",              // F
    "",              // G
    false,           // H
    "",              // I = Link
    "",              // J
    false,           // K
    now,             // L
    now              // M
  ]]);

  return row;
}

function verifySecurity(data) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const sheet = getSheet();
    const sessionId = String(data.sessionId || "").trim();

    if (!sessionId) {
      return {
        success: false,
        message: "sessionId موجود نیست."
      };
    }

    const caseName = String(data.caseName || "").trim();
    const trackingNumber =
      String(data.trackingNumber || "").trim();

    let caseYear = String(data.caseYear || "").trim();
    let caseMonth = String(data.caseMonth || "").trim();

    const yearMonth =
      String(data.yearMonth || "").trim();

    if (!caseYear && !caseMonth && yearMonth) {
      const parts = yearMonth.split("/");

      if (parts.length === 2) {
        caseYear = String(parts[0]).trim();
        caseMonth = String(parts[1]).trim();
      }
    }

    const captchaInput =
      String(data.captchaInput || "").trim();

    if (!caseName) {
      return {
        success: false,
        message: "اسم پرونده را وارد کنید."
      };
    }

    if (!trackingNumber) {
      return {
        success: false,
        message: "شماره پیگیری پرونده را وارد کنید."
      };
    }

    if (!caseYear) {
      return {
        success: false,
        message: "سال را انتخاب کنید."
      };
    }

    if (!caseMonth) {
      return {
        success: false,
        message: "ماه را انتخاب کنید."
      };
    }

    if (!captchaInput) {
      return {
        success: false,
        message: "عدد تصویر امنیتی را وارد کنید."
      };
    }

    const row = createRow(sheet, sessionId);
    const now = new Date();

    sheet
      .getRange(row, 2, 1, 4)
      .setValues([[
        caseName,
        trackingNumber,
        caseYear,
        caseMonth
      ]]);

    sheet.getRange(row, 10).setValue(captchaInput);
    sheet.getRange(row, 11).setValue(true);

    /*
      OTP fields are reset.
      Column I is NOT touched.
    */
    sheet
      .getRange(row, 6, 1, 3)
      .setValues([["", "", false]]);

    sheet.getRange(row, 13).setValue(now);

    SpreadsheetApp.flush();

    return {
      success: true,
      sessionId: sessionId,
      securityVerified: true,
      message:
        "اطلاعات پرونده و Security Key با موفقیت ثبت شد."
    };

  } catch (error) {
    return {
      success: false,
      message: error.message
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function generateOTP() {
  const min = 100000;
  const max = 999999;

  return String(
    Math.floor(
      Math.random() * (max - min + 1)
    ) + min
  );
}

function requestOTP(data) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const sheet = getSheet();
    const sessionId =
      String(data.sessionId || "").trim();

    if (!sessionId) {
      return {
        success: false,
        message: "sessionId موجود نیست."
      };
    }

    const row = findRow(sheet, sessionId);

    if (!row) {
      return {
        success: false,
        message:
          "ابتدا Verify Security Key را انجام دهید."
      };
    }

    const securityVerified =
      sheet.getRange(row, 11).getValue();

    const securityOK =
      securityVerified === true ||
      String(securityVerified)
        .trim()
        .toLowerCase() === "true";

    if (!securityOK) {
      return {
        success: false,
        message: "Security Key تأیید نشده است."
      };
    }

    const otp = generateOTP();
    const now = new Date();

    sheet.getRange(row, 6).setNumberFormat("@");
    sheet.getRange(row, 6).setValue(otp);
    sheet.getRange(row, 7).setValue("");
    sheet.getRange(row, 8).setValue(true);
    sheet.getRange(row, 13).setValue(now);

    /*
      Column I / redirectUrl is NOT modified.
    */

    SpreadsheetApp.flush();

    return {
      success: true,
      sessionId: sessionId,
      waiting: true,
      otp: otp,
      countdown: OTP_WAIT_SECONDS,
      message:
        "OTP با موفقیت ایجاد و در Google Sheet ثبت شد."
    };

  } catch (error) {
    return {
      success: false,
      message: error.message
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function normalizeRedirectUrl(value) {
  let url = String(value || "").trim();

  if (!url) return "";

  /*
    If the Sheet contains:
    www.farhad.com
    it becomes:
    https://www.farhad.com

    If it already contains:
    https://www.farhad.com
    it remains unchanged.
  */
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  return url;
}

function checkStatus(sessionId) {
  try {
    const sheet = getSheet();

    sessionId = String(sessionId || "").trim();

    if (!sessionId) {
      return {
        success: false,
        status: "",
        waiting: false,
        redirectUrl: "",
        message: "sessionId موجود نیست."
      };
    }

    const row = findRow(sheet, sessionId);

    if (!row) {
      return {
        success: false,
        status: "",
        waiting: false,
        redirectUrl: "",
        message: "رکورد پیدا نشد."
      };
    }

    const otp =
      String(sheet.getRange(row, 6).getValue() || "").trim();

    const adminStatus =
      String(
        sheet.getRange(row, 7).getValue() || ""
      ).trim().toLowerCase();

    const waitingValue =
      sheet.getRange(row, 8).getValue();

    const waiting =
      waitingValue === true ||
      String(waitingValue)
        .trim()
        .toLowerCase() === "true";

    /*
      COLUMN I:
      The only source of the redirect link.
    */
    const redirectUrl =
      normalizeRedirectUrl(
        sheet.getRange(row, 9).getValue()
      );

    if (adminStatus === "ok") {
      sheet.getRange(row, 8).setValue(false);
      sheet.getRange(row, 13).setValue(new Date());

      SpreadsheetApp.flush();

      return {
        success: true,
        status: "ok",
        otp: otp,
        waiting: false,
        redirectUrl: redirectUrl,
        approved: true
      };
    }

    return {
      success: true,
      status: adminStatus,
      otp: otp,
      waiting: waiting,
      redirectUrl: "",
      approved: false
    };

  } catch (error) {
    return {
      success: false,
      status: "",
      waiting: false,
      redirectUrl: "",
      message: error.message
    };
  }
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}