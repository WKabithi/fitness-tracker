/* ══════════════════════════════════════════════════════════
   RISE — Morning Routine Tracker · app.js
   ══════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────
// 1. SUPABASE CLIENT
// ─────────────────────────────────────────────
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────────
// 2. DEFAULT BLOCKS
// ─────────────────────────────────────────────
const DEFAULT_BLOCKS = [
  { name: "Morning Hygiene",    duration_min: 30,   type: "hygiene",  reps: null, sets: null, reps_per_set: null },
  { name: "Breakfast",          duration_min: 20,   type: "food",     reps: null, sets: null, reps_per_set: null },
  { name: "HIIT Sprints",       duration_min: 20,   type: "workout",  reps: null, sets: null, reps_per_set: null },
  { name: "Push-ups",           duration_min: null, type: "workout",  reps: 50,   sets: 5,    reps_per_set: 10  },
  { name: "Bodyweight Squats",  duration_min: null, type: "workout",  reps: 50,   sets: 5,    reps_per_set: 10  },
  { name: "Breathwork",         duration_min: 20,   type: "breathwork", reps: null, sets: null, reps_per_set: null },
  { name: "Meditation",         duration_min: 10,   type: "wellness", reps: null, sets: null, reps_per_set: null },
  { name: "Journaling",         duration_min: 10,   type: "mindset",  reps: null, sets: null, reps_per_set: null },
  { name: "Reading",            duration_min: 10,   type: "mindset",  reps: null, sets: null, reps_per_set: null },
  { name: "Commute",            duration_min: 20,   type: "travel",   reps: null, sets: null, reps_per_set: null },
];

function getBlockDurationMin(block) {
  if (block.duration_min) return block.duration_min;
  if (block.sets)         return block.sets * 2;
  return 10;
}

// ─────────────────────────────────────────────
// 3. GLOBAL STATE
// ─────────────────────────────────────────────
let currentUser   = null;
let onboardBlocks = DEFAULT_BLOCKS.map((b, i) => ({ ...b, order: i }));
let arrivalTime   = "09:00";
let dragSrcIdx    = null;

// ─────────────────────────────────────────────
// 4. VIEW HELPERS
// ─────────────────────────────────────────────
const VIEWS = ["loader","login","signup","onboard-1","onboard-2","onboard-3","dashboard"];

function showView(name) {
  VIEWS.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (!el) return;
    if (v === name) { el.classList.remove("hidden"); el.classList.add("active"); }
    else            { el.classList.add("hidden");    el.classList.remove("active"); }
  });
}

function showError(id, msg)   { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove("hidden"); } }
function hideError(id)        { const el = document.getElementById(id); if (el) el.classList.add("hidden"); }
function showSuccess(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove("hidden"); } }

function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  btn.dataset.origText = btn.dataset.origText || btn.textContent;
  btn.textContent = loading ? "Please wait…" : btn.dataset.origText;
}

// ─────────────────────────────────────────────
// 5. TIME HELPERS
// ─────────────────────────────────────────────
function timeToMins(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minsToTime(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2,"0")}:${String(m % 60).padStart(2,"0")}`;
}

function calcBlockTimes(blocks, arrivalHHMM) {
  const totalMins    = blocks.reduce((s, b) => s + getBlockDurationMin(b), 0);
  const routineStart = timeToMins(arrivalHHMM) - totalMins;
  let cursor = routineStart;
  return blocks.map(b => {
    const startTime = minsToTime(cursor);
    cursor += getBlockDurationMin(b);
    return { ...b, startTime };
  });
}

function formatDisplayTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  return `${((h % 12) || 12)}:${String(m).padStart(2,"0")} ${ampm}`;
}

function dateKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function formatDateLong(yyyymmdd) {
  const d = new Date(yyyymmdd + "T00:00:00");
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ─────────────────────────────────────────────
// 6. YOUTUBE / URL PARSING
// ─────────────────────────────────────────────
function parseYouTubeURLs(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 30);
  return lines.map((rawUrl, idx) => {
    const videoId = extractYouTubeId(rawUrl);
    return { rawUrl, videoId, dayNumber: idx + 1, valid: !!videoId };
  });
}

function extractYouTubeId(url) {
  if (!url) return null;
  url = url.trim();
  const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const paramMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (paramMatch) return paramMatch[1];
  const pathMatch = url.match(/\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})/);
  if (pathMatch) return pathMatch[1];
  return null;
}

function buildEmbedUrl(videoId) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
}

// ─────────────────────────────────────────────
// 7. AUTH
// ─────────────────────────────────────────────
async function login() {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  hideError("login-error");
  if (!email || !password) { showError("login-error", "Please fill in all fields."); return; }

  const btn = document.getElementById("btn-login");
  setButtonLoading(btn, true);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  setButtonLoading(btn, false);

  if (error) { showError("login-error", error.message); return; }
  currentUser = data.user;
  await afterLogin();
}

async function signup() {
  const email    = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  hideError("signup-error");
  document.getElementById("signup-success").classList.add("hidden");

  if (!email || !password) { showError("signup-error", "Please fill in all fields."); return; }
  if (password.length < 6) { showError("signup-error", "Password must be at least 6 characters."); return; }

  const btn = document.getElementById("btn-signup");
  setButtonLoading(btn, true);
  const { data, error } = await supabase.auth.signUp({ email, password });
  setButtonLoading(btn, false);

  if (error) { showError("signup-error", error.message); return; }
  currentUser = data.user;

  if (data.session) { await afterLogin(); }
  else {
    showSuccess("signup-success", "Account created! Check your email to confirm, then sign in.");
    document.getElementById("signup-email").value = "";
    document.getElementById("signup-password").value = "";
  }
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  showView("login");
}

async function checkAuth() {
  showView("loader");
  const { data: { session } } = await supabase.auth.getSession();
  if (session) { currentUser = session.user; await afterLogin(); }
  else         { showView("login"); }
}

async function afterLogin() {
  const { data: profile } = await supabase
    .from("profiles")
    .select("arrival_time, onboarding_complete")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!profile || !profile.onboarding_complete) {
    onboardBlocks = DEFAULT_BLOCKS.map((b, i) => ({ ...b, order: i }));
    arrivalTime   = profile?.arrival_time || "09:00";
    startOnboarding();
  } else {
    arrivalTime = profile.arrival_time || "09:00";
    await loadDashboard();
  }
}

// ─────────────────────────────────────────────
// 8. ONBOARDING
// ─────────────────────────────────────────────
function startOnboarding() {
  document.getElementById("arrival-time").value = arrivalTime;
  updateTimePreview();
  showView("onboard-1");
}

function updateTimePreview() {
  const val   = document.getElementById("arrival-time").value || arrivalTime;
  const total = onboardBlocks.reduce((s, b) => s + getBlockDurationMin(b), 0);
  const start = minsToTime(timeToMins(val) - total);
  const el    = document.getElementById("time-preview");
  if (el) el.innerHTML = `Your routine will start at <strong>${formatDisplayTime(start)}</strong> (${total} min total)`;
}

function renderOnboardBlocks() {
  const timed     = calcBlockTimes(onboardBlocks, arrivalTime);
  const container = document.getElementById("blocks-list");
  container.innerHTML = "";

  timed.forEach((block, idx) => {
    const item = document.createElement("div");
    item.className   = "block-item";
    item.draggable   = true;
    item.dataset.idx = idx;

    const durationLabel = block.duration_min
      ? `${block.duration_min} min`
      : `${block.sets}×${block.reps_per_set} reps`;

    const metaLine = block.reps
      ? `${block.reps} total reps · ${block.sets} sets`
      : `${getBlockDurationMin(block)} min`;

    item.innerHTML = `
      <div class="block-drag-handle" aria-label="Drag to reorder">
        <span></span><span></span><span></span>
      </div>
      <div class="block-info">
        <div class="block-time">${formatDisplayTime(block.startTime)}</div>
        <div class="block-name">${block.name}</div>
        <div class="block-meta">${metaLine}</div>
      </div>
      <span class="block-duration-badge">${durationLabel}</span>
    `;

    item.addEventListener("dragstart", e => {
      dragSrcIdx = idx;
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => item.classList.add("dragging"), 0);
    });
    item.addEventListener("dragend",  () => item.classList.remove("dragging"));
    item.addEventListener("dragover", e => { e.preventDefault(); item.classList.add("drag-over"); });
    item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
    item.addEventListener("drop", e => {
      e.preventDefault();
      item.classList.remove("drag-over");
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const moved = onboardBlocks.splice(dragSrcIdx, 1)[0];
      onboardBlocks.splice(idx, 0, moved);
      onboardBlocks.forEach((b, i) => (b.order = i));
      renderOnboardBlocks();
    });

    container.appendChild(item);
  });
}

function updateUrlCount() {
  const textarea = document.getElementById("youtube-urls");
  const parsed   = parseYouTubeURLs(textarea.value);
  const count    = Math.min(parsed.length, 30);

  const el = document.getElementById("url-count");
  if (el) {
    el.textContent = `${count} / 30`;
    el.style.color = count >= 30 ? "var(--c-danger)" : "var(--c-accent)";
  }

  const preview = document.getElementById("url-parse-preview");
  if (!preview) return;

  if (parsed.length === 0) { preview.classList.add("hidden"); return; }

  preview.classList.remove("hidden");
  preview.innerHTML = "";
  parsed.forEach(({ dayNumber, videoId, valid }) => {
    const chip = document.createElement("div");
    chip.className = `parse-chip ${valid ? "valid" : "invalid"}`;
    chip.textContent = valid ? `Day ${dayNumber} ✓` : `Day ${dayNumber} ✗`;
    chip.title = valid ? `Video ID: ${videoId}` : "Could not extract a YouTube video ID";
    preview.appendChild(chip);
  });
}

async function saveOnboarding() {
  const btn = document.getElementById("btn-ob3-finish");
  setButtonLoading(btn, true);

  try {
    const uid = currentUser.id;

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        user_id:             uid,
        arrival_time:        arrivalTime,
        onboarding_complete: true,
        updated_at:          new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (profileError) throw profileError;

    await supabase.from("routine_blocks").delete().eq("user_id", uid);
    const blocksToInsert = onboardBlocks.map((b, i) => ({
      user_id: uid, name: b.name, duration_min: b.duration_min,
      type: b.type, reps: b.reps, sets: b.sets, reps_per_set: b.reps_per_set, order: i,
    }));
    const { error: blocksError } = await supabase.from("routine_blocks").insert(blocksToInsert);
    if (blocksError) throw blocksError;

    const textarea   = document.getElementById("youtube-urls");
    const parsedURLs = parseYouTubeURLs(textarea.value).filter(p => p.valid);

    await supabase.from("breathwork_videos").delete().eq("user_id", uid);
    await supabase.from("youtube_queue").delete().eq("user_id", uid);

    if (parsedURLs.length > 0) {
      const videosToInsert = parsedURLs.map(p => ({
        user_id: uid, video_id: p.videoId, url: p.rawUrl, day_number: p.dayNumber,
      }));
      const { error: vidError } = await supabase.from("breathwork_videos").insert(videosToInsert);
      if (vidError) throw vidError;

      const queueToInsert = parsedURLs.map((p, i) => ({ user_id: uid, url: p.rawUrl, order: i }));
      await supabase.from("youtube_queue").insert(queueToInsert);
    }

    const { data: existingCycle } = await supabase
      .from("challenge_cycles")
      .select("id")
      .eq("user_id", uid)
      .maybeSingle();

    if (!existingCycle) {
      const { error: cycleError } = await supabase
        .from("challenge_cycles")
        .insert({ user_id: uid, start_date: dateKey(), total_resets: 0 });
      if (cycleError) throw cycleError;
    }

    await loadDashboard();

  } catch (err) {
    console.error("saveOnboarding error:", err);
    alert("Error saving your routine: " + (err.message || "Unknown error"));
  } finally {
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────
// 9. CYCLE DAY TRACKING
// ─────────────────────────────────────────────
async function getCurrentCycleDay() {
  const { data: cycle, error } = await supabase
    .from("challenge_cycles")
    .select("id, start_date, total_resets")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error || !cycle) {
    return { cycleDay: 1, startDate: dateKey(), totalResets: 0, cycleId: null };
  }

  const start    = new Date(cycle.start_date + "T00:00:00");
  const today    = new Date(dateKey() + "T00:00:00");
  const diffMs   = today - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const cycleDay = Math.min(Math.max(diffDays + 1, 1), 30);

  return {
    cycleDay,
    startDate:   cycle.start_date,
    totalResets: cycle.total_resets ?? 0,
    cycleId:     cycle.id,
  };
}

// ─────────────────────────────────────────────
// 10. MISSED DAY DETECTION
// ─────────────────────────────────────────────
async function checkMissedDay(cycleDay) {
  if (cycleDay <= 1) return false;

  const yesterday = dateKey(-1);
  const uid       = currentUser.id;

  const { data: yesterdayRows } = await supabase
    .from("daily_completions")
    .select("block_id")
    .eq("user_id", uid)
    .eq("date", yesterday);

  const hadCompletions = yesterdayRows && yesterdayRows.length > 0;

  const { data: summary } = await supabase
    .from("daily_summary")
    .select("is_complete")
    .eq("user_id", uid)
    .eq("date", yesterday)
    .maybeSingle();

  const markedComplete = summary?.is_complete === true;
  const missed = !hadCompletions && !markedComplete;

  if (missed) {
    openMissedDayModal(cycleDay);
    return true;
  }
  return false;
}

function openMissedDayModal(currentCycleDay) {
  const modal       = document.getElementById("modal-missed-day");
  const continueDay = document.getElementById("modal-continue-day");
  const resetCount  = document.getElementById("modal-reset-count");

  if (continueDay) continueDay.textContent = currentCycleDay;

  supabase.from("challenge_cycles")
    .select("total_resets")
    .eq("user_id", currentUser.id)
    .maybeSingle()
    .then(({ data }) => {
      const resets = data?.total_resets ?? 0;
      if (resetCount) {
        resetCount.textContent = resets > 0
          ? `You've restarted ${resets} time${resets > 1 ? "s" : ""} before.`
          : "";
      }
    });

  modal?.classList.remove("hidden");
}

function closeMissedDayModal() {
  document.getElementById("modal-missed-day")?.classList.add("hidden");
}

async function handleRestart() {
  closeMissedDayModal();
  try {
    const { data: cycle } = await supabase
      .from("challenge_cycles")
      .select("id, total_resets")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (cycle) {
      await supabase
        .from("challenge_cycles")
        .update({
          start_date:   dateKey(),
          total_resets: (cycle.total_resets ?? 0) + 1,
        })
        .eq("id", cycle.id);
    }
  } catch (err) {
    console.error("handleRestart error:", err);
  }
  await loadDashboard();
}

async function handleContinue() {
  closeMissedDayModal();
  try {
    await supabase
      .from("daily_summary")
      .upsert({
        user_id:     currentUser.id,
        date:        dateKey(-1),
        is_complete: false,
        was_missed:  true,
      }, { onConflict: "user_id,date" });
  } catch (err) {
    console.error("handleContinue error:", err);
  }
  await loadDashboard();
}

// ─────────────────────────────────────────────
// 11. BREATHWORK VIDEO EMBED
// ─────────────────────────────────────────────
function embedBreathworkVideo(cycleDay, breathworkVideos, blockId, isDone) {
  const videoEntry = breathworkVideos.find(v => v.day_number === cycleDay);
  const hasVideo   = videoEntry && videoEntry.video_id;

  const labelClass = isDone ? "breathwork-label done" : "breathwork-label";

  let videoHTML = "";
  if (hasVideo) {
    const embedUrl = buildEmbedUrl(videoEntry.video_id);
    videoHTML = `
      <div class="video-wrapper">
        <iframe
          src="${embedUrl}"
          title="Breathwork Day ${cycleDay}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          loading="lazy"
        ></iframe>
      </div>
    `;
  } else {
    videoHTML = `
      <div class="video-wrapper">
        <div class="video-placeholder">
          <div class="video-placeholder-icon">🌬️</div>
          <span>No video assigned for Day ${cycleDay}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="breathwork-header">
      <span class="tl-emoji">🌬️</span>
      <span class="${labelClass}">Breathwork</span>
      <span class="breathwork-day-badge">Day ${cycleDay} / 30</span>
    </div>
    ${videoHTML}
    <div class="tl-meta">20 min · Sync to cycle day ${cycleDay}</div>
  `;
}

// ─────────────────────────────────────────────
// 12. DASHBOARD STATE
// ─────────────────────────────────────────────
let dashState = {
  blocks:           [],
  completedIds:     new Set(),
  todayKey:         "",
  arrivalTime:      "09:00",
  totalBlocks:      0,
  cycleDay:         1,
  breathworkVideos: [],
  cycleStartDate:   "",
  totalResets:      0,
};

// ─────────────────────────────────────────────
// 13. EMOJI MAP
// ─────────────────────────────────────────────
const TYPE_EMOJI = {
  workout:    "💪",
  wellness:   "🧘",
  mindset:    "📖",
  hygiene:    "🚿",
  food:       "🍳",
  travel:     "🚶",
  breathwork: "🌬️",
};

const NAME_EMOJI_OVERRIDE = {
  "HIIT Sprints":      "⚡",
  "Breathwork":        "🌬️",
  "Meditation":        "🧘",
  "Journaling":        "✍️",
  "Reading":           "📚",
  "Morning Hygiene":   "🪥",
  "Breakfast":         "🍳",
  "Commute":           "🚌",
  "Push-ups":          "💪",
  "Bodyweight Squats": "🏋️",
};

function blockEmoji(block) {
  return NAME_EMOJI_OVERRIDE[block.name] || TYPE_EMOJI[block.type] || "⏱️";
}

function isBreathworkBlock(block) {
  return block.type === "breathwork" || block.name.toLowerCase().includes("breathwork");
}

// ─────────────────────────────────────────────
// 14. calculateSchedule
// ─────────────────────────────────────────────
function calculateSchedule(arrivalHHMM, blocks) {
  if (!blocks || blocks.length === 0) return [];
  const totalMins    = blocks.reduce((s, b) => s + getBlockDurationMin(b), 0);
  const routineStart = timeToMins(arrivalHHMM) - totalMins;
  let cursor = routineStart;
  return blocks.map(b => {
    const startTime = minsToTime(cursor);
    cursor += getBlockDurationMin(b);
    return { ...b, startTime };
  });
}

// ─────────────────────────────────────────────
// 15. saveDailyProgress
// ─────────────────────────────────────────────
async function saveDailyProgress(blockId, completed) {
  if (completed) {
    const { error } = await supabase
      .from("daily_completions")
      .upsert({
        user_id:  currentUser.id,
        block_id: blockId,
        date:     dashState.todayKey,
      }, { onConflict: "user_id,block_id,date" });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("daily_completions")
      .delete()
      .eq("user_id",  currentUser.id)
      .eq("block_id", blockId)
      .eq("date",     dashState.todayKey);
    if (error) throw error;
  }
}

// ─────────────────────────────────────────────
// 16. markBlockComplete
// ─────────────────────────────────────────────
async function markBlockComplete(blockId) {
  const wasDone = dashState.completedIds.has(blockId);
  const nowDone = !wasDone;

  if (nowDone) dashState.completedIds.add(blockId);
  else         dashState.completedIds.delete(blockId);

  updateTimelineRow(blockId, nowDone);
  updateStatsBar();

  try {
    await saveDailyProgress(blockId, nowDone);
    if (dashState.completedIds.size === dashState.totalBlocks) {
      await supabase.from("daily_summary").upsert({
        user_id:     currentUser.id,
        date:        dashState.todayKey,
        is_complete: true,
        was_missed:  false,
      }, { onConflict: "user_id,date" });
    }
  } catch (err) {
    console.error("markBlockComplete error:", err);
    if (nowDone) dashState.completedIds.delete(blockId);
    else         dashState.completedIds.add(blockId);
    updateTimelineRow(blockId, !nowDone);
    updateStatsBar();
  }
}

// ─────────────────────────────────────────────
// 17. STATS CALCULATIONS
// ─────────────────────────────────────────────
async function fetchCompletionDates() {
  const { data } = await supabase
    .from("daily_completions")
    .select("date")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: false });

  if (!data || data.length === 0) return [];
  const dates = [...new Set(data.map(r => r.date))];
  dates.sort((a, b) => b.localeCompare(a));
  return dates;
}

/**
 * calculateStreak()
 * Counts consecutive completed days (from daily_summary.is_complete = true).
 * Breaks on any missed day.
 */
async function calculateStreak() {
  const { data } = await supabase
    .from("daily_summary")
    .select("date, is_complete")
    .eq("user_id", currentUser.id)
    .eq("is_complete", true)
    .order("date", { ascending: false });

  if (!data || data.length === 0) return 0;

  const today = dateKey();
  let streak  = 0;
  let cursor  = new Date(today + "T00:00:00");

  const completedSet = new Set(data.map(r => r.date));

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (completedSet.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (key === today) {
      cursor.setDate(cursor.getDate() - 1);
      const yest = cursor.toISOString().slice(0, 10);
      if (completedSet.has(yest)) continue;
      break;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * getWeeklyStats()
 * Returns completion percentage for the last 7 days.
 */
async function getWeeklyStats() {
  const today = dateKey();
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(dateKey(-i));
  }

  const { data } = await supabase
    .from("daily_summary")
    .select("date, is_complete")
    .eq("user_id", currentUser.id)
    .in("date", dates);

  const completedCount = (data || []).filter(r => r.is_complete === true).length;
  return Math.round((completedCount / 7) * 100);
}

/**
 * getTotalCompletedDays()
 * Total completed days this cycle (from cycle start_date to today).
 */
async function getTotalCompletedDays(startDate) {
  const { data } = await supabase
    .from("daily_summary")
    .select("date, is_complete")
    .eq("user_id", currentUser.id)
    .eq("is_complete", true)
    .gte("date", startDate)
    .lte("date", dateKey());

  return (data || []).length;
}

function updateStatsBar() {
  const done  = dashState.completedIds.size;
  const total = dashState.totalBlocks;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const pctEl = document.getElementById("stat-pct");
  const fill  = document.getElementById("progress-fill");
  if (pctEl) pctEl.textContent  = `${pct}%`;
  if (fill)  fill.style.width   = `${pct}%`;
}

// ─────────────────────────────────────────────
// 18. TIMELINE UI UPDATERS
// ─────────────────────────────────────────────
function updateTimelineRow(blockId, isDone) {
  const row     = document.querySelector(`.tl-row[data-id="${blockId}"]`);
  const checkEl = document.querySelector(`.tl-check[data-id="${blockId}"]`);
  if (!row || !checkEl) return;

  const bwLabel = row.querySelector(".breathwork-label");

  if (isDone) {
    row.classList.add("done");
    checkEl.setAttribute("aria-checked", "true");
    checkEl.setAttribute("aria-label", "Mark incomplete");
    checkEl.querySelector(".tl-check-ring").innerHTML = checkSVG();
    if (bwLabel) { bwLabel.classList.add("done"); }
  } else {
    row.classList.remove("done");
    checkEl.setAttribute("aria-checked", "false");
    checkEl.setAttribute("aria-label", "Mark complete");
    checkEl.querySelector(".tl-check-ring").innerHTML = "";
    if (bwLabel) { bwLabel.classList.remove("done"); }
  }
}

function checkSVG() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function highlightNowRow(timedBlocks) {
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  let nowBlockId = null;
  for (const b of timedBlocks) {
    const start = timeToMins(b.startTime);
    const end   = start + getBlockDurationMin(b);
    if (nowMins >= start && nowMins < end) { nowBlockId = b.id; break; }
  }
  document.querySelectorAll(".tl-row").forEach(r => r.classList.remove("tl-now"));
  if (nowBlockId) {
    const row = document.querySelector(`.tl-row[data-id="${nowBlockId}"]`);
    if (row) row.classList.add("tl-now");
  }
}

// ─────────────────────────────────────────────
// 19. CALENDAR RENDERING
// ─────────────────────────────────────────────

/**
 * renderCalendar(cycleDay, startDate, allSummaries)
 * Renders a 30-day grid showing completion status for each day.
 * Color coding:
 *   - Green = completed (is_complete = true)
 *   - Red   = missed + continued (was_missed = true, is_complete = false)
 *   - Yellow = missed + restarted (inferred: gap in dates with a new start_date)
 *   - Gray  = future days
 *   - Purple ring = current day
 */
async function renderCalendar(cycleDay, startDate) {
  const container = document.getElementById("calendar-grid");
  if (!container) return;
  container.innerHTML = "";

  // Fetch all daily_summary rows for this cycle
  const { data: summaries } = await supabase
    .from("daily_summary")
    .select("date, is_complete, was_missed")
    .eq("user_id", currentUser.id)
    .gte("date", startDate)
    .lte("date", dateKey());

  const summaryMap = {};
  (summaries || []).forEach(s => {
    summaryMap[s.date] = s;
  });

  // Determine restart days by checking for gaps in the cycle
  const restartDays = await getRestartDays(startDate);

  for (let day = 1; day <= 30; day++) {
    const dayDate = addDays(startDate, day - 1);
    const summary = summaryMap[dayDate];

    let state = "future";
    let icon  = "";

    if (day < cycleDay) {
      // Past day
      if (summary?.is_complete === true) {
        state = "completed";
        icon  = "✓";
      } else if (restartDays.has(dayDate)) {
        state = "missed-restart";
        icon  = "↺";
      } else if (summary?.was_missed === true) {
        state = "missed-continue";
        icon  = "✗";
      } else {
        // No summary = assumed missed
        state = "missed-continue";
        icon  = "✗";
      }
    } else if (day === cycleDay) {
      // Current day
      if (summary?.is_complete === true) {
        state = "completed";
        icon  = "✓";
      } else {
        state = "future";
      }
    }

    const cell = document.createElement("div");
    cell.className = `cal-day ${state}`;
    if (day === cycleDay) cell.classList.add("current");
    cell.dataset.day  = day;
    cell.dataset.date = dayDate;
    cell.setAttribute("role", "button");
    cell.setAttribute("aria-label", `Day ${day}`);

    cell.innerHTML = `
      <span class="cal-day-num">${day}</span>
      ${icon ? `<span class="cal-day-check">${icon}</span>` : ""}
    `;

    if (state !== "future") {
      cell.addEventListener("click", () => showDayDetails(day, dayDate, state, summary));
    }

    container.appendChild(cell);
  }
}

function addDays(yyyymmdd, days) {
  const d = new Date(yyyymmdd + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * getRestartDays(startDate)
 * Returns a Set of date strings where the user restarted the cycle.
 * This is inferred by checking if there was a gap followed by a new streak.
 */
async function getRestartDays(startDate) {
  // For simplicity, we'll look at challenge_cycles updates or just return empty
  // In a full implementation, you'd track each restart's date
  return new Set();
}

// ─────────────────────────────────────────────
// 20. DAY DETAILS MODAL
// ─────────────────────────────────────────────

/**
 * showDayDetails(day, date, state, summary)
 * Opens a modal showing:
 *   - Day number & date
 *   - Status (completed, missed, restarted)
 *   - List of blocks with completion checkmarks
 */
async function showDayDetails(day, date, state, summary) {
  const modal = document.getElementById("modal-day-details");
  if (!modal) return;

  // Set header
  document.getElementById("modal-day-icon").textContent = 
    state === "completed" ? "✅" : 
    state === "missed-continue" ? "❌" :
    state === "missed-restart" ? "↺" : "📅";

  document.getElementById("modal-day-title").textContent = `DAY ${day}`;
  document.getElementById("modal-day-date").textContent = formatDateLong(date);

  // Status
  const statusEl = document.getElementById("modal-day-status");
  statusEl.className = `modal-day-status ${state}`;
  statusEl.textContent = 
    state === "completed" ? "✓ Completed" :
    state === "missed-continue" ? "✗ Missed (Continued)" :
    state === "missed-restart" ? "↺ Missed (Restarted)" :
    "Future Day";

  // Fetch completions for this day
  const { data: dayCompletions } = await supabase
    .from("daily_completions")
    .select("block_id")
    .eq("user_id", currentUser.id)
    .eq("date", date);

  const completedIds = new Set((dayCompletions || []).map(c => c.block_id));

  // Fetch blocks
  const { data: blocks } = await supabase
    .from("routine_blocks")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("order", { ascending: true });

  const blocksContainer = document.getElementById("modal-day-blocks");
  blocksContainer.innerHTML = "";

  (blocks || []).forEach(block => {
    const done = completedIds.has(block.id);
    const row  = document.createElement("div");
    row.className = `modal-block-row${done ? " done" : ""}`;
    row.innerHTML = `
      <span class="modal-block-check">${done ? "✓" : "○"}</span>
      <span class="modal-block-name">${block.name}</span>
    `;
    blocksContainer.appendChild(row);
  });

  modal.classList.remove("hidden");
}

function closeDayDetailsModal() {
  document.getElementById("modal-day-details")?.classList.add("hidden");
}

// ─────────────────────────────────────────────
// 21. loadDashboard
// ─────────────────────────────────────────────
async function loadDashboard() {
  showView("dashboard");

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Rise and grind" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  document.getElementById("dash-greeting").textContent = greeting;

  dashState.todayKey = dateKey();

  const [
    { data: rawBlocks },
    { data: profile },
    { data: completions },
    { data: ytUrls },
    { data: breathworkVids },
    cycleInfo,
    streak,
    weeklyPct,
  ] = await Promise.all([
    supabase.from("routine_blocks").select("*").eq("user_id", currentUser.id).order("order", { ascending: true }),
    supabase.from("profiles").select("arrival_time").eq("user_id", currentUser.id).maybeSingle(),
    supabase.from("daily_completions").select("block_id").eq("user_id", currentUser.id).eq("date", dashState.todayKey),
    supabase.from("youtube_queue").select("url, order").eq("user_id", currentUser.id).order("order", { ascending: true }),
    supabase.from("breathwork_videos").select("video_id, day_number, url").eq("user_id", currentUser.id).order("day_number", { ascending: true }),
    getCurrentCycleDay(),
    calculateStreak(),
    getWeeklyStats(),
  ]);

  dashState.arrivalTime      = profile?.arrival_time || "09:00";
  dashState.blocks           = calculateSchedule(dashState.arrivalTime, rawBlocks || []);
  dashState.completedIds     = new Set((completions || []).map(c => c.block_id));
  dashState.totalBlocks      = dashState.blocks.length;
  dashState.cycleDay         = cycleInfo.cycleDay;
  dashState.breathworkVideos = breathworkVids || [];
  dashState.cycleStartDate   = cycleInfo.startDate;
  dashState.totalResets      = cycleInfo.totalResets;

  const pct = dashState.totalBlocks > 0
    ? Math.round((dashState.completedIds.size / dashState.totalBlocks) * 100) : 0;

  const el = (id) => document.getElementById(id);
  if (el("stat-day"))    el("stat-day").textContent    = `${dashState.cycleDay}`;
  if (el("stat-streak")) el("stat-streak").textContent = `${streak} 🔥`;
  if (el("stat-pct"))    el("stat-pct").textContent    = `${pct}%`;
  if (el("progress-fill")) el("progress-fill").style.width = `${pct}%`;

  // Additional stats
  if (el("stat-weekly-pct")) el("stat-weekly-pct").textContent = `${weeklyPct}%`;
  if (el("stat-total-resets")) el("stat-total-resets").textContent = `${dashState.totalResets}`;

  const totalCompleted = await getTotalCompletedDays(dashState.cycleStartDate);
  if (el("stat-total-completed")) el("stat-total-completed").textContent = `${totalCompleted}`;

  // Check missed day
  const wasMissed = await checkMissedDay(dashState.cycleDay);
  if (wasMissed) return;

  // Render calendar
  await renderCalendar(dashState.cycleDay, dashState.cycleStartDate);

  // Render timeline
  renderTimeline(dashState.blocks, dashState.completedIds, dashState.arrivalTime, dashState.cycleDay, dashState.breathworkVideos);

  highlightNowRow(dashState.blocks);
  clearInterval(window._nowInterval);
  window._nowInterval = setInterval(() => highlightNowRow(dashState.blocks), 60_000);

  renderYouTubeList(ytUrls || [], dashState.cycleDay);
}

// ─────────────────────────────────────────────
// 22. renderTimeline
// ─────────────────────────────────────────────
function renderTimeline(timedBlocks, completedIds, arrivalHHMM, cycleDay, breathworkVideos) {
  const container = document.getElementById("timeline");
  if (!container) return;
  container.innerHTML = "";

  if (timedBlocks.length === 0) {
    container.innerHTML = `<p style="color:var(--c-text-dim);padding:var(--sp-md);">No blocks found. Complete onboarding to set up your routine.</p>`;
    return;
  }

  const sep = document.createElement("div");
  sep.className   = "tl-section-label";
  sep.textContent = "MORNING ROUTINE";
  container.appendChild(sep);

  timedBlocks.forEach(block => {
    const isDone      = completedIds.has(block.id);
    const isBW        = isBreathworkBlock(block);
    const durationLbl = block.duration_min
      ? `${block.duration_min} min`
      : `${block.sets} × ${block.reps_per_set} reps`;

    const row = document.createElement("div");
    row.className  = `tl-row${isDone ? " done" : ""}${isBW ? " tl-breathwork" : ""}`;
    row.dataset.id = block.id;
    row.setAttribute("role", "listitem");

    let bodyHTML;
    if (isBW) {
      bodyHTML = `<div class="breathwork-block">${embedBreathworkVideo(cycleDay, breathworkVideos, block.id, isDone)}</div>`;
    } else {
      const emoji = blockEmoji(block);
      bodyHTML = `
        <div class="tl-body">
          <div class="tl-name">
            <span class="tl-emoji">${emoji}</span>
            ${block.name}
          </div>
          <div class="tl-meta">${durationLbl}</div>
        </div>
      `;
    }

    row.innerHTML = `
      <div class="tl-time">${formatDisplayTime(block.startTime)}</div>
      ${bodyHTML}
      <button
        class="tl-check"
        data-id="${block.id}"
        aria-checked="${isDone}"
        aria-label="${isDone ? "Mark incomplete" : "Mark complete"}"
        type="button"
      >
        <span class="tl-check-ring">${isDone ? checkSVG() : ""}</span>
      </button>
    `;

    row.querySelector(".tl-check").addEventListener("click", () => markBlockComplete(block.id));
    container.appendChild(row);
  });

  const arrRow = document.createElement("div");
  arrRow.className = "tl-row tl-arrival";
  arrRow.setAttribute("role", "listitem");
  arrRow.innerHTML = `
    <div class="tl-time">${formatDisplayTime(arrivalHHMM)}</div>
    <div class="tl-body">
      <div class="tl-name"><span class="tl-emoji">🎯</span>Arrive at Work</div>
    </div>
    <div style="width:44px"></div>
  `;
  container.appendChild(arrRow);
}

// ─────────────────────────────────────────────
// 23. renderYouTubeList
// ─────────────────────────────────────────────
function renderYouTubeList(urls, cycleDay) {
  const container = document.getElementById("dash-youtube-list");
  if (!container) return;

  if (urls.length === 0) {
    container.innerHTML = `<p style="color:var(--c-text-dim);font-size:0.85rem;">No breathwork videos in queue.</p>`;
    return;
  }

  container.innerHTML = "";
  urls.forEach(({ url }, idx) => {
    const dayNum   = idx + 1;
    const isToday  = dayNum === cycleDay;
    const videoId  = extractYouTubeId(url);
    const item     = document.createElement("div");
    item.className = `yt-item${isToday ? " active-day" : ""}`;

    item.innerHTML = `
      <span class="yt-day-badge">Day ${dayNum}</span>
      <svg class="yt-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
      </svg>
      <a href="${url}" target="_blank" rel="noopener">${videoId ? `youtu.be/${videoId}` : url}</a>
    `;
    container.appendChild(item);
  });
}

// ─────────────────────────────────────────────
// 24. EVENT LISTENERS
// ─────────────────────────────────────────────
function initEventListeners() {
  document.getElementById("btn-login") ?.addEventListener("click", login);
  document.getElementById("btn-signup")?.addEventListener("click", signup);
  document.getElementById("btn-logout")?.addEventListener("click", logout);

  document.getElementById("goto-signup")?.addEventListener("click", e => { e.preventDefault(); showView("signup"); });
  document.getElementById("goto-login") ?.addEventListener("click", e => { e.preventDefault(); showView("login");  });

  ["login-password","login-email"].forEach(id => {
    document.getElementById(id)?.addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  });
  ["signup-password","signup-email"].forEach(id => {
    document.getElementById(id)?.addEventListener("keydown", e => { if (e.key === "Enter") signup(); });
  });

  const arrivalInput = document.getElementById("arrival-time");
  arrivalInput?.addEventListener("input", () => {
    arrivalTime = arrivalInput.value || "09:00";
    updateTimePreview();
  });

  document.getElementById("btn-ob1-next")?.addEventListener("click", () => {
    arrivalTime = document.getElementById("arrival-time").value || "09:00";
    renderOnboardBlocks();
    showView("onboard-2");
  });

  document.getElementById("btn-ob2-next")?.addEventListener("click", () => showView("onboard-3"));

  document.getElementById("youtube-urls")?.addEventListener("input", updateUrlCount);
  document.getElementById("btn-ob3-finish")?.addEventListener("click", saveOnboarding);

  document.getElementById("btn-modal-restart") ?.addEventListener("click", handleRestart);
  document.getElementById("btn-modal-continue")?.addEventListener("click", handleContinue);

  document.getElementById("modal-missed-day")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closeMissedDayModal();
  });

  document.getElementById("btn-close-day-modal")?.addEventListener("click", closeDayDetailsModal);
  document.getElementById("modal-day-details")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closeDayDetailsModal();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeMissedDayModal();
      closeDayDetailsModal();
    }
  });
}

// ─────────────────────────────────────────────
// 25. AUTH STATE LISTENER
// ─────────────────────────────────────────────
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_OUT") { currentUser = null; showView("login"); }
});

// ─────────────────────────────────────────────
// 26. INIT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  checkAuth();
});
