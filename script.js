// ===== ค่าเริ่มต้น / DEFAULT STATE =====
const DEFAULT_RATE_TEXT = "อัตราแลกเปลี่ยน: -";
const DEFAULT_UPDATED_TEXT = "อัปเดตล่าสุด: -";
const HISTORY_KEY = "currency-history";
const MAX_HISTORY = 10;

// อัตราแลกเปลี่ยนสำรอง (เทียบกับ THB = 1) กรณีเรียก API ไม่ได้
const FALLBACK_RATES_FROM_THB = {
  THB: 1,
  USD: 0.02817,
  EUR: 0.02599,
  JPY: 4.1892,
  GBP: 0.02231,
};

let ratesFromTHB = { ...FALLBACK_RATES_FROM_THB };

// ===== อ้างอิง element =====
const currencyOneEl = document.getElementById("currency-one");
const currencyTwoEl = document.getElementById("currency-two");
const amountOneEl = document.getElementById("amount-one");
const amountTwoEl = document.getElementById("amount-two");
const rateTextEl = document.getElementById("rate-text");
const updatedTextEl = document.getElementById("updated-text");
const swapBtn = document.getElementById("swap-btn");
const clearBtn = document.getElementById("clear-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const historyListEl = document.getElementById("history-list");

// ป้องกันการคำนวณวนซ้ำเมื่ออัปเดตค่าด้วยโปรแกรม (ไม่ใช่ผู้ใช้พิมพ์)
let isSyncing = false;

// ===== ดึงอัตราแลกเปลี่ยนจริงจาก API (มี fallback) =====
async function loadRates() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/THB");
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (data && data.rates) {
      ratesFromTHB = { ...FALLBACK_RATES_FROM_THB, ...data.rates };
    }
  } catch (err) {
    console.warn("ใช้อัตราแลกเปลี่ยนสำรอง เนื่องจากเรียก API ไม่สำเร็จ:", err);
  } finally {
    updateRateDisplay();
    // คำนวณค่าเริ่มต้นใหม่ถ้ามีตัวเลขอยู่แล้ว
    if (amountOneEl.value) convertFromOne();
  }
}

// แปลงจากสกุล A -> B โดยอิงฐาน THB
function getRate(fromCurrency, toCurrency) {
  const fromRate = ratesFromTHB[fromCurrency];
  const toRate = ratesFromTHB[toCurrency];
  if (!fromRate || !toRate) return null;
  // 1 หน่วยของ from = ? หน่วยของ to
  return toRate / fromRate;
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "";
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function updateRateDisplay() {
  const from = currencyOneEl.value;
  const to = currencyTwoEl.value;
  const rate = getRate(from, to);
  if (rate === null) {
    rateTextEl.textContent = DEFAULT_RATE_TEXT;
    return;
  }
  rateTextEl.textContent = `อัตราแลกเปลี่ยน: 1 ${from} = ${formatNumber(rate)} ${to}`;
  updatedTextEl.textContent = `อัปเดตล่าสุด: ${new Date().toLocaleString("th-TH")}`;
}

// ===== โจทย์ที่ 1: แปลงค่าแบบสองทิศทาง =====

// ต้นทาง (amount-one) -> ปลายทาง (amount-two)
function convertFromOne() {
  if (isSyncing) return;
  const from = currencyOneEl.value;
  const to = currencyTwoEl.value;
  const rate = getRate(from, to);
  const value = parseFloat(amountOneEl.value);

  if (rate === null || isNaN(value)) {
    isSyncing = true;
    amountTwoEl.value = "";
    isSyncing = false;
    return;
  }

  const result = value * rate;
  isSyncing = true;
  amountTwoEl.value = round(result);
  isSyncing = false;

  addHistory(value, from, result, to);
}

// ปลายทาง (amount-two) -> ต้นทาง (amount-one)  [ย้อนกลับ]
function convertFromTwo() {
  if (isSyncing) return;
  const from = currencyOneEl.value;
  const to = currencyTwoEl.value;
  const rate = getRate(to, from); // กลับทิศทาง
  const value = parseFloat(amountTwoEl.value);

  if (rate === null || isNaN(value)) {
    isSyncing = true;
    amountOneEl.value = "";
    isSyncing = false;
    return;
  }

  const result = value * rate;
  isSyncing = true;
  amountOneEl.value = round(result);
  isSyncing = false;

  addHistory(result, from, value, to);
}

function round(num) {
  return Math.round(num * 1e6) / 1e6;
}

// ===== โจทย์ที่ 2: ประวัติการแปลงเงิน =====
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn("ไม่สามารถบันทึกประวัติได้:", err);
  }
}

function addHistory(fromValue, fromCurrency, toValue, toCurrency) {
  if (!fromValue || !toValue) return;

  const history = loadHistory();
  const entry = {
    fromValue: formatNumber(fromValue),
    fromCurrency,
    toValue: formatNumber(toValue),
    toCurrency,
    time: new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  history.unshift(entry);
  const trimmed = history.slice(0, MAX_HISTORY);
  saveHistory(trimmed);
  renderHistory(trimmed);
}

function renderHistory(history = loadHistory()) {
  historyListEl.innerHTML = "";

  if (history.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "ยังไม่มีประวัติการแปลงเงิน";
    historyListEl.appendChild(li);
    return;
  }

  history.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${item.fromValue} ${item.fromCurrency} → ${item.toValue} ${item.toCurrency}</span>
      <span class="time">${item.time}</span>
    `;
    historyListEl.appendChild(li);
  });
}

function clearHistory() {
  saveHistory([]);
  renderHistory([]);
}

// ===== โจทย์ที่ 3: ปุ่มล้างข้อมูล =====
function clearFields() {
  amountOneEl.value = "";
  amountTwoEl.value = "";
  rateTextEl.textContent = DEFAULT_RATE_TEXT;
  updatedTextEl.textContent = DEFAULT_UPDATED_TEXT;
}

// ===== ปุ่มสลับสกุลเงิน (เสริมความสะดวก) =====
function swapCurrencies() {
  const tempCurrency = currencyOneEl.value;
  currencyOneEl.value = currencyTwoEl.value;
  currencyTwoEl.value = tempCurrency;

  const tempAmount = amountOneEl.value;
  amountOneEl.value = amountTwoEl.value;
  amountTwoEl.value = tempAmount;

  updateRateDisplay();
}

// ===== Event Listeners =====
amountOneEl.addEventListener("input", convertFromOne);
amountTwoEl.addEventListener("input", convertFromTwo);

currencyOneEl.addEventListener("change", () => {
  updateRateDisplay();
  if (amountOneEl.value) convertFromOne();
});

currencyTwoEl.addEventListener("change", () => {
  updateRateDisplay();
  if (amountOneEl.value) convertFromOne();
});

swapBtn.addEventListener("click", swapCurrencies);
clearBtn.addEventListener("click", clearFields);
clearHistoryBtn.addEventListener("click", clearHistory);

// ===== เริ่มต้นโปรแกรม =====
renderHistory();
loadRates();
