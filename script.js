const API_URL = "https://script.google.com/macros/s/AKfycbzJz57KdpvTitp-0hV70ckLXHMfMHS-Y3riAE1lv8hSFoN8PQzb9e2jkDB5xV5_vzTznA/exec";
const COUNTDOWN_SECONDS = 60;
const POLLING_INTERVAL = 2000;

let sessionId = "";
let captchaCode = "";
let countdownTimer = null;
let pollingTimer = null;
let remainingSeconds = COUNTDOWN_SECONDS;

const $ = id => document.getElementById(id);
const caseForm = $("caseForm");
const caseNameInput = $("caseName");
const trackingNumberInput = $("trackingNumber");
const yearMonthInput = $("yearMonth");
const captchaInput = $("captchaInput");
const captchaImage = $("captchaImage");
const refreshCaptchaBtn = $("refreshCaptcha");
const verifySecurityBtn = $("verifySecurityBtn");
const otpSection = $("otpSection");
const requestOtpBtn = $("requestOtpBtn");
const resendOtpBtn = $("resendOtpBtn");
const countdownContainer = $("countdownContainer");
const countdownElement = $("countdown");
const otpStatus = $("otpStatus");
const waitingMessage = $("waitingMessage");
const loadingOverlay = $("loadingOverlay");
const loadingText = $("loadingText");
const toast = $("toast");

function generateSessionId() {
  return "session_" + Date.now().toString(36) + "_" +
    Math.random().toString(36).substring(2, 12);
}

function initialize() {
  sessionId = generateSessionId();
  generateCaptcha();
  updateCountdown(COUNTDOWN_SECONDS);
}

function generateCaptcha() {
  let result = "";
  for (let i = 0; i < 5; i++) result += Math.floor(Math.random() * 10);
  captchaCode = result;
  captchaImage.textContent = result;
  captchaInput.value = "";
}

refreshCaptchaBtn.addEventListener("click", generateCaptcha);

function getYearMonth() {
  const value = yearMonthInput.value;
  if (!value) return { year: "", month: "" };
  const parts = value.split("-");
  return parts.length === 2
    ? { year: parts[0], month: parts[1] }
    : { year: "", month: "" };
}

function showLoading(message) {
  loadingText.textContent = message || "لطفاً منتظر بمانید...";
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

function showToast(message, type) {
  toast.textContent = message;
  toast.className = "toast";
  if (type) toast.classList.add(type);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

async function postAPI(data) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error("ارتباط با سرور برقرار نشد.");
  return await response.json();
}

async function getAPI(action, params) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);

  Object.keys(params).forEach(k => {
    url.searchParams.set(k, params[k]);
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) throw new Error("خطا در ارتباط با سرور.");
  return await response.json();
}

function validateForm() {
  if (!caseNameInput.value.trim()) {
    showToast("لطفاً اسم پرونده را وارد کنید.", "error");
    caseNameInput.focus();
    return false;
  }

  if (!trackingNumberInput.value.trim()) {
    showToast("لطفاً شماره پیگیری پرونده را وارد کنید.", "error");
    trackingNumberInput.focus();
    return false;
  }

  if (!yearMonthInput.value) {
    showToast("لطفاً سال و ماه را انتخاب کنید.", "error");
    yearMonthInput.focus();
    return false;
  }

  if (!captchaInput.value.trim()) {
    showToast("لطفاً عدد تصویر امنیتی را وارد کنید.", "error");
    captchaInput.focus();
    return false;
  }

  if (captchaInput.value.trim() !== captchaCode) {
    showToast("عدد تصویر امنیتی صحیح نیست.", "error");
    generateCaptcha();
    captchaInput.focus();
    return false;
  }

  return true;
}

verifySecurityBtn.addEventListener("click", async () => {
  if (!validateForm()) return;

  const date = getYearMonth();
  verifySecurityBtn.disabled = true;
  showLoading("در حال ثبت اطلاعات و تأیید امنیت...");

  try {
    const result = await postAPI({
      action: "verifySecurity",
      sessionId,
      caseName: caseNameInput.value.trim(),
      trackingNumber: trackingNumberInput.value.trim(),
      caseYear: date.year,
      caseMonth: date.month,
      yearMonth: date.year + "/" + date.month,
      captchaInput: captchaInput.value.trim()
    });

    if (!result?.success) {
      throw new Error(result?.message || "تأیید امنیتی انجام نشد.");
    }

    showToast("اطلاعات با موفقیت ثبت شد.", "success");
    otpSection.classList.remove("hidden");

    setTimeout(() => {
      otpSection.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 150);

    caseNameInput.disabled = true;
    trackingNumberInput.disabled = true;
    yearMonthInput.disabled = true;
    captchaInput.disabled = true;
    refreshCaptchaBtn.disabled = true;

  } catch (error) {
    console.error(error);
    showToast(error.message || "خطایی رخ داد.", "error");
    verifySecurityBtn.disabled = false;
  } finally {
    hideLoading();
  }
});

requestOtpBtn.addEventListener("click", requestOTP);
resendOtpBtn.addEventListener("click", requestOTP);

async function requestOTP() {
  if (countdownTimer) return;

  requestOtpBtn.disabled = true;
  resendOtpBtn.disabled = true;
  showLoading("در حال ایجاد و ثبت کد OTP...");

  try {
    const result = await postAPI({
      action: "requestOTP",
      sessionId
    });

    if (!result?.success) {
      throw new Error(result?.message || "درخواست OTP انجام نشد.");
    }

    otpStatus.textContent = "کد OTP ایجاد شد. در انتظار تأیید مدیر هستید.";
    waitingMessage.classList.remove("hidden");
    countdownContainer.classList.remove("hidden");
    resendOtpBtn.classList.add("hidden");
    requestOtpBtn.classList.add("hidden");

    startCountdown();
    startStatusPolling();

    showToast("کد OTP با موفقیت ثبت شد.", "success");

  } catch (error) {
    console.error(error);
    showToast(error.message || "ارسال OTP ناموفق بود.", "error");
    requestOtpBtn.disabled = false;
    resendOtpBtn.disabled = false;
  } finally {
    hideLoading();
  }
}

function startCountdown() {
  stopCountdown();
  remainingSeconds = COUNTDOWN_SECONDS;
  updateCountdown(remainingSeconds);

  countdownTimer = setInterval(() => {
    remainingSeconds--;
    updateCountdown(remainingSeconds);

    if (remainingSeconds <= 0) {
      stopCountdown();
      countdownFinished();
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function updateCountdown(seconds) {
  countdownElement.textContent = String(seconds);
}

function countdownFinished() {
  checkStatusOnce();

  requestOtpBtn.classList.add("hidden");
  resendOtpBtn.classList.remove("hidden");
  resendOtpBtn.disabled = false;
  countdownContainer.classList.add("hidden");

  otpStatus.textContent =
    "زمان انتظار به پایان رسید. در صورت عدم تأیید، می‌توانید کد جدید درخواست کنید.";
}

function startStatusPolling() {
  stopStatusPolling();
  checkStatusOnce();
  pollingTimer = setInterval(checkStatusOnce, POLLING_INTERVAL);
}

function stopStatusPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

async function checkStatusOnce() {
  try {
    const result = await getAPI("checkStatus", { sessionId });

    if (!result?.success) return;

    if (String(result.status || "").trim().toLowerCase() === "ok") {
      stopCountdown();
      stopStatusPolling();

      waitingMessage.classList.add("hidden");
      otpStatus.textContent = "درخواست شما تأیید شد. در حال انتقال...";

      const redirectUrl = String(result.redirectUrl || "").trim();

      if (redirectUrl) {
        showLoading("تأیید شد؛ در حال انتقال...");

        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);

      } else {
        hideLoading();
        showToast(
          "درخواست تأیید شد، اما لینک انتقال در ستون I ثبت نشده است.",
          "error"
        );
      }
    }

  } catch (error) {
    console.warn("Status check error:", error);
  }
}

document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "visible" &&
    !otpSection.classList.contains("hidden")
  ) {
    checkStatusOnce();
  }
});

caseForm.addEventListener("submit", e => {
  e.preventDefault();
  verifySecurityBtn.click();
});

window.addEventListener("beforeunload", () => {
  stopCountdown();
  stopStatusPolling();
});

initialize();