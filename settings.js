const FILTER_STORAGE_KEY = "bassClef:accidentals";
const TIMER_STORAGE_KEY = "bassClef:showTimer";

const DEFAULT_ACCIDENTAL_FILTERS = {
  natural: true,
  flat: true,
  sharp: true,
};

const el = {
  soundToggle: document.getElementById("soundToggle"),
  timerToggle: document.getElementById("timerToggle"),
  filterNatural: document.getElementById("filterNatural"),
  filterFlat: document.getElementById("filterFlat"),
  filterSharp: document.getElementById("filterSharp"),
  saveStatus: document.getElementById("saveStatus"),
};

function readAccidentalFilters(){
  const raw = localStorage.getItem(FILTER_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_ACCIDENTAL_FILTERS };
  try {
    const parsed = JSON.parse(raw);
    return {
      natural: Boolean(parsed.natural),
      flat: Boolean(parsed.flat),
      sharp: Boolean(parsed.sharp),
    };
  } catch (error) {
    return { ...DEFAULT_ACCIDENTAL_FILTERS };
  }
}

function writeAccidentalFilters(filters){
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
}

function showStatus(message){
  if (!el.saveStatus) return;
  el.saveStatus.textContent = message;
  el.saveStatus.classList.remove("status-warn");
}

function showWarning(message){
  if (!el.saveStatus) return;
  el.saveStatus.textContent = message;
  el.saveStatus.classList.add("status-warn");
}

function saveSoundSetting(){
  const enabled = Boolean(el.soundToggle?.checked);
  localStorage.setItem("bassClef:soundEnabled", String(enabled));
  showStatus("העדכון נשמר.");
}

function saveTimerSetting(){
  const enabled = Boolean(el.timerToggle?.checked);
  localStorage.setItem(TIMER_STORAGE_KEY, String(enabled));
  showStatus("העדכון נשמר.");
}

function saveFilterSettings(){
  if (!el.filterNatural || !el.filterFlat || !el.filterSharp) return;
  const filters = {
    natural: el.filterNatural.checked,
    flat: el.filterFlat.checked,
    sharp: el.filterSharp.checked,
  };

  if (!filters.natural && !filters.flat && !filters.sharp){
    filters.natural = true;
    el.filterNatural.checked = true;
    showWarning("חייבים להשאיר לפחות סוג תו אחד. החזרנו לטבעי.");
  } else {
    showStatus("העדכון נשמר.");
  }

  writeAccidentalFilters(filters);
}

function hydrate(){
  if (el.soundToggle){
    el.soundToggle.checked = localStorage.getItem("bassClef:soundEnabled") === "true";
  }
  if (el.timerToggle){
    el.timerToggle.checked = localStorage.getItem(TIMER_STORAGE_KEY) === "true";
  }

  const filters = readAccidentalFilters();
  if (el.filterNatural) el.filterNatural.checked = filters.natural;
  if (el.filterFlat) el.filterFlat.checked = filters.flat;
  if (el.filterSharp) el.filterSharp.checked = filters.sharp;

  showStatus("");
}

function bindEvents(){
  el.soundToggle?.addEventListener("change", saveSoundSetting);
  el.timerToggle?.addEventListener("change", saveTimerSetting);
  el.filterNatural?.addEventListener("change", saveFilterSettings);
  el.filterFlat?.addEventListener("change", saveFilterSettings);
  el.filterSharp?.addEventListener("change", saveFilterSettings);
}

hydrate();
bindEvents();
