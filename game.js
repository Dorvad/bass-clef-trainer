// -----------------------------
// Bass Clef Trainer — Game Logic
// -----------------------------

const SESSION_KEY = "bassClefSession_v1";

// Staff geometry (based on SVG in index.html)
const STAFF = {
  yTop: 95,
  step: 12.5, // half-step between line/space visually
  noteX: 590,
  accX: 520,
  ledgerLeft: 565,
  ledgerRight: 615,
  ledgerLen: 60
};

// Notes range (E2..C4 is a comfortable "beginner" bass-clef span)
const NOTES = [
  // MIDI-ish ordering not needed; we map by staff index
  // We'll represent each as: { id, letter, octave, staffIndex, accidental: "natural"|"flat"|"sharp" }
];

// Build diatonic notes from E2 (bottom line) up to C4 (2 ledger lines above)
const diatonic = [
  // letter, octave
  ["E",2],["F",2],["G",2],["A",2],["B",2],["C",3],["D",3],
  ["E",3],["F",3],["G",3],["A",3],["B",3],["C",4]
];

// staffIndex: 0 = bottom line (E2), 1 = space (F2), ..., 8 = top line (A3), ...
// Our y uses: y = lineY(bottom line) - staffIndex*step
const bottomLineY = 195;

diatonic.forEach((d, i) => {
  NOTES.push({
    id: `${d[0]}${d[1]}`,
    letter: d[0],
    octave: d[1],
    staffIndex: i, // each diatonic step is one line/space -> step
    accidental: "natural"
  });
});

// optionally include accidentals for practice
const ACCIDENTAL_POOL = ["natural","natural","natural","flat","sharp"]; // weighted towards naturals

// Hebrew mapping
const HEB = {
  C: ["דו"],
  D: ["רה"],
  E: ["מי"],
  F: ["פה","פא"],
  G: ["סול"],
  A: ["לה"],
  B: ["סי"]
};

const ACC_HEB = {
  flat: ["במול"],
  sharp: ["דיאז"],
  natural: [""]
};

const els = {
  noteG: document.getElementById("noteG"),
  noteHead: document.getElementById("noteHead"),
  stem: document.getElementById("stem"),
  ledgers: document.getElementById("ledgers"),
  acc: document.getElementById("acc"),

  answer: document.getElementById("answer"),
  checkBtn: document.getElementById("checkBtn"),
  skipBtn: document.getElementById("skipBtn"),
  finishBtn: document.getElementById("finishBtn"),
  msg: document.getElementById("msg"),

  answered: document.getElementById("answered"),
  streak: document.getElementById("streak"),
};

let state = {
  startedAt: Date.now(),
  current: null,
  questionStartedAt: null,
  answeredCount: 0,
  streak: 0,
  attemptsOnCurrent: 0,
  history: [] // {noteId, displayName, correctName, ms, accidental, octave, letter}
};

function normalizeHeb(str){
  if(!str) return "";
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .replace(/[׳']/g, "")
    .replace(/[–—-]/g, " ")
    .replace(/,+/g, " ")
    .trim();
}

function buildAcceptedAnswers(note){
  const base = HEB[note.letter] || [];
  const accWord = (note.accidental === "flat") ? "במול" :
                  (note.accidental === "sharp") ? "דיאז" : "";

  const accepted = new Set();

  // Base name alone (e.g., "רה")
  base.forEach(b => accepted.add(normalizeHeb(b)));

  // With accidental (e.g., "רה במול")
  if(accWord){
    base.forEach(b => accepted.add(normalizeHeb(`${b} ${accWord}`)));
    // Allow "במול רה" style too
    base.forEach(b => accepted.add(normalizeHeb(`${accWord} ${b}`)));
  }

  // Allow common alternative for F: פא/פה handled in base
  // Also allow omitting spaces (rare but friendly)
  const expanded = Array.from(accepted);
  expanded.forEach(a => accepted.add(a.replace(/\s/g,"")));

  return Array.from(accepted);
}

function noteDisplayName(note){
  const base = (HEB[note.letter] || ["?"])[0];
  if(note.accidental === "flat") return `${base} במול`;
  if(note.accidental === "sharp") return `${base} דיאז`;
  return base;
}

function pickNewNote(){
  const base = NOTES[Math.floor(Math.random() * NOTES.length)];
  const accidental = ACCIDENTAL_POOL[Math.floor(Math.random() * ACCIDENTAL_POOL.length)];

  // Avoid e.g. C4 sharp to keep it simple: limit accidentals in edges a bit
  const isEdge = (base.letter === "E" && base.octave === 2) || (base.letter === "C" && base.octave === 4);
  const finalAcc = isEdge && accidental !== "natural" ? "natural" : accidental;

  return {
    ...base,
    accidental: finalAcc
  };
}

function yForStaffIndex(staffIndex){
  return bottomLineY - (staffIndex * STAFF.step);
}

function clearLedgers(){
  while(els.ledgers.firstChild) els.ledgers.removeChild(els.ledgers.firstChild);
}

function addLedgerAt(y){
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", STAFF.ledgerLeft);
  line.setAttribute("x2", STAFF.ledgerRight);
  line.setAttribute("y1", y);
  line.setAttribute("y2", y);
  els.ledgers.appendChild(line);
}

function updateLedgersFor(y){
  // Ledger lines occur when note is below bottom line (y > 195) or above top line (y < 95)
  // Our staff lines at: 95,120,145,170,195 (top to bottom)
  // Below: add ledger for y=220 (C2 line is outside our range), but our range starts at E2 on bottom line so usually none below.
  // Above top: A3 top line. B3 space above, C4 ledger line above, etc.
  clearLedgers();

  // Determine nearest "line positions" outside staff for ledger logic.
  // We'll compute line Ys extending beyond staff: every 2*step (because line-to-line distance is 2 half-steps)
  const lineYs = [95,120,145,170,195];

  const topLine = 95;
  const bottomLine = 195;

  // Above staff: y < topLine
  if(y < topLine){
    // Ledger lines at: topLine - 2*step, topLine - 4*step, ...
    for(let ly = topLine - 2*STAFF.step; ly >= y - 0.01; ly -= 2*STAFF.step){
      addLedgerAt(ly);
    }
  }

  // Below staff: y > bottomLine
  if(y > bottomLine){
    for(let ly = bottomLine + 2*STAFF.step; ly <= y + 0.01; ly += 2*STAFF.step){
      addLedgerAt(ly);
    }
  }
}

function setAccidentalSymbol(accidental){
  if(accidental === "flat") els.acc.textContent = "♭";
  else if(accidental === "sharp") els.acc.textContent = "♯";
  else els.acc.textContent = "";
}

function animateNote(){
  // restart animation
  els.noteG.classList.remove("noteAnim");
  // force reflow
  void els.noteG.getBBox();
  els.noteG.classList.add("noteAnim");
}

function showMessage(text, kind){
  els.msg.textContent = text || "";
  els.msg.classList.remove("good","bad");
  if(kind === "good") els.msg.classList.add("good");
  if(kind === "bad") els.msg.classList.add("bad");
}

function startQuestion(){
  state.current = pickNewNote();
  state.questionStartedAt = performance.now();
  state.attemptsOnCurrent = 0;

  const y = yForStaffIndex(state.current.staffIndex);
  els.noteHead.setAttribute("cy", y);
  // Stem direction: for notes above middle line, stem down; else up
  // middle line is 145
  if(y <= 145){
    // stem down
    els.stem.setAttribute("x1", 572);
    els.stem.setAttribute("x2", 572);
    els.stem.setAttribute("y1", y);
    els.stem.setAttribute("y2", y + 78);
  } else {
    // stem up
    els.stem.setAttribute("x1", 608);
    els.stem.setAttribute("x2", 608);
    els.stem.setAttribute("y1", y);
    els.stem.setAttribute("y2", y - 78);
  }

  setAccidentalSymbol(state.current.accidental);
  updateLedgersFor(y);
  animateNote();

  els.answer.value = "";
  els.answer.focus();
  showMessage("הקלד את שם התו בעברית ואז לחץ “בדוק”.", "");
}

function commitCorrect(){
  const ms = Math.max(0, Math.round(performance.now() - state.questionStartedAt));
  const correctName = noteDisplayName(state.current);

  state.answeredCount += 1;
  state.streak += 1;

  state.history.push({
    noteId: state.current.id,
    letter: state.current
