# 🌅 RISE - Morning Routine Tracker

A beautiful, minimalist 30-day breathwork challenge tracker with synchronized video progression, reverse-calculated timeline, and comprehensive analytics.

![License](https://img.shields.io/badge/license-MIT-green)
![Supabase](https://img.shields.io/badge/database-Supabase-green)
![GitHub Pages](https://img.shields.io/badge/deploy-GitHub_Pages-blue)

---

## ✨ Features

- **🌬️ 30-Day Breathwork Challenge** - Sync video to current cycle day
- **⏰ Reverse Timeline** - Auto-calculated schedule from arrival time
- **📅 Visual Calendar** - Color-coded 30-day progress grid
- **📊 Advanced Stats** - Streak tracking, weekly completion rate, total resets
- **🔄 Missed Day Detection** - Smart restart/continue decision modal
- **✅ Real-time Tracking** - Check off blocks as you complete them
- **🎯 Daily Goals** - Track completion percentage
- **📱 Mobile-First** - Responsive design optimized for phones
- **🎨 Dark Athletic Theme** - Bebas Neue + DM Sans fonts

---

## 🚀 Quick Start

### 1️⃣ **Clone or Download**

```bash
git clone https://github.com/YOUR-USERNAME/morning-routine-tracker.git
cd morning-routine-tracker
```

### 2️⃣ **Set Up Supabase**

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run the SQL schema (see [Database Setup](#database-setup) below)
4. Get your API keys: **Settings → API**

### 3️⃣ **Configure App**

```bash
# Copy template
cp config.template.js config.js

# Edit config.js with your Supabase credentials
```

In `config.js`:
```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_KEY = 'your-anon-public-key-here';
```

### 4️⃣ **Test Locally**

Open `index.html` in your browser (use Live Server for best results)

### 5️⃣ **Deploy to GitHub Pages**

See [Deployment Guide](#deployment) below

---

## 🗄️ Database Setup

### Create Tables in Supabase

1. Open **SQL Editor** in Supabase dashboard
2. Copy the entire SQL from `database-schema.sql` (see below)
3. Click **Run**

<details>
<summary><b>📄 Click to view database-schema.sql</b></summary>

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    arrival_time TEXT NOT NULL DEFAULT '09:00',
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (auth.uid() = user_id);

-- 2. ROUTINE_BLOCKS
CREATE TABLE routine_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('hygiene', 'food', 'workout', 'wellness', 'mindset', 'travel', 'breathwork')),
    duration_min INTEGER CHECK (duration_min > 0 AND duration_min <= 180),
    sets INTEGER CHECK (sets > 0 AND sets <= 100),
    reps INTEGER CHECK (reps > 0 AND reps <= 1000),
    reps_per_set INTEGER CHECK (reps_per_set > 0 AND reps_per_set <= 100),
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT duration_or_reps CHECK ((duration_min IS NOT NULL) OR (sets IS NOT NULL AND reps IS NOT NULL))
);
CREATE INDEX idx_routine_blocks_user_id ON routine_blocks(user_id);
CREATE INDEX idx_routine_blocks_order ON routine_blocks(user_id, "order");
ALTER TABLE routine_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own routine blocks" ON routine_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own routine blocks" ON routine_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own routine blocks" ON routine_blocks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own routine blocks" ON routine_blocks FOR DELETE USING (auth.uid() = user_id);

-- 3. BREATHWORK_VIDEOS
CREATE TABLE breathwork_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 30),
    url TEXT NOT NULL,
    video_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_day UNIQUE(user_id, day_number)
);
CREATE INDEX idx_breathwork_videos_user_id ON breathwork_videos(user_id);
CREATE INDEX idx_breathwork_videos_day ON breathwork_videos(user_id, day_number);
ALTER TABLE breathwork_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own breathwork videos" ON breathwork_videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own breathwork videos" ON breathwork_videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own breathwork videos" ON breathwork_videos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own breathwork videos" ON breathwork_videos FOR DELETE USING (auth.uid() = user_id);

-- 4. DAILY_COMPLETIONS
CREATE TABLE daily_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES routine_blocks(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_block_date UNIQUE(user_id, block_id, date)
);
CREATE INDEX idx_daily_completions_user_id ON daily_completions(user_id);
CREATE INDEX idx_daily_completions_date ON daily_completions(user_id, date DESC);
CREATE INDEX idx_daily_completions_block ON daily_completions(block_id);
ALTER TABLE daily_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily completions" ON daily_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily completions" ON daily_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily completions" ON daily_completions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily completions" ON daily_completions FOR DELETE USING (auth.uid() = user_id);

-- 5. CHALLENGE_CYCLES
CREATE TABLE challenge_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_resets INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_challenge_cycles_user_id ON challenge_cycles(user_id);
CREATE INDEX idx_challenge_cycles_active ON challenge_cycles(user_id) WHERE status = 'active';
ALTER TABLE challenge_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own challenge cycles" ON challenge_cycles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own challenge cycles" ON challenge_cycles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own challenge cycles" ON challenge_cycles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own challenge cycles" ON challenge_cycles FOR DELETE USING (auth.uid() = user_id);

-- 6. DAILY_SUMMARY
CREATE TABLE daily_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_complete BOOLEAN DEFAULT FALSE,
    was_missed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_summary_date UNIQUE(user_id, date)
);
CREATE INDEX idx_daily_summary_user_date ON daily_summary(user_id, date DESC);
CREATE INDEX idx_daily_summary_complete ON daily_summary(user_id, is_complete) WHERE is_complete = TRUE;
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily summary" ON daily_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily summary" ON daily_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily summary" ON daily_summary FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily summary" ON daily_summary FOR DELETE USING (auth.uid() = user_id);

-- 7. YOUTUBE_QUEUE
CREATE TABLE youtube_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_youtube_queue_user_id ON youtube_queue(user_id);
CREATE INDEX idx_youtube_queue_order ON youtube_queue(user_id, "order");
ALTER TABLE youtube_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own youtube queue" ON youtube_queue FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routine_blocks_updated_at BEFORE UPDATE ON routine_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_challenge_cycles_updated_at BEFORE UPDATE ON challenge_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_daily_summary_updated_at BEFORE UPDATE ON daily_summary FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

</details>

---

## 🚢 Deployment

### Deploy to GitHub Pages

```bash
# Initialize git (if new project)
git init
git branch -M main

# Add files (config.js is excluded by .gitignore)
git add .
git commit -m "Initial commit: RISE morning routine tracker"

# Create repo on GitHub, then push
git remote add origin https://github.com/YOUR-USERNAME/morning-routine-tracker.git
git push -u origin main

# Enable GitHub Pages
# Go to Settings → Pages → Source: main branch → Save
```

### Configure Supabase URLs

In **Supabase → Authentication → URL Configuration**:

**Site URL:**
```
https://YOUR-USERNAME.github.io
```

**Redirect URLs:**
```
https://YOUR-USERNAME.github.io/morning-routine-tracker
https://YOUR-USERNAME.github.io/morning-routine-tracker/
```

### Handle config.js for Production

⚠️ **For GitHub Pages, you must commit config.js:**

```bash
# Remove config.js from .gitignore
# Then:
git add config.js
git commit -m "Add Supabase config with anon key (safe for frontend)"
git push origin main
```

This is **safe** because:
- ✅ Using `anon` key (designed for frontend)
- ✅ Row Level Security (RLS) protects all data
- ✅ Users can only access their own data

---

## 🔧 Troubleshooting

### ❌ Error: "Identifier 'supabase' has already been declared"

**Causes:**
1. Browser cached old version
2. Script tags duplicated in HTML
3. config.js loaded twice

**Fix:**
```bash
# Clear browser cache (Ctrl+Shift+Delete)
# Or force refresh (Ctrl+F5 / Cmd+Shift+R)

# Verify index.html only loads config.js once:
<script src="config.js"></script>
<script src="app.js"></script>
```

### ❌ Error: "Config not found"

Make sure `config.js` exists with your credentials:
```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_KEY = 'eyJhbGc...';
```

### ❌ Authentication not working

1. Check **Supabase → Authentication → URL Configuration**
2. Verify your site URL is listed
3. Check browser console for CORS errors

### ❌ Data not saving

1. Verify RLS policies exist:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```
2. Check browser console for permission errors
3. Test in **Supabase → SQL Editor**

### ❌ Calendar shows wrong day

1. Check `challenge_cycles` table has entry for your user
2. Verify `start_date` is correct
3. Inspect browser console

---

## 📱 Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Hosting:** GitHub Pages
- **Fonts:** Bebas Neue (display), DM Sans (body)
- **Design:** Mobile-first, dark theme, 480px max-width

---

## 📂 File Structure

```
morning-routine-tracker/
├── index.html           # Main HTML structure
├── style.css            # All styles (dark athletic theme)
├── app.js               # Complete application logic (1080 lines)
├── config.js            # Supabase credentials (gitignored by default)
├── config.template.js   # Template for config.js
├── .gitignore          # Excludes config.js
├── README.md           # This file
├── DEPLOY.sh           # Deployment command reference
└── demo.jsx            # React demo component
```

---

## 🎯 Key Functions

| Function | Purpose |
|---|---|
| `calculateSchedule()` | Reverse-calculates timeline from arrival time |
| `getCurrentCycleDay()` | Returns current day (1-30) in challenge |
| `checkMissedDay()` | Detects if yesterday was missed |
| `renderCalendar()` | Builds 30-day visual grid |
| `calculateStreak()` | Counts consecutive completed days |
| `getWeeklyStats()` | Returns 7-day completion percentage |
| `showDayDetails()` | Opens modal with day's block completions |

---

## 🔐 Security

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Users can only access their own data
- ✅ `anon` key safe for frontend (no service_role key)
- ✅ SQL injection prevented by Supabase client
- ✅ HTTPS enforced on GitHub Pages

---

## 🤝 Contributing

Contributions welcome! Feel free to:

1. Fork the repo
2. Create a feature branch
3. Submit a pull request

---

## 📄 License

MIT License - Free to use and modify

---

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) - Backend & auth
- [GitHub Pages](https://pages.github.com) - Hosting
- [Google Fonts](https://fonts.google.com) - Bebas Neue & DM Sans

---

## 📞 Support

Having issues? Check:
1. Browser console for errors
2. Supabase logs
3. GitHub Issues for this repo

---

**Built with ❤️ for early risers and breathwork enthusiasts**
