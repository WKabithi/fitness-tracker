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
const VIEWS = ["loader","login","signup","onboard-1","onboard-2","onboard-3","dashboard","history","partners","settings"];

function showView(name) {
  VIEWS.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (!el) return;
    if (v === name) { el.classList.remove("hidden"); el.classList.add("active"); }
    else            { el.classList.add("hidden");    el.classList.remove("active"); }
  });
  
  // Show/hide navigation based on view
  const authViews = ['loader', 'login', 'signup', 'onboard-1', 'onboard-2', 'onboard-3'];
  if (authViews.includes(name)) {
    hideBottomNav();
  } else {
    showBottomNav();
  }
}

function showBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.classList.remove('hidden');
}

function hideBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.classList.add('hidden');
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
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
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
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
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
  await supabaseClient.auth.signOut();
  currentUser = null;
  window.location.hash = ''; // Clear hash
  showView("login");
}

async function checkAuth() {
  showView("loader");
  const { data: { session } } = await supabaseClient.auth.getSession();
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
    // Navigate to dashboard using hash routing
    window.location.hash = 'dashboard';
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

    // Auto-save first template
    await autoSaveFirstTemplate();
    
    // Auto-save first playlist
    await autoSaveFirstPlaylist();

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

  document.getElementById("btn-close-cycle-detail")?.addEventListener("click", closeCycleDetailModal);
  document.getElementById("modal-cycle-detail")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closeCycleDetailModal();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeMissedDayModal();
      closeDayDetailsModal();
      closeChangePasswordModal();
      closeDeleteAccountModal();
      closeTemplateModal();
      closeBlockModal();
      closeApplyTemplateModal();
      closeDeleteTemplateModal();
      closePlaylistModal();
      closePlaylistPreview();
      closeDeletePlaylistModal();
      closeCycleDetailModal();
      closeInvitePartnerModal();
      closeRemovePartnerModal();
    }
  });
  
  // Navigation event listeners
  initNavigation();
  
  // Settings page event listeners
  document.getElementById("btn-change-password")?.addEventListener("click", openChangePasswordModal);
  document.getElementById("btn-settings-logout")?.addEventListener("click", logout);
  document.getElementById("btn-cancel-password")?.addEventListener("click", closeChangePasswordModal);
  document.getElementById("btn-save-password")?.addEventListener("click", changePassword);
  
  // Delete account event listeners
  document.getElementById("btn-delete-account")?.addEventListener("click", openDeleteAccountModal);
  document.getElementById("btn-cancel-delete")?.addEventListener("click", closeDeleteAccountModal);
  document.getElementById("btn-confirm-delete")?.addEventListener("click", async () => {
    closeDeleteAccountModal();
    await deleteAccount();
  });
  
  // Password change on Enter key
  ['new-password', 'confirm-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') changePassword();
    });
  });
  
  // Close modals on backdrop click
  document.getElementById('modal-change-password')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeChangePasswordModal();
  });
  document.getElementById('modal-delete-account')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDeleteAccountModal();
  });
  
  // Template management event listeners
  document.getElementById('btn-create-template')?.addEventListener('click', () => openTemplateModal());
  document.getElementById('btn-close-template')?.addEventListener('click', closeTemplateModal);
  document.getElementById('btn-cancel-template')?.addEventListener('click', closeTemplateModal);
  document.getElementById('btn-save-template')?.addEventListener('click', saveTemplate);
  document.getElementById('modal-template')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTemplateModal();
  });
  
  // Block management event listeners
  document.getElementById('btn-add-template-block')?.addEventListener('click', () => openBlockModal());
  document.getElementById('btn-close-block')?.addEventListener('click', closeBlockModal);
  document.getElementById('btn-cancel-block')?.addEventListener('click', closeBlockModal);
  document.getElementById('btn-save-block')?.addEventListener('click', saveBlock);
  document.getElementById('modal-block')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBlockModal();
  });
  
  // Block duration type radio buttons
  document.querySelectorAll('input[name="block-duration-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const durationType = document.querySelector('input[name="block-duration-type"]:checked').value;
      const durationInput = document.getElementById('block-duration');
      const setsInput = document.getElementById('block-sets');
      const repsInput = document.getElementById('block-reps-per-set');
      
      if (durationType === 'time') {
        durationInput.disabled = false;
        setsInput.disabled = true;
        repsInput.disabled = true;
      } else {
        durationInput.disabled = true;
        setsInput.disabled = false;
        repsInput.disabled = false;
      }
    });
  });
  
  // Apply template modal
  document.getElementById('btn-cancel-apply')?.addEventListener('click', closeApplyTemplateModal);
  document.getElementById('modal-apply-template')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeApplyTemplateModal();
  });
  
  // Delete template modal
  document.getElementById('btn-cancel-delete-template')?.addEventListener('click', closeDeleteTemplateModal);
  document.getElementById('modal-delete-template')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDeleteTemplateModal();
  });
  
  // Playlist tabs
  document.querySelectorAll('.playlist-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchPlaylistTab(tab.dataset.tab);
    });
  });
  
  // Playlist management event listeners
  document.getElementById('btn-create-playlist')?.addEventListener('click', () => openPlaylistModal());
  document.getElementById('btn-close-playlist')?.addEventListener('click', closePlaylistModal);
  document.getElementById('btn-cancel-playlist')?.addEventListener('click', closePlaylistModal);
  document.getElementById('btn-save-playlist')?.addEventListener('click', savePlaylist);
  document.getElementById('modal-playlist')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closePlaylistModal();
  });
  
  // Playlist URL input
  document.getElementById('playlist-urls')?.addEventListener('input', () => {
    updatePlaylistUrlCount();
    parsePlaylistUrls();
  });
  
  // Playlist preview modal
  document.getElementById('btn-close-playlist-preview')?.addEventListener('click', closePlaylistPreview);
  document.getElementById('modal-playlist-preview')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closePlaylistPreview();
  });
  
  // Delete playlist modal
  document.getElementById('btn-cancel-delete-playlist')?.addEventListener('click', closeDeletePlaylistModal);
  document.getElementById('modal-delete-playlist')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDeletePlaylistModal();
  });
  
  // Community search
  document.getElementById('community-search')?.addEventListener('input', e => {
    const searchTerm = e.target.value.trim();
    loadCommunityPlaylists(searchTerm);
  });
  
  // Cycle detail modal
  document.getElementById('btn-close-cycle-detail')?.addEventListener('click', closeCycleDetailModal);
  document.getElementById('modal-cycle-detail')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCycleDetailModal();
  });
  
  // Partner event listeners
  document.getElementById('btn-invite-partner')?.addEventListener('click', openInvitePartnerModal);
  document.getElementById('btn-settings-manage-partner')?.addEventListener('click', () => {
    window.location.hash = 'partners';
  });
  document.getElementById('btn-remove-partner')?.addEventListener('click', openRemovePartnerModal);
  
  // Invite partner modal
  document.getElementById('btn-cancel-invite')?.addEventListener('click', closeInvitePartnerModal);
  document.getElementById('btn-send-invite')?.addEventListener('click', sendPartnerInvite);
  document.getElementById('modal-invite-partner')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeInvitePartnerModal();
  });
  
  // Remove partner modal
  document.getElementById('btn-cancel-remove-partner')?.addEventListener('click', closeRemovePartnerModal);
  document.getElementById('btn-confirm-remove-partner')?.addEventListener('click', removePartner);
  document.getElementById('modal-remove-partner')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeRemovePartnerModal();
  });
}

// ─────────────────────────────────────────────
// 25. NAVIGATION
// ─────────────────────────────────────────────
function initNavigation() {
  const navTabs = document.querySelectorAll('.nav-tab');
  const bottomNav = document.getElementById('bottom-nav');
  
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const viewName = tab.dataset.view;
      navigateToView(viewName);
    });
  });
  
  // Handle hash changes (browser back/forward)
  window.addEventListener('hashchange', handleHashChange);
  
  // Handle initial hash on load
  handleHashChange();
}

function navigateToView(viewName) {
  // Update hash (triggers hashchange event)
  window.location.hash = viewName;
}

function handleHashChange() {
  const hash = window.location.hash.slice(1); // Remove #
  const validViews = ['dashboard', 'history', 'partners', 'settings'];
  const viewName = validViews.includes(hash) ? hash : 'dashboard';
  
  // Show the view
  showAppView(viewName);
  
  // Update nav tabs
  updateNavTabs(viewName);
  
  // Load view-specific data
  if (viewName === 'settings') {
    loadSettingsPage();
  } else if (viewName === 'history') {
    loadHistoryPage();
  } else if (viewName === 'partners') {
    loadPartnersPage();
  }
}

function showAppView(viewName) {
  // Hide all app views
  ['dashboard', 'history', 'partners', 'settings'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === viewName) {
        el.classList.remove('hidden');
        el.classList.add('active');
      } else {
        el.classList.add('hidden');
        el.classList.remove('active');
      }
    }
  });
}

function updateNavTabs(activeView) {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.dataset.view === activeView) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

// ─────────────────────────────────────────────
// 26. SETTINGS PAGE
// ─────────────────────────────────────────────
function loadSettingsPage() {
  if (!currentUser) return;
  
  // Display user email
  const emailEl = document.getElementById('settings-email');
  if (emailEl) emailEl.textContent = currentUser.email;
  
  // Load templates, playlists, and partner
  loadTemplates();
  loadPlaylists();
  loadPartner();
}

// ─────────────────────────────────────────────
// 27. ROUTINE TEMPLATES
// ─────────────────────────────────────────────
let templateEditorState = {
  isEditing: false,
  editingId: null,
  blocks: []
};

let blockEditorState = {
  isEditing: false,
  editingIndex: null
};

async function loadTemplates() {
  try {
    const { data, error } = await supabase
      .from('routine_templates')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    renderTemplates(data || []);
  } catch (error) {
    console.error('Error loading templates:', error);
  }
}

function renderTemplates(templates) {
  const container = document.getElementById('templates-container');
  const emptyState = document.getElementById('templates-empty');
  
  if (!container) return;
  
  // Remove existing template cards (keep empty state)
  container.querySelectorAll('.template-card').forEach(card => card.remove());
  
  if (templates.length === 0) {
    emptyState?.classList.remove('hidden');
    return;
  }
  
  emptyState?.classList.add('hidden');
  
  templates.forEach(template => {
    const card = createTemplateCard(template);
    container.insertBefore(card, emptyState);
  });
}

function createTemplateCard(template) {
  const card = document.createElement('div');
  card.className = 'template-card';
  
  const blocks = Array.isArray(template.blocks) ? template.blocks : [];
  const totalDuration = blocks.reduce((sum, b) => sum + (b.duration_min || (b.sets * 2) || 10), 0);
  const createdDate = new Date(template.created_at).toLocaleDateString();
  
  card.innerHTML = `
    <div class="template-header">
      <div class="template-name">${template.name}</div>
    </div>
    <div class="template-meta">
      <span>📦 ${blocks.length} blocks</span>
      <span>⏱️ ${totalDuration} min</span>
      <span>🕐 ${template.arrival_time}</span>
      <span>📅 ${createdDate}</span>
    </div>
    <div class="template-actions">
      <button class="btn btn-primary" data-action="apply" data-id="${template.id}" data-name="${template.name}">
        Use This
      </button>
      <button class="btn btn-ghost" data-action="edit" data-id="${template.id}">
        Edit
      </button>
      <button class="btn btn-danger" data-action="delete" data-id="${template.id}" data-name="${template.name}">
        Delete
      </button>
    </div>
  `;
  
  // Add event listeners
  card.querySelector('[data-action="apply"]').addEventListener('click', () => {
    openApplyTemplateModal(template.id, template.name);
  });
  
  card.querySelector('[data-action="edit"]').addEventListener('click', () => {
    editTemplate(template.id);
  });
  
  card.querySelector('[data-action="delete"]').addEventListener('click', () => {
    openDeleteTemplateModal(template.id, template.name);
  });
  
  return card;
}

function openTemplateModal(template = null) {
  const modal = document.getElementById('modal-template');
  const title = document.getElementById('modal-template-title');
  const nameInput = document.getElementById('template-name');
  const arrivalInput = document.getElementById('template-arrival');
  
  // Reset state
  templateEditorState = {
    isEditing: !!template,
    editingId: template?.id || null,
    blocks: template ? [...template.blocks] : []
  };
  
  // Set modal title
  title.textContent = template ? 'Edit Routine' : 'Create Routine';
  
  // Set values
  nameInput.value = template?.name || '';
  arrivalInput.value = template?.arrival_time || '09:00';
  
  // Render blocks
  renderTemplateBlocks();
  
  // Show modal
  modal?.classList.remove('hidden');
  hideError('template-error');
}

function closeTemplateModal() {
  const modal = document.getElementById('modal-template');
  modal?.classList.add('hidden');
  templateEditorState = { isEditing: false, editingId: null, blocks: [] };
}

function renderTemplateBlocks() {
  const container = document.getElementById('template-blocks-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (templateEditorState.blocks.length === 0) {
    container.innerHTML = '<p style="color: var(--c-text-dim); text-align: center; padding: 1rem; font-size: 0.85rem;">No blocks yet. Add your first one!</p>';
    return;
  }
  
  templateEditorState.blocks.forEach((block, index) => {
    const item = document.createElement('div');
    item.className = 'template-block-item';
    item.draggable = true;
    item.dataset.index = index;
    
    const durationText = block.duration_min 
      ? `${block.duration_min} min`
      : `${block.sets} × ${block.reps_per_set} reps`;
    
    item.innerHTML = `
      <div class="template-block-drag">⋮⋮</div>
      <div class="template-block-info">
        <div class="template-block-name">${block.name}</div>
        <div class="template-block-duration">${durationText} · ${block.type}</div>
      </div>
      <div class="template-block-actions">
        <button class="btn btn-ghost" data-action="edit" data-index="${index}">Edit</button>
        <button class="btn btn-danger" data-action="delete" data-index="${index}">×</button>
      </div>
    `;
    
    // Drag events
    item.addEventListener('dragstart', handleBlockDragStart);
    item.addEventListener('dragover', handleBlockDragOver);
    item.addEventListener('drop', handleBlockDrop);
    item.addEventListener('dragend', handleBlockDragEnd);
    
    // Button events
    item.querySelector('[data-action="edit"]').addEventListener('click', () => {
      openBlockModal(index);
    });
    
    item.querySelector('[data-action="delete"]').addEventListener('click', () => {
      templateEditorState.blocks.splice(index, 1);
      renderTemplateBlocks();
    });
    
    container.appendChild(item);
  });
}

let draggedBlockIndex = null;

function handleBlockDragStart(e) {
  draggedBlockIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.style.opacity = '0.5';
}

function handleBlockDragOver(e) {
  e.preventDefault();
}

function handleBlockDrop(e) {
  e.preventDefault();
  const dropIndex = parseInt(e.currentTarget.dataset.index);
  
  if (draggedBlockIndex !== null && draggedBlockIndex !== dropIndex) {
    const blocks = templateEditorState.blocks;
    const [removed] = blocks.splice(draggedBlockIndex, 1);
    blocks.splice(dropIndex, 0, removed);
    renderTemplateBlocks();
  }
}

function handleBlockDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  draggedBlockIndex = null;
}

async function saveTemplate() {
  const name = document.getElementById('template-name').value.trim();
  const arrivalTime = document.getElementById('template-arrival').value;
  
  // Validation
  if (!name) {
    showError('template-error', 'Please enter a routine name');
    return;
  }
  
  if (templateEditorState.blocks.length === 0) {
    showError('template-error', 'Please add at least one block');
    return;
  }
  
  try {
    const templateData = {
      user_id: currentUser.id,
      name,
      arrival_time: arrivalTime,
      blocks: templateEditorState.blocks
    };
    
    if (templateEditorState.isEditing) {
      // Update existing
      const { error } = await supabase
        .from('routine_templates')
        .update(templateData)
        .eq('id', templateEditorState.editingId);
      
      if (error) throw error;
    } else {
      // Create new
      const { error } = await supabase
        .from('routine_templates')
        .insert([templateData]);
      
      if (error) throw error;
    }
    
    // Success
    closeTemplateModal();
    await loadTemplates();
    
  } catch (error) {
    console.error('Error saving template:', error);
    showError('template-error', error.message);
  }
}

async function editTemplate(templateId) {
  try {
    const { data, error } = await supabase
      .from('routine_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (error) throw error;
    
    openTemplateModal(data);
  } catch (error) {
    console.error('Error loading template:', error);
    alert('Error loading template');
  }
}

function openBlockModal(blockIndex = null) {
  const modal = document.getElementById('modal-block');
  const title = document.getElementById('modal-block-title');
  
  blockEditorState = {
    isEditing: blockIndex !== null,
    editingIndex: blockIndex
  };
  
  title.textContent = blockIndex !== null ? 'Edit Block' : 'Add Block';
  
  // Clear/set values
  if (blockIndex !== null) {
    const block = templateEditorState.blocks[blockIndex];
    document.getElementById('block-name').value = block.name;
    document.getElementById('block-type').value = block.type;
    
    if (block.duration_min) {
      document.querySelector('input[name="block-duration-type"][value="time"]').checked = true;
      document.getElementById('block-duration').value = block.duration_min;
      document.getElementById('block-duration').disabled = false;
      document.getElementById('block-sets').disabled = true;
      document.getElementById('block-reps-per-set').disabled = true;
    } else {
      document.querySelector('input[name="block-duration-type"][value="reps"]').checked = true;
      document.getElementById('block-sets').value = block.sets;
      document.getElementById('block-reps-per-set').value = block.reps_per_set;
      document.getElementById('block-duration').disabled = true;
      document.getElementById('block-sets').disabled = false;
      document.getElementById('block-reps-per-set').disabled = false;
    }
  } else {
    document.getElementById('block-name').value = '';
    document.getElementById('block-type').value = 'workout';
    document.querySelector('input[name="block-duration-type"][value="time"]').checked = true;
    document.getElementById('block-duration').value = '10';
    document.getElementById('block-duration').disabled = false;
    document.getElementById('block-sets').value = '';
    document.getElementById('block-reps-per-set').value = '';
    document.getElementById('block-sets').disabled = true;
    document.getElementById('block-reps-per-set').disabled = true;
  }
  
  modal?.classList.remove('hidden');
  hideError('block-error');
}

function closeBlockModal() {
  const modal = document.getElementById('modal-block');
  modal?.classList.add('hidden');
  blockEditorState = { isEditing: false, editingIndex: null };
}

function saveBlock() {
  const name = document.getElementById('block-name').value.trim();
  const type = document.getElementById('block-type').value;
  const durationType = document.querySelector('input[name="block-duration-type"]:checked').value;
  
  if (!name) {
    showError('block-error', 'Please enter a block name');
    return;
  }
  
  const block = { name, type };
  
  if (durationType === 'time') {
    const duration = parseInt(document.getElementById('block-duration').value);
    if (!duration || duration < 1) {
      showError('block-error', 'Please enter a valid duration');
      return;
    }
    block.duration_min = duration;
    block.sets = null;
    block.reps = null;
    block.reps_per_set = null;
  } else {
    const sets = parseInt(document.getElementById('block-sets').value);
    const repsPerSet = parseInt(document.getElementById('block-reps-per-set').value);
    
    if (!sets || !repsPerSet || sets < 1 || repsPerSet < 1) {
      showError('block-error', 'Please enter valid sets and reps');
      return;
    }
    
    block.duration_min = null;
    block.sets = sets;
    block.reps = sets * repsPerSet;
    block.reps_per_set = repsPerSet;
  }
  
  if (blockEditorState.isEditing) {
    templateEditorState.blocks[blockEditorState.editingIndex] = block;
  } else {
    templateEditorState.blocks.push(block);
  }
  
  closeBlockModal();
  renderTemplateBlocks();
}

function openApplyTemplateModal(templateId, templateName) {
  const modal = document.getElementById('modal-apply-template');
  const nameEl = document.getElementById('apply-template-name');
  const confirmBtn = document.getElementById('btn-confirm-apply');
  
  nameEl.textContent = templateName;
  modal?.classList.remove('hidden');
  
  // Replace event listener
  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
  newBtn.addEventListener('click', () => applyTemplate(templateId));
}

function closeApplyTemplateModal() {
  const modal = document.getElementById('modal-apply-template');
  modal?.classList.add('hidden');
}

async function applyTemplate(templateId) {
  try {
    // Get template
    const { data: template, error: templateError } = await supabase
      .from('routine_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (templateError) throw templateError;
    
    // Save current routine as template first (if not already saved)
    await saveCurrentRoutineAsTemplate();
    
    // Delete existing blocks
    await supabase
      .from('routine_blocks')
      .delete()
      .eq('user_id', currentUser.id);
    
    // Insert new blocks from template
    const newBlocks = template.blocks.map((block, index) => ({
      user_id: currentUser.id,
      name: block.name,
      type: block.type,
      duration_min: block.duration_min,
      sets: block.sets,
      reps: block.reps,
      reps_per_set: block.reps_per_set,
      order: index
    }));
    
    await supabase
      .from('routine_blocks')
      .insert(newBlocks);
    
    // Update arrival time in profile
    await supabase
      .from('profiles')
      .update({ arrival_time: template.arrival_time })
      .eq('user_id', currentUser.id);
    
    // Restart cycle
    await handleRestart();
    
    closeApplyTemplateModal();
    
    // Reload dashboard
    window.location.hash = 'dashboard';
    await loadDashboard();
    
  } catch (error) {
    console.error('Error applying template:', error);
    alert('Error applying template: ' + error.message);
  }
}

async function saveCurrentRoutineAsTemplate() {
  try {
    // Get current blocks
    const { data: blocks } = await supabase
      .from('routine_blocks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('order');
    
    if (!blocks || blocks.length === 0) return;
    
    // Get current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('arrival_time')
      .eq('user_id', currentUser.id)
      .single();
    
    // Check if this exact routine already exists as a template
    const blocksData = blocks.map(b => ({
      name: b.name,
      type: b.type,
      duration_min: b.duration_min,
      sets: b.sets,
      reps: b.reps,
      reps_per_set: b.reps_per_set
    }));
    
    // Create template with timestamp
    const templateName = `Routine ${new Date().toLocaleDateString()}`;
    
    await supabase
      .from('routine_templates')
      .insert([{
        user_id: currentUser.id,
        name: templateName,
        arrival_time: profile.arrival_time,
        blocks: blocksData
      }]);
    
  } catch (error) {
    console.error('Error saving current routine:', error);
  }
}

function openDeleteTemplateModal(templateId, templateName) {
  const modal = document.getElementById('modal-delete-template');
  const nameEl = document.getElementById('delete-template-name');
  const confirmBtn = document.getElementById('btn-confirm-delete-template');
  
  nameEl.textContent = templateName;
  modal?.classList.remove('hidden');
  
  // Replace event listener
  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
  newBtn.addEventListener('click', () => deleteTemplate(templateId));
}

function closeDeleteTemplateModal() {
  const modal = document.getElementById('modal-delete-template');
  modal?.classList.add('hidden');
}

async function deleteTemplate(templateId) {
  try {
    const { error } = await supabase
      .from('routine_templates')
      .delete()
      .eq('id', templateId);
    
    if (error) throw error;
    
    closeDeleteTemplateModal();
    await loadTemplates();
    
  } catch (error) {
    console.error('Error deleting template:', error);
    alert('Error deleting template');
  }
}

async function autoSaveFirstTemplate() {
  try {
    // Check if user already has templates
    const { data: existing } = await supabase
      .from('routine_templates')
      .select('id')
      .eq('user_id', currentUser.id)
      .limit(1);
    
    if (existing && existing.length > 0) return; // Already has templates
    
    // Get blocks from onboarding
    const blocksData = onboardBlocks.map(b => ({
      name: b.name,
      type: b.type,
      duration_min: b.duration_min,
      sets: b.sets,
      reps: b.reps,
      reps_per_set: b.reps_per_set
    }));
    
    // Save as "My First Routine"
    await supabase
      .from('routine_templates')
      .insert([{
        user_id: currentUser.id,
        name: 'My First Routine',
        arrival_time: arrivalTime,
        blocks: blocksData
      }]);
    
  } catch (error) {
    console.error('Error auto-saving first template:', error);
  }
}

// ─────────────────────────────────────────────
// 28. HISTORY PAGE
// ─────────────────────────────────────────────
async function loadHistoryPage() {
  if (!currentUser) return;
  
  await loadLifetimeStats();
  await loadCycles();
}

async function loadLifetimeStats() {
  try {
    // Get all cycles
    const { data: cycles } = await supabase
      .from('challenge_cycles')
      .select('*')
      .eq('user_id', currentUser.id);
    
    if (!cycles || cycles.length === 0) {
      // Show zeros
      document.getElementById('lifetime-total-cycles').textContent = '0';
      document.getElementById('lifetime-completed-cycles').textContent = '0';
      document.getElementById('lifetime-success-rate').textContent = '0%';
      document.getElementById('lifetime-longest-streak').textContent = '0';
      document.getElementById('lifetime-total-days').textContent = '0';
      document.getElementById('lifetime-total-resets').textContent = '0';
      return;
    }
    
    // Calculate stats
    const totalCycles = cycles.length;
    const completedCycles = cycles.filter(c => c.status === 'completed').length;
    const successRate = totalCycles > 0 ? Math.round((completedCycles / totalCycles) * 100) : 0;
    const totalResets = cycles.reduce((sum, c) => sum + (c.total_resets || 0), 0);
    
    // Calculate total days completed across all cycles
    let totalDays = 0;
    for (const cycle of cycles) {
      const { data: summaries } = await supabase
        .from('daily_summary')
        .select('is_complete')
        .eq('user_id', currentUser.id)
        .gte('date', cycle.start_date)
        .eq('is_complete', true);
      
      totalDays += (summaries || []).length;
    }
    
    // Calculate longest streak across all cycles
    const longestStreak = await calculateLongestStreakAllTime();
    
    // Update UI
    document.getElementById('lifetime-total-cycles').textContent = totalCycles;
    document.getElementById('lifetime-completed-cycles').textContent = completedCycles;
    document.getElementById('lifetime-success-rate').textContent = `${successRate}%`;
    document.getElementById('lifetime-longest-streak').textContent = longestStreak;
    document.getElementById('lifetime-total-days').textContent = totalDays;
    document.getElementById('lifetime-total-resets').textContent = totalResets;
    
  } catch (error) {
    console.error('Error loading lifetime stats:', error);
  }
}

async function calculateLongestStreakAllTime() {
  try {
    const { data: summaries } = await supabase
      .from('daily_summary')
      .select('date, is_complete')
      .eq('user_id', currentUser.id)
      .order('date', { ascending: true });
    
    if (!summaries || summaries.length === 0) return 0;
    
    let longestStreak = 0;
    let currentStreak = 0;
    
    for (let i = 0; i < summaries.length; i++) {
      if (summaries[i].is_complete) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    return longestStreak;
  } catch (error) {
    console.error('Error calculating longest streak:', error);
    return 0;
  }
}

async function loadCycles() {
  try {
    const { data: cycles, error } = await supabase
      .from('challenge_cycles')
      .select(`
        *,
        routine_templates (name),
        breathwork_playlists (name)
      `)
      .eq('user_id', currentUser.id)
      .order('start_date', { ascending: false });
    
    if (error) throw error;
    
    renderCycles(cycles || []);
  } catch (error) {
    console.error('Error loading cycles:', error);
  }
}

async function renderCycles(cycles) {
  const container = document.getElementById('history-cycles-container');
  const emptyState = document.getElementById('history-cycles-empty');
  
  if (!container) return;
  
  // Remove existing cycle cards
  container.querySelectorAll('.cycle-card').forEach(card => card.remove());
  
  if (cycles.length === 0) {
    emptyState?.classList.remove('hidden');
    return;
  }
  
  emptyState?.classList.add('hidden');
  
  // Enrich cycles with completion data
  for (const cycle of cycles) {
    await enrichCycleData(cycle);
  }
  
  // Render cycle cards
  cycles.forEach(cycle => {
    const card = createCycleCard(cycle);
    container.insertBefore(card, emptyState);
  });
}

async function enrichCycleData(cycle) {
  try {
    // Calculate days completed
    const endDate = cycle.end_date || dateKey();
    const { data: summaries } = await supabase
      .from('daily_summary')
      .select('is_complete')
      .eq('user_id', currentUser.id)
      .gte('date', cycle.start_date)
      .lte('date', endDate);
    
    const completedDays = (summaries || []).filter(s => s.is_complete).length;
    cycle.days_completed = completedDays;
    
    // Calculate streak for this cycle
    const { data: allSummaries } = await supabase
      .from('daily_summary')
      .select('date, is_complete')
      .eq('user_id', currentUser.id)
      .gte('date', cycle.start_date)
      .lte('date', endDate)
      .order('date', { ascending: true });
    
    let longestStreak = 0;
    let currentStreak = 0;
    
    for (const summary of (allSummaries || [])) {
      if (summary.is_complete) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    cycle.longest_streak = longestStreak;
    
  } catch (error) {
    console.error('Error enriching cycle data:', error);
    cycle.days_completed = 0;
    cycle.longest_streak = 0;
  }
}

function createCycleCard(cycle) {
  const card = document.createElement('div');
  card.className = 'cycle-card';
  
  const startDate = new Date(cycle.start_date);
  const endDate = cycle.end_date ? new Date(cycle.end_date) : new Date();
  
  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endStr = cycle.status === 'completed' || cycle.end_date
    ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Present';
  
  const statusClass = cycle.status || 'active';
  const statusText = statusClass === 'active' ? 'In Progress' : 
                     statusClass === 'completed' ? 'Completed' : 'Abandoned';
  
  const routineName = cycle.routine_templates?.name || 'Custom Routine';
  const playlistName = cycle.breathwork_playlists?.name || 'Custom Playlist';
  
  const completionPct = Math.round((cycle.days_completed / 30) * 100);
  
  card.innerHTML = `
    <div class="cycle-header">
      <div class="cycle-dates">${startStr} — ${endStr}</div>
      <span class="cycle-status-badge ${statusClass}">${statusText}</span>
    </div>
    
    <div class="cycle-meta">
      <div class="cycle-meta-item">
        <span class="cycle-meta-label">Progress</span>
        <span class="cycle-meta-value">${cycle.days_completed}/30 days (${completionPct}%)</span>
      </div>
      <div class="cycle-meta-item">
        <span class="cycle-meta-label">Best Streak</span>
        <span class="cycle-meta-value">🔥 ${cycle.longest_streak} days</span>
      </div>
      <div class="cycle-meta-item">
        <span class="cycle-meta-label">Resets</span>
        <span class="cycle-meta-value">↺ ${cycle.total_resets || 0}</span>
      </div>
      <div class="cycle-meta-item">
        <span class="cycle-meta-label">Duration</span>
        <span class="cycle-meta-value">${calculateCycleDuration(cycle)} days</span>
      </div>
    </div>
    
    <div class="cycle-resources">
      <span>📦 ${routineName}</span>
      <span>🎥 ${playlistName}</span>
    </div>
  `;
  
  card.addEventListener('click', () => {
    openCycleDetailModal(cycle);
  });
  
  return card;
}

function calculateCycleDuration(cycle) {
  const start = new Date(cycle.start_date);
  const end = cycle.end_date ? new Date(cycle.end_date) : new Date();
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Include start day
}

async function openCycleDetailModal(cycle) {
  const modal = document.getElementById('modal-cycle-detail');
  const titleEl = document.getElementById('cycle-detail-title');
  const badgeEl = document.getElementById('cycle-detail-badge');
  const metaEl = document.getElementById('cycle-detail-meta');
  const calendarEl = document.getElementById('cycle-detail-calendar');
  
  const startDate = new Date(cycle.start_date);
  const endDate = cycle.end_date ? new Date(cycle.end_date) : new Date();
  
  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endStr = cycle.status === 'completed' || cycle.end_date
    ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Present';
  
  titleEl.textContent = `${startStr} — ${endStr}`;
  
  const statusClass = cycle.status || 'active';
  const statusText = statusClass === 'active' ? 'In Progress' : 
                     statusClass === 'completed' ? 'Completed' : 'Abandoned';
  badgeEl.textContent = statusText;
  badgeEl.className = `cycle-status-badge ${statusClass}`;
  
  const completionPct = Math.round((cycle.days_completed / 30) * 100);
  const duration = calculateCycleDuration(cycle);
  
  metaEl.innerHTML = `
    <div class="cycle-detail-stat">
      <span class="cycle-detail-stat-label">Days Completed</span>
      <span class="cycle-detail-stat-value">${cycle.days_completed}/30</span>
    </div>
    <div class="cycle-detail-stat">
      <span class="cycle-detail-stat-label">Completion</span>
      <span class="cycle-detail-stat-value">${completionPct}%</span>
    </div>
    <div class="cycle-detail-stat">
      <span class="cycle-detail-stat-label">Best Streak</span>
      <span class="cycle-detail-stat-value">🔥 ${cycle.longest_streak}</span>
    </div>
    <div class="cycle-detail-stat">
      <span class="cycle-detail-stat-label">Resets</span>
      <span class="cycle-detail-stat-value">↺ ${cycle.total_resets || 0}</span>
    </div>
    <div class="cycle-detail-stat">
      <span class="cycle-detail-stat-label">Duration</span>
      <span class="cycle-detail-stat-value">${duration} days</span>
    </div>
    <div class="cycle-detail-stat">
      <span class="cycle-detail-stat-label">Routine</span>
      <span class="cycle-detail-stat-value" style="font-size: 0.9rem;">${cycle.routine_templates?.name || 'Custom'}</span>
    </div>
  `;
  
  // Render calendar for this cycle
  await renderCycleCalendar(cycle, calendarEl);
  
  modal?.classList.remove('hidden');
}

function closeCycleDetailModal() {
  const modal = document.getElementById('modal-cycle-detail');
  modal?.classList.add('hidden');
}

async function renderCycleCalendar(cycle, container) {
  if (!container) return;
  
  container.innerHTML = '';
  
  // Get daily completions for this cycle
  const endDate = cycle.end_date || dateKey();
  const { data: summaries } = await supabase
    .from('daily_summary')
    .select('date, is_complete, was_missed')
    .eq('user_id', currentUser.id)
    .gte('date', cycle.start_date)
    .lte('date', endDate)
    .order('date', { ascending: true });
  
  const summaryMap = {};
  (summaries || []).forEach(s => {
    summaryMap[s.date] = s;
  });
  
  // Render 30 days
  for (let day = 1; day <= 30; day++) {
    const dayDate = addDays(new Date(cycle.start_date), day - 1);
    const dayKey = dayDate.toISOString().split('T')[0];
    const summary = summaryMap[dayKey];
    
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;
    dayEl.role = 'gridcell';
    dayEl.setAttribute('aria-label', `Day ${day}`);
    
    // Determine state
    const today = new Date(dateKey());
    const isToday = dayKey === dateKey();
    const isPast = dayDate < today;
    const isFuture = dayDate > today;
    
    if (summary) {
      if (summary.is_complete) {
        dayEl.classList.add('completed');
      } else if (summary.was_missed) {
        // Check if they restarted or continued
        const nextDay = addDays(dayDate, 1);
        const nextDayKey = nextDay.toISOString().split('T')[0];
        const nextSummary = summaryMap[nextDayKey];
        
        if (nextSummary && day < 30) {
          // They continued
          dayEl.classList.add('missed-continue');
        } else {
          // They restarted or it's the last day
          dayEl.classList.add('missed-restart');
        }
      } else {
        dayEl.classList.add('future');
      }
    } else if (isPast) {
      // Past day with no data = not reached
      dayEl.classList.add('future');
    } else {
      dayEl.classList.add('future');
    }
    
    if (isToday && cycle.status === 'active') {
      dayEl.classList.add('current');
    }
    
    // Click to show day details
    if (summary) {
      dayEl.style.cursor = 'pointer';
      dayEl.addEventListener('click', (e) => {
        e.stopPropagation();
        showHistoricalDayDetails(dayKey, day);
      });
    }
    
    container.appendChild(dayEl);
  }
}

async function showHistoricalDayDetails(dayKey, dayNumber) {
  try {
    // Get daily completions for this day
    const { data: completions } = await supabase
      .from('daily_completions')
      .select(`
        *,
        routine_blocks (name, type)
      `)
      .eq('user_id', currentUser.id)
      .eq('date', dayKey);
    
    // Get all blocks for that day
    const { data: allBlocks } = await supabase
      .from('routine_blocks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('order');
    
    const completedBlockIds = new Set((completions || []).map(c => c.block_id));
    
    // Show in day details modal
    const modal = document.getElementById('modal-day-details');
    const titleEl = document.getElementById('modal-day-title');
    const dateEl = document.getElementById('modal-day-date');
    const statusEl = document.getElementById('modal-day-status');
    const blocksEl = document.getElementById('modal-day-blocks');
    const iconEl = document.getElementById('modal-day-icon');
    
    titleEl.textContent = `DAY ${dayNumber}`;
    dateEl.textContent = new Date(dayKey).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const completedCount = completedBlockIds.size;
    const totalCount = (allBlocks || []).length;
    const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    if (completedCount === totalCount) {
      statusEl.innerHTML = `<strong style="color: var(--c-success);">✅ Completed (${completionPct}%)</strong>`;
      iconEl.textContent = '✅';
    } else if (completedCount > 0) {
      statusEl.innerHTML = `<strong style="color: var(--c-warning);">⚠️ Partially Complete (${completionPct}%)</strong>`;
      iconEl.textContent = '⚠️';
    } else {
      statusEl.innerHTML = `<strong style="color: var(--c-danger);">❌ Missed (0%)</strong>`;
      iconEl.textContent = '❌';
    }
    
    // Render blocks
    blocksEl.innerHTML = (allBlocks || []).map(block => {
      const isCompleted = completedBlockIds.has(block.id);
      const emoji = blockEmoji(block);
      const checkmark = isCompleted ? '✓' : '○';
      const checkClass = isCompleted ? 'completed' : 'incomplete';
      
      return `
        <div class="modal-day-block ${checkClass}">
          <span class="modal-day-block-check">${checkmark}</span>
          <span class="modal-day-block-emoji">${emoji}</span>
          <span class="modal-day-block-name">${block.name}</span>
        </div>
      `;
    }).join('');
    
    modal?.classList.remove('hidden');
    
  } catch (error) {
    console.error('Error showing historical day details:', error);
  }
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ─────────────────────────────────────────────
// 29. PARTNER/ACCOUNTABILITY SYSTEM
// ─────────────────────────────────────────────
async function loadPartnersPage() {
  if (!currentUser) return;
  
  await loadPartner();
  await loadPendingInvites();
  await loadNotifications();
}

async function loadPartner() {
  try {
    const { data: pair, error } = await supabase
      .from('accountability_pairs')
      .select(`
        *,
        partner:partner_id(id, email),
        requester:user_id(id, email)
      `)
      .or(`user_id.eq.${currentUser.id},partner_id.eq.${currentUser.id}`)
      .eq('status', 'accepted')
      .maybeSingle();
    
    if (error) throw error;
    
    if (pair) {
      // Determine who the partner is
      const isRequester = pair.user_id === currentUser.id;
      const partnerId = isRequester ? pair.partner_id : pair.user_id;
      const partnerEmail = isRequester ? pair.partner.email : pair.requester.email;
      
      // Show partner card
      document.getElementById('partner-empty-state').classList.add('hidden');
      document.getElementById('partner-card').classList.remove('hidden');
      
      document.getElementById('partner-email').textContent = partnerEmail;
      document.getElementById('partner-since').textContent = `Partners since ${new Date(pair.created_at).toLocaleDateString()}`;
      
      // Load partner's current stats
      await loadPartnerStats(partnerId);
      
      // Update settings
      document.getElementById('settings-partner-email').textContent = partnerEmail;
      
    } else {
      // No partner
      document.getElementById('partner-empty-state').classList.remove('hidden');
      document.getElementById('partner-card').classList.add('hidden');
      document.getElementById('settings-partner-email').textContent = 'No partner';
    }
    
  } catch (error) {
    console.error('Error loading partner:', error);
  }
}

async function loadPartnerStats(partnerId) {
  try {
    // Get partner's current cycle
    const { data: cycle } = await supabase
      .from('challenge_cycles')
      .select('*')
      .eq('user_id', partnerId)
      .eq('status', 'active')
      .maybeSingle();
    
    if (!cycle) {
      document.getElementById('partner-day').textContent = '—';
      document.getElementById('partner-streak').textContent = '—';
      document.getElementById('partner-progress').textContent = '—';
      return;
    }
    
    // Calculate current day
    const start = new Date(cycle.start_date + 'T00:00:00');
    const today = new Date(dateKey() + 'T00:00:00');
    const diffMs = today - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const cycleDay = Math.min(Math.max(diffDays + 1, 1), 30);
    
    // Get today's completion
    const { data: summary } = await supabase
      .from('daily_summary')
      .select('*')
      .eq('user_id', partnerId)
      .eq('date', dateKey())
      .maybeSingle();
    
    const todayComplete = summary?.is_complete || false;
    const todayPct = summary?.completion_pct || 0;
    
    // Calculate current streak
    const { data: summaries } = await supabase
      .from('daily_summary')
      .select('date, is_complete')
      .eq('user_id', partnerId)
      .gte('date', cycle.start_date)
      .order('date', { ascending: false });
    
    let streak = 0;
    for (const s of (summaries || [])) {
      if (s.is_complete) streak++;
      else break;
    }
    
    // Update UI
    document.getElementById('partner-day').textContent = `${cycleDay}/30`;
    document.getElementById('partner-streak').textContent = `🔥 ${streak}`;
    document.getElementById('partner-progress').textContent = `${Math.round(todayPct)}%`;
    
    // Update status
    const statusEl = document.getElementById('partner-status');
    if (todayComplete) {
      statusEl.className = 'partner-status completed';
      statusEl.innerHTML = `
        <span class="partner-status-icon">✅</span>
        <span class="partner-status-text">Completed today's routine!</span>
      `;
    } else {
      statusEl.className = 'partner-status';
      statusEl.innerHTML = `
        <span class="partner-status-icon">⏳</span>
        <span class="partner-status-text">Waiting for today's update...</span>
      `;
    }
    
  } catch (error) {
    console.error('Error loading partner stats:', error);
  }
}

async function loadPendingInvites() {
  try {
    const { data: invites } = await supabase
      .from('accountability_pairs')
      .select(`
        *,
        requester:user_id(email)
      `)
      .eq('partner_id', currentUser.id)
      .eq('status', 'pending');
    
    const container = document.getElementById('partner-invites-container');
    const section = document.getElementById('partner-invites-section');
    
    if (!invites || invites.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    container.innerHTML = '';
    
    invites.forEach(invite => {
      const card = document.createElement('div');
      card.className = 'partner-invite-card';
      card.innerHTML = `
        <div class="partner-invite-header">
          <div>
            <div class="partner-invite-email">${invite.requester.email}</div>
            <div class="partner-invite-date">Sent ${new Date(invite.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--c-text-dim); margin-bottom: var(--sp-sm);">
          ${invite.requester.email} wants to be your accountability partner
        </p>
        <div class="partner-invite-actions">
          <button class="btn btn-ghost" data-action="decline" data-id="${invite.id}">Decline</button>
          <button class="btn btn-primary" data-action="accept" data-id="${invite.id}">Accept</button>
        </div>
      `;
      
      card.querySelector('[data-action="accept"]').addEventListener('click', () => {
        acceptInvite(invite.id);
      });
      
      card.querySelector('[data-action="decline"]').addEventListener('click', () => {
        declineInvite(invite.id);
      });
      
      container.appendChild(card);
    });
    
  } catch (error) {
    console.error('Error loading pending invites:', error);
  }
}

async function loadNotifications() {
  try {
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    const container = document.getElementById('partner-notifications-container');
    const emptyState = document.getElementById('notifications-empty');
    
    if (!notifications || notifications.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    
    // Remove existing notifications
    container.querySelectorAll('.notification-item').forEach(n => n.remove());
    
    notifications.forEach(notif => {
      const item = document.createElement('div');
      item.className = `notification-item ${notif.is_read ? '' : 'unread'}`;
      
      let icon = '📢';
      if (notif.type === 'partner_completed') icon = '✅';
      else if (notif.type === 'partner_missed') icon = '😴';
      else if (notif.type === 'partner_streak') icon = '🔥';
      
      const timeAgo = formatTimeAgo(new Date(notif.created_at));
      
      item.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
          <div class="notification-text">${notif.message}</div>
          <div class="notification-time">${timeAgo}</div>
        </div>
        ${!notif.is_read ? `
          <div class="notification-actions">
            <button class="btn btn-ghost" data-action="mark-read" data-id="${notif.id}">Mark Read</button>
          </div>
        ` : ''}
      `;
      
      const markReadBtn = item.querySelector('[data-action="mark-read"]');
      if (markReadBtn) {
        markReadBtn.addEventListener('click', () => {
          markNotificationRead(notif.id);
        });
      }
      
      container.insertBefore(item, emptyState);
    });
    
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }
  
  return 'Just now';
}

function openInvitePartnerModal() {
  const modal = document.getElementById('modal-invite-partner');
  document.getElementById('partner-email-input').value = '';
  hideError('invite-partner-error');
  document.getElementById('invite-partner-success')?.classList.add('hidden');
  modal?.classList.remove('hidden');
}

function closeInvitePartnerModal() {
  const modal = document.getElementById('modal-invite-partner');
  modal?.classList.add('hidden');
}

async function sendPartnerInvite() {
  const email = document.getElementById('partner-email-input').value.trim();
  
  hideError('invite-partner-error');
  document.getElementById('invite-partner-success')?.classList.add('hidden');
  
  if (!email) {
    showError('invite-partner-error', 'Please enter an email address');
    return;
  }
  
  if (email === currentUser.email) {
    showError('invite-partner-error', 'You cannot invite yourself');
    return;
  }
  
  try {
    // Find user by email
    const { data: { users }, error: searchError } = await supabaseClient.auth.admin.listUsers();
    
    if (searchError) {
      // Fallback: try to create invite without verification
      // In production, you'd want proper user lookup
      showError('invite-partner-error', 'Could not verify user. They must have an account first.');
      return;
    }
    
    const partnerUser = users?.find(u => u.email === email);
    
    if (!partnerUser) {
      showError('invite-partner-error', 'No user found with that email. They must create an account first.');
      return;
    }
    
    // Check if already partners or pending
    const { data: existing } = await supabase
      .from('accountability_pairs')
      .select('*')
      .or(`and(user_id.eq.${currentUser.id},partner_id.eq.${partnerUser.id}),and(user_id.eq.${partnerUser.id},partner_id.eq.${currentUser.id})`);
    
    if (existing && existing.length > 0) {
      showError('invite-partner-error', 'You already have a pending or active partnership with this user');
      return;
    }
    
    // Create invite
    const { error: insertError } = await supabase
      .from('accountability_pairs')
      .insert([{
        user_id: currentUser.id,
        partner_id: partnerUser.id,
        status: 'pending'
      }]);
    
    if (insertError) throw insertError;
    
    // Success
    showSuccess('invite-partner-success', 'Invite sent successfully!');
    document.getElementById('partner-email-input').value = '';
    
    setTimeout(() => {
      closeInvitePartnerModal();
      loadPartnersPage();
    }, 1500);
    
  } catch (error) {
    console.error('Error sending invite:', error);
    showError('invite-partner-error', error.message);
  }
}

async function acceptInvite(inviteId) {
  try {
    const { error } = await supabase
      .from('accountability_pairs')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', inviteId);
    
    if (error) throw error;
    
    await loadPartnersPage();
    
  } catch (error) {
    console.error('Error accepting invite:', error);
    alert('Error accepting invite');
  }
}

async function declineInvite(inviteId) {
  try {
    const { error } = await supabase
      .from('accountability_pairs')
      .delete()
      .eq('id', inviteId);
    
    if (error) throw error;
    
    await loadPendingInvites();
    
  } catch (error) {
    console.error('Error declining invite:', error);
    alert('Error declining invite');
  }
}

function openRemovePartnerModal() {
  // Get partner email from UI
  const partnerEmail = document.getElementById('partner-email').textContent;
  document.getElementById('remove-partner-email').textContent = partnerEmail;
  
  const modal = document.getElementById('modal-remove-partner');
  modal?.classList.remove('hidden');
}

function closeRemovePartnerModal() {
  const modal = document.getElementById('modal-remove-partner');
  modal?.classList.add('hidden');
}

async function removePartner() {
  try {
    const { error } = await supabase
      .from('accountability_pairs')
      .delete()
      .or(`user_id.eq.${currentUser.id},partner_id.eq.${currentUser.id}`)
      .eq('status', 'accepted');
    
    if (error) throw error;
    
    closeRemovePartnerModal();
    await loadPartnersPage();
    
  } catch (error) {
    console.error('Error removing partner:', error);
    alert('Error removing partner');
  }
}

async function markNotificationRead(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    if (error) throw error;
    
    await loadNotifications();
    
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

// ─────────────────────────────────────────────
// 30. BREATHWORK PLAYLISTS
// ─────────────────────────────────────────────
let playlistEditorState = {
  isEditing: false,
  editingId: null
};

async function loadPlaylists() {
  await loadPersonalPlaylists();
  await loadCommunityPlaylists();
}

async function loadPersonalPlaylists() {
  try {
    const { data, error } = await supabase
      .from('breathwork_playlists')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    renderPersonalPlaylists(data || []);
  } catch (error) {
    console.error('Error loading personal playlists:', error);
  }
}

async function loadCommunityPlaylists(searchTerm = '') {
  try {
    let query = supabase
      .from('breathwork_playlists')
      .select(`
        *,
        profiles!breathwork_playlists_user_id_fkey (
          user_id
        )
      `)
      .eq('is_public', true)
      .neq('user_id', currentUser.id)
      .order('times_used', { ascending: false });
    
    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }
    
    const { data, error } = await query.limit(20);
    
    if (error) throw error;
    
    renderCommunityPlaylists(data || []);
  } catch (error) {
    console.error('Error loading community playlists:', error);
  }
}

function renderPersonalPlaylists(playlists) {
  const container = document.getElementById('personal-playlists-container');
  const emptyState = document.getElementById('personal-playlists-empty');
  
  if (!container) return;
  
  // Remove existing playlist cards
  container.querySelectorAll('.playlist-card').forEach(card => card.remove());
  
  if (playlists.length === 0) {
    emptyState?.classList.remove('hidden');
    return;
  }
  
  emptyState?.classList.add('hidden');
  
  playlists.forEach(playlist => {
    const card = createPlaylistCard(playlist, false);
    container.insertBefore(card, emptyState);
  });
}

function renderCommunityPlaylists(playlists) {
  const container = document.getElementById('community-playlists-container');
  const emptyState = document.getElementById('community-playlists-empty');
  
  if (!container) return;
  
  // Remove existing cards
  container.querySelectorAll('.playlist-card').forEach(card => card.remove());
  
  if (playlists.length === 0) {
    emptyState.innerHTML = '<p style="color: var(--c-text-muted); text-align: center; padding: 2rem 0;">No community playlists found</p>';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  playlists.forEach(playlist => {
    const card = createPlaylistCard(playlist, true);
    container.appendChild(card);
  });
}

function createPlaylistCard(playlist, isCommunity = false) {
  const card = document.createElement('div');
  card.className = 'playlist-card';
  
  const videos = Array.isArray(playlist.videos) ? playlist.videos : [];
  const videoCount = videos.length;
  const createdDate = new Date(playlist.created_at).toLocaleDateString();
  
  // Get first 3 video thumbnails
  const thumbnailsHTML = videos.slice(0, 3).map(video => {
    const videoId = video.video_id || video.videoId;
    return `
      <div class="playlist-thumbnail">
        <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" 
             alt="Video thumbnail"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <div class="playlist-thumbnail-loading" style="display:none;">📹</div>
      </div>
    `;
  }).join('');
  
  const visibilityBadge = playlist.is_public ? '<span class="playlist-visibility">Public</span>' : '';
  const creatorInfo = isCommunity ? `<div class="playlist-creator">by ${maskEmail(playlist.user_id)}</div>` : '';
  const timesUsed = playlist.times_used > 0 ? `<span>🔥 ${playlist.times_used} uses</span>` : '';
  
  card.innerHTML = `
    <div class="playlist-header">
      <div class="playlist-name">${playlist.name}</div>
      ${visibilityBadge}
    </div>
    ${creatorInfo}
    <div class="playlist-meta">
      <span>🎥 ${videoCount}/30 videos</span>
      <span>📅 ${createdDate}</span>
      ${timesUsed}
    </div>
    <div class="playlist-thumbnails">
      ${thumbnailsHTML}
    </div>
    <div class="playlist-actions">
      ${createPlaylistActionButtons(playlist, isCommunity)}
    </div>
  `;
  
  // Add event listeners
  attachPlaylistCardEvents(card, playlist, isCommunity);
  
  return card;
}

function createPlaylistActionButtons(playlist, isCommunity) {
  if (isCommunity) {
    return `
      <button class="btn btn-ghost" data-action="preview" data-id="${playlist.id}">Preview</button>
      <button class="btn btn-primary" data-action="copy" data-id="${playlist.id}" data-name="${playlist.name}">Copy to My Playlists</button>
    `;
  } else {
    return `
      <button class="btn btn-primary" data-action="preview" data-id="${playlist.id}">Preview</button>
      <button class="btn btn-ghost" data-action="edit" data-id="${playlist.id}">Edit</button>
      <button class="btn btn-danger" data-action="delete" data-id="${playlist.id}" data-name="${playlist.name}">Delete</button>
    `;
  }
}

function attachPlaylistCardEvents(card, playlist, isCommunity) {
  card.querySelector('[data-action="preview"]')?.addEventListener('click', () => {
    openPlaylistPreview(playlist, isCommunity);
  });
  
  if (isCommunity) {
    card.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
      await copyPlaylistToPersonal(playlist);
    });
  } else {
    card.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      editPlaylist(playlist.id);
    });
    
    card.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      openDeletePlaylistModal(playlist.id, playlist.name);
    });
  }
}

function maskEmail(userId) {
  // In production, you'd fetch the email and mask it
  // For now, just show a generic masked format
  return 'user***@***.com';
}

function openPlaylistModal(playlist = null) {
  const modal = document.getElementById('modal-playlist');
  const title = document.getElementById('modal-playlist-title');
  const nameInput = document.getElementById('playlist-name');
  const publicCheckbox = document.getElementById('playlist-public');
  const urlsTextarea = document.getElementById('playlist-urls');
  
  playlistEditorState = {
    isEditing: !!playlist,
    editingId: playlist?.id || null
  };
  
  title.textContent = playlist ? 'Edit Playlist' : 'Create Playlist';
  nameInput.value = playlist?.name || '';
  publicCheckbox.checked = playlist?.is_public || false;
  
  if (playlist && playlist.videos) {
    const urls = playlist.videos.map(v => v.url).join('\n');
    urlsTextarea.value = urls;
    updatePlaylistUrlCount();
    parsePlaylistUrls();
  } else {
    urlsTextarea.value = '';
    updatePlaylistUrlCount();
  }
  
  modal?.classList.remove('hidden');
  hideError('playlist-error');
}

function closePlaylistModal() {
  const modal = document.getElementById('modal-playlist');
  modal?.classList.add('hidden');
  playlistEditorState = { isEditing: false, editingId: null };
}

function updatePlaylistUrlCount() {
  const textarea = document.getElementById('playlist-urls');
  const countEl = document.getElementById('playlist-url-count');
  const parsedURLs = parseYouTubeURLs(textarea.value);
  const validCount = parsedURLs.filter(p => p.valid).length;
  
  if (countEl) {
    countEl.textContent = `${validCount} / 30`;
    countEl.style.color = validCount === 30 ? 'var(--c-success)' : 'var(--c-text-dim)';
  }
}

function parsePlaylistUrls() {
  const textarea = document.getElementById('playlist-urls');
  const preview = document.getElementById('playlist-parse-preview');
  const parsedURLs = parseYouTubeURLs(textarea.value);
  
  if (!preview) return;
  
  if (parsedURLs.length === 0) {
    preview.classList.add('hidden');
    return;
  }
  
  const validCount = parsedURLs.filter(p => p.valid).length;
  const invalidCount = parsedURLs.filter(p => !p.valid).length;
  
  let html = '<div style="font-size: 0.85rem; padding: 0.5rem;">';
  if (validCount > 0) html += `<div style="color: var(--c-success);">✓ ${validCount} valid URLs</div>`;
  if (invalidCount > 0) html += `<div style="color: var(--c-danger);">✗ ${invalidCount} invalid URLs</div>`;
  html += '</div>';
  
  preview.innerHTML = html;
  preview.classList.remove('hidden');
}

async function savePlaylist() {
  const name = document.getElementById('playlist-name').value.trim();
  const isPublic = document.getElementById('playlist-public').checked;
  const urlsText = document.getElementById('playlist-urls').value;
  
  if (!name) {
    showError('playlist-error', 'Please enter a playlist name');
    return;
  }
  
  const parsedURLs = parseYouTubeURLs(urlsText).filter(p => p.valid);
  
  if (parsedURLs.length !== 30) {
    showError('playlist-error', `Please provide exactly 30 valid YouTube URLs (you have ${parsedURLs.length})`);
    return;
  }
  
  try {
    const videos = parsedURLs.map((p, index) => ({
      url: p.rawUrl,
      video_id: p.videoId,
      day_number: index + 1
    }));
    
    const playlistData = {
      user_id: currentUser.id,
      name,
      is_public: isPublic,
      videos
    };
    
    if (playlistEditorState.isEditing) {
      const { error } = await supabase
        .from('breathwork_playlists')
        .update(playlistData)
        .eq('id', playlistEditorState.editingId);
      
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('breathwork_playlists')
        .insert([playlistData]);
      
      if (error) throw error;
    }
    
    closePlaylistModal();
    await loadPlaylists();
    
  } catch (error) {
    console.error('Error saving playlist:', error);
    showError('playlist-error', error.message);
  }
}

async function editPlaylist(playlistId) {
  try {
    const { data, error } = await supabase
      .from('breathwork_playlists')
      .select('*')
      .eq('id', playlistId)
      .single();
    
    if (error) throw error;
    
    openPlaylistModal(data);
  } catch (error) {
    console.error('Error loading playlist:', error);
    alert('Error loading playlist');
  }
}

function openPlaylistPreview(playlist, isCommunity) {
  const modal = document.getElementById('modal-playlist-preview');
  const nameEl = document.getElementById('preview-playlist-name');
  const metaEl = document.getElementById('preview-playlist-meta');
  const gridEl = document.getElementById('preview-videos-grid');
  const actionsEl = document.getElementById('preview-actions');
  
  nameEl.textContent = playlist.name;
  metaEl.textContent = `${playlist.videos.length} videos · Created ${new Date(playlist.created_at).toLocaleDateString()}`;
  
  // Render video thumbnails
  gridEl.innerHTML = playlist.videos.map((video, index) => {
    const videoId = video.video_id || video.videoId;
    return `
      <div class="preview-video-item">
        <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="Day ${index + 1}">
        <div class="preview-video-day">Day ${index + 1}</div>
      </div>
    `;
  }).join('');
  
  // Action buttons
  if (isCommunity) {
    actionsEl.innerHTML = `
      <button class="btn btn-ghost btn-full" onclick="closePlaylistPreview()">Close</button>
      <button class="btn btn-primary btn-full" onclick="copyPlaylistToPersonal(${JSON.stringify(playlist).replace(/"/g, '&quot;')})">
        Copy to My Playlists
      </button>
    `;
  } else {
    actionsEl.innerHTML = `
      <button class="btn btn-ghost btn-full" onclick="closePlaylistPreview()">Close</button>
    `;
  }
  
  modal?.classList.remove('hidden');
}

function closePlaylistPreview() {
  const modal = document.getElementById('modal-playlist-preview');
  modal?.classList.add('hidden');
}

async function copyPlaylistToPersonal(playlist) {
  try {
    const newPlaylist = {
      user_id: currentUser.id,
      name: `${playlist.name} (copy)`,
      is_public: false,
      videos: playlist.videos
    };
    
    const { error } = await supabase
      .from('breathwork_playlists')
      .insert([newPlaylist]);
    
    if (error) throw error;
    
    // Increment times_used for the original
    await supabase
      .from('breathwork_playlists')
      .update({ times_used: (playlist.times_used || 0) + 1 })
      .eq('id', playlist.id);
    
    closePlaylistPreview();
    await loadPersonalPlaylists();
    
    // Switch to personal tab
    switchPlaylistTab('personal');
    
    alert('Playlist copied to your library!');
    
  } catch (error) {
    console.error('Error copying playlist:', error);
    alert('Error copying playlist: ' + error.message);
  }
}

function openDeletePlaylistModal(playlistId, playlistName) {
  const modal = document.getElementById('modal-delete-playlist');
  const nameEl = document.getElementById('delete-playlist-name');
  const confirmBtn = document.getElementById('btn-confirm-delete-playlist');
  
  nameEl.textContent = playlistName;
  modal?.classList.remove('hidden');
  
  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
  newBtn.addEventListener('click', () => deletePlaylist(playlistId));
}

function closeDeletePlaylistModal() {
  const modal = document.getElementById('modal-delete-playlist');
  modal?.classList.add('hidden');
}

async function deletePlaylist(playlistId) {
  try {
    const { error } = await supabase
      .from('breathwork_playlists')
      .delete()
      .eq('id', playlistId);
    
    if (error) throw error;
    
    closeDeletePlaylistModal();
    await loadPersonalPlaylists();
    
  } catch (error) {
    console.error('Error deleting playlist:', error);
    alert('Error deleting playlist');
  }
}

function switchPlaylistTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.playlist-tab').forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.playlist-tab-content').forEach(content => {
    if (content.id === `playlists-${tabName}`) {
      content.classList.remove('hidden');
      content.classList.add('active');
    } else {
      content.classList.add('hidden');
      content.classList.remove('active');
    }
  });
  
  // Load content if switching to community
  if (tabName === 'community') {
    loadCommunityPlaylists();
  }
}

async function autoSaveFirstPlaylist() {
  try {
    // Check if user already has playlists
    const { data: existing } = await supabase
      .from('breathwork_playlists')
      .select('id')
      .eq('user_id', currentUser.id)
      .limit(1);
    
    if (existing && existing.length > 0) return;
    
    // Get videos from breathwork_videos table
    const { data: videos } = await supabase
      .from('breathwork_videos')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('day_number');
    
    if (!videos || videos.length === 0) return;
    
    const videosData = videos.map(v => ({
      url: v.url,
      video_id: v.video_id,
      day_number: v.day_number
    }));
    
    await supabase
      .from('breathwork_playlists')
      .insert([{
        user_id: currentUser.id,
        name: 'My First Playlist',
        is_public: false,
        videos: videosData
      }]);
    
  } catch (error) {
    console.error('Error auto-saving first playlist:', error);
  }
}

// ─────────────────────────────────────────────
// 29. HISTORY PAGE
// ─────────────────────────────────────────────
async function loadHistoryPage() {
  if (!currentUser) return;
  
  await loadLifetimeStats();
  await loadHistoricalCycles();
}

async function loadLifetimeStats() {
  try {
    // Get all cycles
    const { data: cycles } = await supabase
      .from('challenge_cycles')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('start_date', { ascending: false });
    
    if (!cycles || cycles.length === 0) {
      // No cycles yet
      document.getElementById('lifetime-total-cycles').textContent = '0';
      document.getElementById('lifetime-completed-cycles').textContent = '0';
      document.getElementById('lifetime-success-rate').textContent = '0';
      document.getElementById('lifetime-longest-streak').textContent = '0';
      document.getElementById('lifetime-total-days').textContent = '0';
      document.getElementById('lifetime-total-resets').textContent = '0';
      return;
    }
    
    // Calculate stats
    const totalCycles = cycles.length;
    const completedCycles = cycles.filter(c => c.status === 'completed').length;
    const successRate = totalCycles > 0 ? Math.round((completedCycles / totalCycles) * 100) : 0;
    
    // Get total days completed across all cycles
    const { data: completions } = await supabase
      .from('daily_summary')
      .select('date')
      .eq('user_id', currentUser.id)
      .eq('is_complete', true);
    
    const totalDays = completions ? completions.length : 0;
    
    // Calculate longest streak ever
    const longestStreak = await calculateLongestStreakEver();
    
    // Total resets
    const totalResets = cycles.reduce((sum, c) => sum + (c.total_resets || 0), 0);
    
    // Update UI
    document.getElementById('lifetime-total-cycles').textContent = totalCycles;
    document.getElementById('lifetime-completed-cycles').textContent = completedCycles;
    document.getElementById('lifetime-success-rate').textContent = successRate;
    document.getElementById('lifetime-longest-streak').textContent = longestStreak;
    document.getElementById('lifetime-total-days').textContent = totalDays;
    document.getElementById('lifetime-total-resets').textContent = totalResets;
    
  } catch (error) {
    console.error('Error loading lifetime stats:', error);
  }
}

async function calculateLongestStreakEver() {
  try {
    const { data: summaries } = await supabase
      .from('daily_summary')
      .select('date, is_complete')
      .eq('user_id', currentUser.id)
      .eq('is_complete', true)
      .order('date', { ascending: true });
    
    if (!summaries || summaries.length === 0) return 0;
    
    let longest = 0;
    let current = 0;
    let prevDate = null;
    
    summaries.forEach(summary => {
      const currentDate = new Date(summary.date + 'T00:00:00');
      
      if (prevDate) {
        const diffMs = currentDate - prevDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        if (diffDays === 1) {
          current++;
        } else {
          longest = Math.max(longest, current);
          current = 1;
        }
      } else {
        current = 1;
      }
      
      prevDate = currentDate;
    });
    
    longest = Math.max(longest, current);
    return longest;
    
  } catch (error) {
    console.error('Error calculating longest streak:', error);
    return 0;
  }
}

async function loadHistoricalCycles() {
  try {
    // Get all cycles with related data
    const { data: cycles, error } = await supabase
      .from('challenge_cycles')
      .select(`
        *,
        routine_templates (name),
        breathwork_playlists (name)
      `)
      .eq('user_id', currentUser.id)
      .order('start_date', { ascending: false });
    
    if (error) throw error;
    
    renderHistoricalCycles(cycles || []);
    
  } catch (error) {
    console.error('Error loading historical cycles:', error);
  }
}

function renderHistoricalCycles(cycles) {
  const container = document.getElementById('history-cycles-container');
  const emptyState = document.getElementById('history-cycles-empty');
  
  if (!container) return;
  
  // Remove existing cards
  container.querySelectorAll('.cycle-card').forEach(card => card.remove());
  
  if (cycles.length === 0) {
    emptyState?.classList.remove('hidden');
    return;
  }
  
  emptyState?.classList.add('hidden');
  
  cycles.forEach(cycle => {
    const card = createCycleCard(cycle);
    container.insertBefore(card, emptyState);
  });
}

function createCycleCard(cycle) {
  const card = document.createElement('div');
  card.className = 'cycle-card';
  
  // Determine status
  let status = cycle.status || 'active';
  let statusText = status.charAt(0).toUpperCase() + status.slice(1);
  
  // Calculate days completed
  const startDate = new Date(cycle.start_date + 'T00:00:00');
  const endDate = cycle.end_date ? new Date(cycle.end_date + 'T00:00:00') : new Date();
  const today = new Date(dateKey() + 'T00:00:00');
  
  let daysCompleted = cycle.days_completed || 0;
  
  // If active cycle, calculate current day
  if (status === 'active') {
    const diffMs = today - startDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const currentDay = Math.min(Math.max(diffDays + 1, 1), 30);
    daysCompleted = currentDay - 1; // Days completed so far
  }
  
  // Format dates
  const startDateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endDateStr = cycle.end_date 
    ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Present';
  
  // Get routine and playlist names
  const routineName = cycle.routine_templates?.name || 'Custom Routine';
  const playlistName = cycle.breathwork_playlists?.name || 'Custom Playlist';
  
  // Calculate completion percentage
  const completionPct = Math.round((daysCompleted / 30) * 100);
  
  card.innerHTML = `
    <div class="cycle-card-header">
      <div class="cycle-title">Cycle ${formatDate(cycle.start_date)}</div>
      <span class="cycle-status-badge ${status}">${statusText}</span>
    </div>
    <div class="cycle-dates">${startDateStr} → ${endDateStr}</div>
    <div class="cycle-progress">
      <div class="cycle-progress-item">
        <span>📊</span>
        <span>${daysCompleted}/30 days (${completionPct}%)</span>
      </div>
      ${status === 'completed' ? '<div class="cycle-progress-item"><span>✅</span><span>Completed!</span></div>' : ''}
    </div>
    <div class="cycle-meta">
      <div class="cycle-meta-item">
        <span>📦</span>
        <span>${routineName}</span>
      </div>
      <div class="cycle-meta-item">
        <span>🎥</span>
        <span>${playlistName}</span>
      </div>
      ${cycle.total_resets > 0 ? `<div class="cycle-meta-item"><span>↺</span><span>${cycle.total_resets} resets</span></div>` : ''}
    </div>
  `;
  
  // Click to view details
  card.addEventListener('click', () => {
    openCycleDetailModal(cycle);
  });
  
  return card;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

async function openCycleDetailModal(cycle) {
  const modal = document.getElementById('modal-cycle-detail');
  const titleEl = document.getElementById('cycle-detail-title');
  const badgeEl = document.getElementById('cycle-detail-badge');
  const metaEl = document.getElementById('cycle-detail-meta');
  const calendarEl = document.getElementById('cycle-detail-calendar');
  
  // Set title and badge
  const startDate = new Date(cycle.start_date + 'T00:00:00');
  titleEl.textContent = `Cycle ${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  
  let status = cycle.status || 'active';
  let statusText = status.charAt(0).toUpperCase() + status.slice(1);
  badgeEl.textContent = statusText;
  badgeEl.className = `cycle-status-badge ${status}`;
  
  // Build meta info
  const startDateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endDateStr = cycle.end_date 
    ? new Date(cycle.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Ongoing';
  
  const routineName = cycle.routine_templates?.name || 'Custom Routine';
  const playlistName = cycle.breathwork_playlists?.name || 'Custom Playlist';
  
  metaEl.innerHTML = `
    <div class="cycle-detail-meta-row">
      <span class="cycle-detail-meta-label">Start Date:</span>
      <span class="cycle-detail-meta-value">${startDateStr}</span>
    </div>
    <div class="cycle-detail-meta-row">
      <span class="cycle-detail-meta-label">End Date:</span>
      <span class="cycle-detail-meta-value">${endDateStr}</span>
    </div>
    <div class="cycle-detail-meta-row">
      <span class="cycle-detail-meta-label">Routine:</span>
      <span class="cycle-detail-meta-value">${routineName}</span>
    </div>
    <div class="cycle-detail-meta-row">
      <span class="cycle-detail-meta-label">Playlist:</span>
      <span class="cycle-detail-meta-value">${playlistName}</span>
    </div>
    ${cycle.total_resets > 0 ? `
      <div class="cycle-detail-meta-row">
        <span class="cycle-detail-meta-label">Total Resets:</span>
        <span class="cycle-detail-meta-value">${cycle.total_resets}</span>
      </div>
    ` : ''}
  `;
  
  // Render calendar for this cycle
  await renderCycleCalendar(cycle, calendarEl);
  
  modal?.classList.remove('hidden');
}

function closeCycleDetailModal() {
  const modal = document.getElementById('modal-cycle-detail');
  modal?.classList.add('hidden');
}

async function renderCycleCalendar(cycle, container) {
  if (!container) return;
  
  // Get daily summaries for this cycle
  const startDate = new Date(cycle.start_date + 'T00:00:00');
  const endDate = cycle.end_date ? new Date(cycle.end_date + 'T00:00:00') : new Date();
  
  // Calculate how many days to show (max 30)
  const diffMs = endDate - startDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const totalDays = Math.min(diffDays + 1, 30);
  
  // Get completion data for this date range
  const { data: summaries } = await supabase
    .from('daily_summary')
    .select('date, is_complete, was_missed')
    .eq('user_id', currentUser.id)
    .gte('date', cycle.start_date)
    .order('date', { ascending: true });
  
  const summaryMap = {};
  if (summaries) {
    summaries.forEach(s => {
      summaryMap[s.date] = s;
    });
  }
  
  // Build calendar
  container.innerHTML = '';
  
  for (let dayNum = 1; dayNum <= 30; dayNum++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + (dayNum - 1));
    const dayKey = dayDate.toISOString().split('T')[0];
    
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.setAttribute('role', 'gridcell');
    dayEl.setAttribute('aria-label', `Day ${dayNum}`);
    
    const summary = summaryMap[dayKey];
    
    // Determine state
    let state = 'future';
    if (dayNum <= totalDays) {
      if (summary) {
        if (summary.is_complete) {
          state = 'completed';
        } else if (summary.was_missed) {
          state = 'missed-restart';
        } else {
          state = 'missed-continue';
        }
      } else {
        state = 'missed-continue';
      }
    }
    
    dayEl.classList.add(state);
    dayEl.textContent = dayNum;
    
    // Click to show day details
    if (state !== 'future') {
      dayEl.style.cursor = 'pointer';
      dayEl.addEventListener('click', () => {
        showDayDetails(cycle, dayNum, dayKey);
      });
    }
    
    container.appendChild(dayEl);
  }
}

async function showDayDetails(cycle, dayNum, dayKey) {
  // Get blocks for this cycle
  const { data: blocks } = await supabase
    .from('routine_blocks')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('order');
  
  // Get completions for this day
  const { data: completions } = await supabase
    .from('daily_completions')
    .select('block_id')
    .eq('user_id', currentUser.id)
    .eq('date', dayKey);
  
  const completedIds = new Set(completions ? completions.map(c => c.block_id) : []);
  
  // Get summary for this day
  const { data: summary } = await supabase
    .from('daily_summary')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('date', dayKey)
    .maybeSingle();
  
  // Open day details modal (reuse existing one)
  const modal = document.getElementById('modal-day-details');
  const iconEl = document.getElementById('modal-day-icon');
  const titleEl = document.getElementById('modal-day-title');
  const dateEl = document.getElementById('modal-day-date');
  const statusEl = document.getElementById('modal-day-status');
  const blocksEl = document.getElementById('modal-day-blocks');
  
  iconEl.textContent = summary?.is_complete ? '✅' : summary?.was_missed ? '😴' : '📅';
  titleEl.textContent = `DAY ${dayNum}`;
  dateEl.textContent = new Date(dayKey + 'T00:00:00').toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  if (summary) {
    if (summary.is_complete) {
      statusEl.textContent = '✅ Completed';
      statusEl.style.color = 'var(--c-success)';
    } else if (summary.was_missed) {
      statusEl.textContent = '😴 Missed - Restarted';
      statusEl.style.color = 'var(--c-danger)';
    } else {
      statusEl.textContent = '⚠️ Missed - Continued';
      statusEl.style.color = 'var(--c-warning)';
    }
  } else {
    statusEl.textContent = '— Not Reached';
    statusEl.style.color = 'var(--c-text-dim)';
  }
  
  // Render blocks
  if (blocks && blocks.length > 0) {
    const completed = blocks.filter(b => completedIds.has(b.id)).length;
    const total = blocks.length;
    const pct = Math.round((completed / total) * 100);
    
    blocksEl.innerHTML = `
      <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--c-surface-2); border-radius: var(--r-sm);">
        <strong>${completed}/${total} blocks completed (${pct}%)</strong>
      </div>
      ${blocks.map(block => `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid var(--c-border);">
          <span style="font-size: 1.2rem;">${completedIds.has(block.id) ? '✅' : '⭕'}</span>
          <span style="flex: 1; color: var(--c-text);">${block.name}</span>
        </div>
      `).join('')}
    `;
  } else {
    blocksEl.innerHTML = '<p style="color: var(--c-text-dim);">No blocks data available</p>';
  }
  
  modal?.classList.remove('hidden');
}

async function changePassword() {
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const errorEl = document.getElementById('change-password-error');
  const successEl = document.getElementById('change-password-success');
  
  // Hide previous messages
  errorEl?.classList.add('hidden');
  successEl?.classList.add('hidden');
  
  // Validation
  if (!newPassword || !confirmPassword) {
    if (errorEl) {
      errorEl.textContent = 'Please fill in all fields';
      errorEl.classList.remove('hidden');
    }
    return;
  }
  
  if (newPassword.length < 6) {
    if (errorEl) {
      errorEl.textContent = 'Password must be at least 6 characters';
      errorEl.classList.remove('hidden');
    }
    return;
  }
  
  if (newPassword !== confirmPassword) {
    if (errorEl) {
      errorEl.textContent = 'Passwords do not match';
      errorEl.classList.remove('hidden');
    }
    return;
  }
  
  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });
    
    if (error) throw error;
    
    // Success
    if (successEl) {
      successEl.textContent = 'Password updated successfully!';
      successEl.classList.remove('hidden');
    }
    
    // Clear inputs
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    
    // Close modal after 1.5s
    setTimeout(() => {
      closeChangePasswordModal();
    }, 1500);
    
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message;
      errorEl.classList.remove('hidden');
    }
  }
}

function openChangePasswordModal() {
  const modal = document.getElementById('modal-change-password');
  if (modal) modal.classList.remove('hidden');
  
  // Clear previous messages and inputs
  document.getElementById('change-password-error')?.classList.add('hidden');
  document.getElementById('change-password-success')?.classList.add('hidden');
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
}

function closeChangePasswordModal() {
  const modal = document.getElementById('modal-change-password');
  if (modal) modal.classList.add('hidden');
}

async function deleteAccount() {
  try {
    const userId = currentUser.id;
    
    // Delete all user data from all tables
    await Promise.all([
      supabase.from('daily_completions').delete().eq('user_id', userId),
      supabase.from('daily_summary').delete().eq('user_id', userId),
      supabase.from('breathwork_videos').delete().eq('user_id', userId),
      supabase.from('youtube_queue').delete().eq('user_id', userId),
      supabase.from('challenge_cycles').delete().eq('user_id', userId),
      supabase.from('routine_blocks').delete().eq('user_id', userId),
      supabase.from('profiles').delete().eq('user_id', userId),
    ]);
    
    // Delete auth user (this will cascade delete remaining data)
    await supabaseClient.auth.admin.deleteUser(userId);
    
    // Sign out
    await supabaseClient.auth.signOut();
    
  } catch (error) {
    console.error('Error deleting account:', error);
    alert('Error deleting account. Please try again or contact support.');
  }
}

function openDeleteAccountModal() {
  const modal = document.getElementById('modal-delete-account');
  if (modal) modal.classList.remove('hidden');
}

function closeDeleteAccountModal() {
  const modal = document.getElementById('modal-delete-account');
  if (modal) modal.classList.add('hidden');
}

// ─────────────────────────────────────────────
// 27. AUTH STATE LISTENER
// ─────────────────────────────────────────────
supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_OUT") { 
    currentUser = null; 
    window.location.hash = '';
    showView("login"); 
  }
});

// ─────────────────────────────────────────────
// 28. INIT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  checkAuth();
});
