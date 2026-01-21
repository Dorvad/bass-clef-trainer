// ======== הגדרות ========
// מיפוי שמות עבריים "קנוניים" לשבעה צלילים בסיסיים
const NOTE_HE = {
  C: "דו",
  D: "רה",
  E: "מי",
  F: "פה",
  G: "סול",
  A: "לה",
  B: "סי",
};

const ACC_HE = {
  natural: "",
  flat: "במול",
  sharp: "דיאז",
};

// טווח מומלץ למפתח פה למתחילים (C2..C4 למשל) — אפשר להרחיב.
// בחרתי טווח שמצריך גם קווי עזר מעט, כדי שזה יהיה "אמיתי" לצ'לו.
const NOTE_POOL = buildPool([
  // [pitch, accidental] accidental: "natural" | "flat" | "sharp"
  ["C2","natural"], ["D2","natural"], ["E2","natural"], ["F2","natural"], ["G2","natural"], ["A2","natural"], ["B2","natural"],
  ["C3","natural"], ["D3","natural"], ["E3","natural"], ["F3","natural"], ["G3","natural"], ["A3","natural"], ["B3","natural"],
  ["C4","natural"], ["D4","natural"], ["E4","natural"], ["F4","natural"], ["G4","natural"],
  // קצת במולים/דיאזים נפוצים
  ["E2","flat"], ["B2","flat"], ["F2","sharp"], ["C3","sharp"], ["G3","sharp"], ["D3","flat"],
]);

// ======== DOM ========
const el = {
  answer: document.getElementById("answer"),
  checkBtn: document.getElementById("checkBtn"),
  skipBtn: document.getElementById("skipBtn"),
  endBtn: document.getElementById("endBtn"),
  msg: document.getElementById("msg"),
  answeredCount: document.getElementById("answeredCount"),
  wrongCount: document.getElementById("wrongCount"),

  noteGroup: document.getElementById("note"),
  noteHead: document.getElementById("noteHead"),
  stem: document.getElementById("stem"),
  ledgers: document.getElementById("ledgers"),
  acc: document.getElementById("acc"),
  flash: document.getElementById("successFlash"),
};

// ======== מצב משחק ========
const session = {
  id: cryptoRandomId(),
  startedAt: Date.now(),
  events: [], // כל אירוע תשובה נכונה/ויתור
  wrongAttempts: 0,
  answered: 0,
};

let current = null;          // note object
let questionStartMs = 0;     // למדידת זמן מענה
let lock = false;

// ======== עזרי מוזיקה ========

// בניית מאגר אובייקטים
function buildPool(list){
  return list.map(([p, accidental]) => makeNote(p, accidental));
}

// pitch למשל "C3"
function makeNote(pitch, accidental){
  const letter = pitch[0];
  const octave = parseInt(pitch.slice(1), 10);
  return {
    pitch,
    letter,
    octave,
    accidental, // natural/flat/sharp
    labelHe: heLabel(letter, accidental),
  };
}

function heLabel(letter, accidental){
  const base = NOTE_HE[letter];
  const acc = ACC_HE[accidental] ? ` ${ACC_HE[accidental]}` : "";
  return `${base}${acc}`.trim();
}

// כדי לצייר בגובה נכון: נשתמש ב"סטפים" של חצי-טון דיאטוני (line/space)
// נגדיר נקודת ייחוס: E2 (שורה תחתונה+קו עזר? בפועל זה מתחת לחמשה)
// אבל מה שחשוב: עקביות וקריאות. נשתמש בסולם דיאטוני לטרנספורמציה לתוך y.
const staff = {
  topLineY: 80,
  step: 12.5,        // מרחק בין קו לרווח (חצי מרווח בין חמשות) — טיוב גרפי
  // במפתח פה: הקו האמצעי הוא D3, קו תחתון G2, קו עליון A3.
  // נשתמש במיפוי "דיאטוני" לסטפ-אינדקס סביב D3 (line3).
};

// מחזיר "אינדקס דיאטוני" ביחידות של קו/רווח
// נבחר D3 (קו אמצעי) = index 0
function diatonicIndex(letter, octave){
  // סדר אותיות דיאטוני
  const order = ["C","D","E","F","G","A","B"];
  // מחשבים כמה צעדים דיאטוניים מ-D3
  const baseOct = 3;
  const baseLetter = "D";

  const basePos = baseOct * 7 + order.indexOf(baseLetter);
  const pos = octave * 7 + order.indexOf(letter);
  return pos - basePos; // 0 ב-D3, חיובי כלפי מעלה
}

// y עבור תו: כל אינדקס דיאטוני מעלה = יורד ב-step
function yForNote(note){
  const idx = diatonicIndex(note.letter, note.octave);
  // קו אמצעי (D3) נמצא ב-y=130 (הקו השלישי מתוך 5: 80,105,130,155,180)
  const middleLineY = 130;
  return middleLineY - idx * staff.step;
}

// קווי עזר: כל קו/רווח מעבר לחמשה דורש ledger
function renderLedgers(y){
  // קווי החמשה: 80..180
  const minY = 80;
  const maxY = 180;

  el.ledgers.innerHTML = "";

  // אם התו בתוך החמשה – אין
  if (y >= minY && y <= maxY) return;

  // נוסיף קווי עזר בכל "קו" (כל שני steps) שמחוץ לתחום
  // head נמצא על קו/רווח; ledger lines צריכים להיות בקווי חמשה דמיוניים
  // נחשב את ה-y הקרוב לקווים (כל 2*step)
  const lineSpacing = staff.step * 2;

  function addLedgerLine(yy){
    const x1 = 590, x2 = 650; // סביב ראש התו
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("x2", x2);
    line.setAttribute("y1", yy);
    line.setAttribute("y2", yy);
    el.ledgers.appendChild(line);
  }

  if (y < minY){
    // מעל: נוסיף קווים מ-minY כלפי מעלה
    // קו עליון הוא 80. הקו הבא מעליו הוא 80 - lineSpacing וכו'
    let yy = minY - lineSpacing;
    while (y <= yy + staff.step) { // עד שנכסה את ראש התו
      addLedgerLine(yy);
      yy -= lineSpacing;
    }
  } else if (y > maxY){
    // מתחת: נוסיף קווים מ-maxY כלפי מטה
    let yy = maxY + lineSpacing;
    while (y >= yy - staff.step) {
      addLedgerLine(yy);
      yy += lineSpacing;
    }
  }
}

function setAccidental(note, y){
  // מציבים סימן ליד התו
  // תווים במול/דיאז: ♭ / ♯
  let sym = "";
  if (note.accidental === "flat") sym = "♭";
  if (note.accidental === "sharp") sym = "♯";

  el.acc.textContent = sym;
  if (!sym){
    el.acc.setAttribute("x", 0);
    el.acc.setAttribute("y", 0);
    return;
  }
  el.acc.setAttribute("x", 560);
  el.acc.setAttribute("y", y + 12);
}

// ======== נורמליזציה של תשובת משתמש ========
function normalizeHebrewInput(s){
  if (!s) return "";
  let t = s.trim().toLowerCase();

  // מסיר ניקוד/תווים מיוחדים בסיסיים
  t = t.replace(/[“”"'.،،,]/g, " ");
  t = t.replace(/\s+/g, " ").trim();

  // המרות נפוצות
  t = t.replace(/♭/g, " במול ");
  t = t.replace(/flat/g, " במול ");
  t = t.replace(/bemol/g, " במול ");
  t = t.replace(/במול/g, " במול ");

  t = t.replace(/♯/g, " דיאז ");
  t = t.replace(/#/g, " דיאז ");
  t = t.replace(/sharp/g, " דיאז ");
  t = t.replace(/דיאז/g, " דיאז ");

  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function acceptableAnswers(note){
  const base = NOTE_HE[note.letter];
  const acc = ACC_HE[note.accidental]; // "" | "במול" | "דיאז"

  const a = [];
  if (!acc) {
    a.push(`${base}`);
  } else {
    a.push(`${base} ${acc}`);
    // גם בלי רווח/עם מקף
    a.push(`${base}${acc}`);
    a.push(`${base}-${acc}`);
  }

  // תמיכה גם בכתיב "סי במול" מול "סי-במול" וכו
  return new Set(a.map(normalizeHebrewInput));
}

// ======== מנוע המשחק ========
function pickNextNote(){
  // רנדומלי פשוט; אפשר להוסיף משקל לפי טעויות בעתיד
  const n = NOTE_POOL[Math.floor(Math.random() * NOTE_POOL.length)];
  return n;
}

function animateNewNote(){
  el.noteGroup.classList.add("note-fade");
  setTimeout(() => {
    el.noteGroup.classList.remove("note-fade");
    el.noteGroup.classList.add("note-pop");
    setTimeout(() => el.noteGroup.classList.remove("note-pop"), 180);
  }, 150);
}

function showNote(note){
  const y = yForNote(note);

  // ראש התו
  el.noteHead.setAttribute("cy", y);

  // גבעול: אם תו גבוה, גבעול יורד; אם נמוך, עולה.
  // (לא חייב מושלם, אבל זה מרגיש מוזיקלי)
  const mid = 130;
  const stemUp = y >= mid; // נמוך => גבעול עולה
  if (stemUp){
    el.stem.setAttribute("x1", 638);
    el.stem.setAttribute("x2", 638);
    el.stem.setAttribute("y1", y);
    el.stem.setAttribute("y2", y - 78);
  } else {
    // גבעול יורד משמאל
    el.stem.setAttribute("x1", 602);
    el.stem.setAttribute("x2", 602);
    el.stem.setAttribute("y1", y);
    el.stem.setAttribute("y2", y + 78);
  }

  renderLedgers(y);
  setAccidental(note, y);
  animateNewNote();
}

function setMessage(text, kind){
  el.msg.textContent = text || "";
  el.msg.classList.remove("ok","bad");
  if (kind) el.msg.classList.add(kind);
}

function startQuestion(){
  current = pickNextNote();
  showNote(current);
  questionStartMs = performance.now();
  el.answer.value = "";
  el.answer.focus();
  setMessage("", null);
}

function flashSuccess(){
  el.flash.classList.add("flash-on");
  setTimeout(() => el.flash.classList.remove("flash-on"), 260);
}

function recordEvent(type, note, ms, extra={}){
  session.events.push({
    type, // "correct" | "skip"
    pitch: note.pitch,
    letter: note.letter,
    accidental: note.accidental,
    labelHe: note.labelHe,
    timeMs: ms ?? null,
    at: Date.now(),
    ...extra,
  });
}

function updateCounters(){
  el.answeredCount.textContent = String(session.answered);
  el.wrongCount.textContent = String(session.wrongAttempts);
}

function checkAnswer(){
  if (lock || !current) return;

  const user = normalizeHebrewInput(el.answer.value);
  const okSet = acceptableAnswers(current);

  if (okSet.has(user)){
    lock = true;

    const ms = Math.max(0, Math.round(performance.now() - questionStartMs));
    session.answered += 1;
    recordEvent("correct", current, ms);
    updateCounters();

    flashSuccess();
    setMessage("נכון ✅ ממשיכים…", "ok");

    // מעבר אוטומטי לשאלה הבאה
    setTimeout(() => {
      lock = false;
      startQuestion();
    }, 420);

  } else {
    session.wrongAttempts += 1;
    updateCounters();
    setMessage("לא בדיוק. נסה/י שוב 🙂", "bad");
    // לא מתקדמים עד שתהיה תשובה נכונה
    el.answer.select();
  }
}

function skipQuestion(){
  if (lock || !current) return;
  lock = true;

  // ויתור: נספור כ"שאלה הוחלפה" בלי זמן תגובה (או אפשר למדוד גם כאן)
  recordEvent("skip", current, null);
  setMessage("הוחלף. (ויתרת על השאלה הזו)", null);

  setTimeout(() => {
    lock = false;
    startQuestion();
  }, 260);
}

function endGame(){
  // שומרים סשן ללוקאל-סטורג' ומעבירים לעמוד סיכום
  const payload = {
    ...session,
    endedAt: Date.now(),
  };
  localStorage.setItem("bassClefSession:last", JSON.stringify(payload));
  window.location.href = "summary.html";
}

// ======== אירועים ========
el.checkBtn.addEventListener("click", checkAnswer);
el.skipBtn.addEventListener("click", skipQuestion);
el.endBtn.addEventListener("click", endGame);

el.answer.addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkAnswer();
});

// התחלה
updateCounters();
startQuestion();

// ======== utils ========
function cryptoRandomId(){
  // מזהה קצר
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a).map(x=>x.toString(16).padStart(2,"0")).join("");
}
