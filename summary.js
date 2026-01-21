
(function(){
  const KEY = "bassClefSession:last";

  const $ = (id) => document.getElementById(id);

  const el = {
    empty: $("empty"),

    headline: $("headline"),
    correctCount: $("correctCount"),
    skipCount: $("skipCount"),
    wrongCount: $("wrongCount"),

    totalQ: $("totalQ"),
    accuracy: $("accuracy"),
    duration: $("duration"),

    avgTime: $("avgTime"),
    fastest: $("fastest"),
    slowest: $("slowest"),

    byNote: $("byNote"),
    timeline: $("timeline"),

    resetBtn: $("resetBtn"),
  };

  const raw = localStorage.getItem(KEY);
  if (!raw){
    showEmpty();
    bindReset(null);
    return;
  }

  let session;
  try{
    session = JSON.parse(raw);
  }catch(e){
    showEmpty();
    bindReset(null);
    return;
  }

  if (!session || !Array.isArray(session.events)){
    showEmpty();
    bindReset(null);
    return;
  }

  // ====== חישובים ======
  const events = session.events.slice(); // copy
  const correctEvents = events.filter(e => e.type === "correct" && typeof e.timeMs === "number");
  const skipEvents = events.filter(e => e.type === "skip");

  const correctCount = correctEvents.length;
  const skipCount = skipEvents.length;
  const wrongCount = typeof session.wrongAttempts === "number" ? session.wrongAttempts : 0;

  const totalQ = events.length;

  // דיוק: נכון מתוך שאלות שלא דילגו
  // מאחר שבמשחק לא ממש יש "שאלה שנכשלה", אנחנו מגדירים:
  // nonSkip = correctCount (כי עד שלא נכון לא מתקדמים) => דיוק 100% בפועל.
  // כדי שיהיה משמעותי יותר: נחשב "דיוק נסיונות" = correctCount / (correctCount + wrongAttempts)
  const attempts = correctCount + wrongCount;
  const attemptAccuracy = attempts > 0 ? (correctCount / attempts) : 0;

  // זמן תגובה
  const times = correctEvents.map(e => e.timeMs);
  const avgMs = times.length ? Math.round(times.reduce((a,b)=>a+b,0) / times.length) : null;

  // מהיר/איטי לפי אירוע יחיד
  const fastestEv = correctEvents.length ? correctEvents.reduce((m,e)=> e.timeMs < m.timeMs ? e : m) : null;
  const slowestEv = correctEvents.length ? correctEvents.reduce((m,e)=> e.timeMs > m.timeMs ? e : m) : null;

  // הכי מהיר/איטי לפי ממוצע צליל
  const byNote = groupBy(correctEvents, (e) => e.labelHe || e.pitch || "—");
  const byNoteRows = Object.entries(byNote).map(([label, arr]) => {
    const ms = arr.map(x=>x.timeMs);
    const avg = Math.round(ms.reduce((a,b)=>a+b,0) / ms.length);
    return { label, avgMs: avg, count: arr.length };
  }).sort((a,b)=> a.avgMs - b.avgMs);

  // משך סשן
  const startedAt = session.startedAt || null;
  const endedAt = session.endedAt || null;
  const durationMs = (startedAt && endedAt && endedAt >= startedAt) ? (endedAt - startedAt) : null;

  // ====== רינדור ======
  renderTop({
    correctCount,
    skipCount,
    wrongCount,
    totalQ,
    attemptAccuracy,
    avgMs,
    fastestEv,
    slowestEv,
    durationMs,
  });

  renderByNote(byNoteRows);
  renderTimeline(events);

  bindReset(KEY);

  // ====== פונקציות ======
  function showEmpty(){
    el.empty.classList.remove("hidden");
    // מסתירים את ה-card הראשי אם אין סשן
    const card = document.querySelector(".card");
    if (card) card.style.display = "none";
  }

  function bindReset(key){
    if (!el.resetBtn) return;
    el.resetBtn.addEventListener("click", () => {
      if (key) localStorage.removeItem(key);
      window.location.href = "index.html";
    });
  }

  function renderTop(data){
    el.headline.textContent = data.correctCount
      ? `כל הכבוד! ענית נכון על ${data.correctCount} תווים`
      : `סשן ריק (אין תשובות נכונות)`;

    el.correctCount.textContent = String(data.correctCount);
    el.skipCount.textContent = String(data.skipCount);
    el.wrongCount.textContent = String(data.wrongCount);

    el.totalQ.textContent = String(data.totalQ);

    el.accuracy.textContent = data.correctCount || data.wrongCount
      ? `${Math.round(data.attemptAccuracy * 100)}%`
      : "—";

    el.duration.textContent = data.durationMs != null
      ? fmtDuration(data.durationMs)
      : "—";

    el.avgTime.textContent = data.avgMs != null ? fmtMs(data.avgMs) : "—";

    // מציגים אירוע מהיר/איטי כ"תו — זמן"
    el.fastest.textContent = data.fastestEv
      ? `${safeLabel(data.fastestEv)} · ${fmtMs(data.fastestEv.timeMs)}`
      : "—";

    el.slowest.textContent = data.slowestEv
      ? `${safeLabel(data.slowestEv)} · ${fmtMs(data.slowestEv.timeMs)}`
      : "—";
  }

  function renderByNote(rows){
    el.byNote.innerHTML = "";

    if (!rows.length){
      el.byNote.innerHTML = `<div class="pill">אין נתונים (אין תשובות נכונות)</div>`;
      return;
    }

    // כותרות
    const th = document.createElement("div");
    th.className = "th";
    th.innerHTML = `
      <div>תו</div>
      <div>ממוצע זמן</div>
      <div>כמות הופעות</div>
    `;
    el.byNote.appendChild(th);

    rows.forEach(r => {
      const div = document.createElement("div");
      div.className = "trow";
      div.innerHTML = `
        <div class="cellNote">${escapeHtml(r.label)}</div>
        <div class="cellAvg">${fmtMs(r.avgMs)}</div>
        <div class="cellCount">${r.count}</div>
      `;
      el.byNote.appendChild(div);
    });
  }

  function renderTimeline(events){
    el.timeline.innerHTML = "";

    if (!events.length){
      el.timeline.innerHTML = `<div class="pill">אין אירועים להצגה</div>`;
      return;
    }

    events.forEach((e, idx) => {
      const div = document.createElement("div");
      div.className = "event";
      div.style.animationDelay = `${Math.min(idx * 30, 420)}ms`;

      const isCorrect = e.type === "correct";
      const badgeClass = isCorrect ? "ok" : "skip";
      const badgeText = isCorrect ? "✓" : "↷";

      const title = isCorrect
        ? `נכון: ${safeLabel(e)}`
        : `ויתור: ${safeLabel(e)}`;

      const sub = isCorrect
        ? `זמן תגובה: ${fmtMs(e.timeMs)}`
        : `ללא זמן תגובה`;

      const when = e.at ? new Date(e.at) : null;

      div.innerHTML = `
        <div class="badge ${badgeClass}">${badgeText}</div>
        <div class="eventMain">
          <div class="eventTitle">${escapeHtml(title)}</div>
          <div class="eventSub">${escapeHtml(sub)}</div>
        </div>
        <div class="eventTime">${when ? fmtClock(when) : ""}</div>
      `;
      el.timeline.appendChild(div);
    });
  }

  function safeLabel(e){
    return (e && (e.labelHe || e.pitch)) ? (e.labelHe || e.pitch) : "—";
  }

  function groupBy(arr, keyFn){
    return arr.reduce((acc, item) => {
      const k = keyFn(item);
      (acc[k] ||= []).push(item);
      return acc;
    }, {});
  }

  function fmtMs(ms){
    if (ms == null || !isFinite(ms)) return "—";
    // אם קצר מאוד – נציג במ״ש, אחרת שניות עם עשירית
    if (ms < 1500) return `${ms}ms`;
    return `${(ms/1000).toFixed(1)}s`;
  }

  function fmtDuration(ms){
    const s = Math.max(0, Math.floor(ms/1000));
    const m = Math.floor(s/60);
    const r = s % 60;
    if (m <= 0) return `${r} שנ׳`;
    return `${m} דק׳ ${r} שנ׳`;
  }

  function fmtClock(d){
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
})();
