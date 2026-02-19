const startButton = document.getElementById("startButton");
const statusEl = document.getElementById("status");

const btnDelay1 = document.getElementById("btnDelay1");
const btnDelay2 = document.getElementById("btnDelay2");
const btnDelay3 = document.getElementById("btnDelay3");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalHint = document.getElementById("modalHint");
const minInput = document.getElementById("minInput");
const maxInput = document.getElementById("maxInput");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");

const FILES = {
  marks: "onyourmarks.mp3",
  set: "set.mp3",
  start: "start1.mp3",
};

const aMarks = new Audio(FILES.marks);
const aSet = new Audio(FILES.set);
const aStart = new Audio(FILES.start);

aMarks.preload = "auto";
aSet.preload = "auto";
aStart.preload = "auto";

function setStatus(s) {
  statusEl.textContent = s;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randBetween(minS, maxS) {
  return minS + Math.random() * (maxS - minS);
}

async function play(audioEl) {
  audioEl.pause();
  audioEl.currentTime = 0;
  await audioEl.play();
}

async function unlockAudioIOS() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  await ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0;

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.02);

  setTimeout(() => ctx.close().catch(() => {}), 200);
}

async function waitForCanPlay(a, label) {
  if (a.readyState >= 3) return;

  await new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error("Cannot load " + label));
    };
    const cleanup = () => {
      a.removeEventListener("canplaythrough", onOk);
      a.removeEventListener("error", onErr);
    };

    a.addEventListener("canplaythrough", onOk, { once: true });
    a.addEventListener("error", onErr, { once: true });

    a.load();
  });
}

function fmtRange(minS, maxS) {
  const clean = (x) => {
    const s = String(x);
    return s.includes(".") ? s.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1") : s;
  };
  return `${clean(minS)}–${clean(maxS)}s`;
}

function loadConfig() {
  const raw = localStorage.getItem("kinepose_start_cfg");
  if (!raw) {
    return {
      d1: { min: 3.0, max: 3.0 },
      d2: { min: 25.0, max: 30.0 },
      d3: { min: 1.2, max: 2.8 },
    };
  }
  try {
    const cfg = JSON.parse(raw);
    return {
      d1: cfg?.d1 ?? { min: 3.0, max: 3.0 },
      d2: cfg?.d2 ?? { min: 25.0, max: 30.0 },
      d3: cfg?.d3 ?? { min: 1.2, max: 2.8 },
    };
  } catch {
    return {
      d1: { min: 3.0, max: 3.0 },
      d2: { min: 25.0, max: 30.0 },
      d3: { min: 1.2, max: 2.8 },
    };
  }
}

function saveConfig(cfg) {
  localStorage.setItem("kinepose_start_cfg", JSON.stringify(cfg));
}

let cfg = loadConfig();

function refreshChips() {
  btnDelay1.textContent = cfg.d1.min === cfg.d1.max ? `+${cfg.d1.min.toFixed(1)}s` : fmtRange(cfg.d1.min, cfg.d1.max);
  btnDelay2.textContent = fmtRange(cfg.d2.min, cfg.d2.max);
  btnDelay3.textContent = fmtRange(cfg.d3.min, cfg.d3.max);
}

refreshChips();

let editingKey = null;

function openModal(key) {
  editingKey = key;

  const meta = {
    d1: { title: "Delay before On your marks", hint: "Usually fixed, eg 3.0 seconds", allowEqual: true },
    d2: { title: "Delay between On your marks and Set", hint: "Random range, eg 25–30 seconds", allowEqual: false },
    d3: { title: "Delay between Set and Start", hint: "Random range, eg 1.2–2.8 seconds", allowEqual: false },
  }[key];

  modalTitle.textContent = meta.title;
  modalHint.textContent = meta.hint;

  minInput.value = String(cfg[key].min);
  maxInput.value = String(cfg[key].max);

  modal.classList.add("isOpen");
  modal.setAttribute("aria-hidden", "false");

  minInput.focus();
  minInput.select();
}

function closeModal() {
  modal.classList.remove("isOpen");
  modal.setAttribute("aria-hidden", "true");
  editingKey = null;
}

function clampNumber(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  return n;
}

function validateAndSave() {
  if (!editingKey) return;

  const minV = clampNumber(minInput.value);
  const maxV = clampNumber(maxInput.value);

  if (minV === null || maxV === null) {
    alert("Please enter valid numbers");
    return;
  }

  if (maxV < minV) {
    alert("Max must be >= Min");
    return;
  }

  cfg[editingKey] = { min: minV, max: maxV };
  saveConfig(cfg);
  refreshChips();
  closeModal();
}

cancelBtn.addEventListener("click", closeModal);
saveBtn.addEventListener("click", validateAndSave);

modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (modal.classList.contains("isOpen") && e.key === "Escape") closeModal();
});

btnDelay1.addEventListener("click", () => openModal("d1"));
btnDelay2.addEventListener("click", () => openModal("d2"));
btnDelay3.addEventListener("click", () => openModal("d3"));

let running = false;

startButton.addEventListener("click", async () => {
  if (running) return;
  running = true;
  startButton.disabled = true;

  try {
    setStatus("Loading audio...");
    await unlockAudioIOS();

    await Promise.all([
      waitForCanPlay(aMarks, FILES.marks),
      waitForCanPlay(aSet, FILES.set),
      waitForCanPlay(aStart, FILES.start),
    ]);

    const d1 = cfg.d1.min === cfg.d1.max ? cfg.d1.min : randBetween(cfg.d1.min, cfg.d1.max);
    const d2 = randBetween(cfg.d2.min, cfg.d2.max);
    const d3 = randBetween(cfg.d3.min, cfg.d3.max);

    setStatus("Starting...");
    await sleep(d1 * 1000);
    await play(aMarks);

    setStatus("Waiting...");
    await sleep(d2 * 1000);
    await play(aSet);

    setStatus("Waiting...");
    await sleep(d3 * 1000);
    await play(aStart);

    setStatus("Done");
  } catch (e) {
    console.error(e);
    setStatus("Error");
    alert(
      "Audio error.\n" +
      "Check that all files are in the same folder and names match exactly.\n\n" +
      "Details: " + (e?.message || e)
    );
  } finally {
    startButton.disabled = false;
    running = false;
  }
});