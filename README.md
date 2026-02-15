# RISE — Morning Routine Tracker

**Build the routine. Own the day.**

A powerful 30-day challenge tracker for morning routines with breathwork integration, accountability partners, and comprehensive progress tracking. Built with vanilla JavaScript, Supabase, and deployed on GitHub Pages.

---

## 📋 Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Database Setup](#database-setup)
- [Deployment](#deployment)
- [Usage Guide](#usage-guide)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Features

### Core Functionality
- ✅ **30-Day Challenge Tracking** — Track daily completion of your morning routine
- 📅 **Interactive Calendar** — Color-coded 30-day grid showing completed, missed, and future days
- 📊 **Real-Time Stats** — Current day, streak tracking, completion percentages
- ⏰ **Timeline View** — Dynamic timeline showing your routine from wake-up to arrival
- 🎥 **Breathwork Integration** — Sync YouTube videos to each day of your cycle

### Advanced Features
- 📦 **Routine Templates** — Create, save, and switch between different morning routines
- 🎬 **Playlist Library** — Save and share breathwork video playlists with the community
- 📈 **Historical Cycles** — View all past 30-day challenges with detailed analytics
- 👥 **Accountability Partners** — Pair with a friend to track each other's progress
- 🔔 **Notification System** — Get notified when your partner completes their routine
- 🔄 **Cycle Management** — Continue after missed days or restart from Day 1

### User Experience
- 🎨 **Dark Mode UI** — Sleek dark theme with neon accent colors
- 📱 **Mobile Responsive** — Touch-optimized with 44px tap targets and safe area support
- ⚡ **Instant Updates** — Real-time progress tracking without page refreshes
- 🔐 **Privacy First** — Partners only see completion stats, not workout details
- 💾 **Auto-Save** — First routine and playlist automatically saved on onboarding

---

## 🎬 Demo

**Live Site:** `https://YOUR_USERNAME.github.io/fitness-tracker/`

### What You Can Do

**Dashboard:**
- View today's timeline with color-coded blocks
- Check off completed activities
- Track progress in real-time
- Watch today's breathwork video

**History:**
- See lifetime statistics
- Browse all past cycles
- Click any cycle for detailed view
- Review individual day completions

**Partners:**
- Invite accountability partner
- View partner's current stats
- Get notifications on their progress
- Stay motivated together

**Settings:**
- Manage routine templates
- Create breathwork playlists
- Switch between saved routines
- Configure account settings

---

## 🛠 Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (~4,000 lines)
- **Backend:** Supabase (PostgreSQL, Authentication, Realtime)
- **Hosting:** GitHub Pages (static site)
- **Database:** PostgreSQL with Row Level Security
- **Auth:** Supabase Auth (email/password)
- **APIs:** YouTube (thumbnails)

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/fitness-tracker.git
cd fitness-tracker
```

### 2. Create Supabase Project

1. Sign up at [supabase.com](https://supabase.com)
2. Create new project
3. Copy **Project URL** and **Anon Public Key**

### 3. Configure App

Create `config.js`:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-public-key';
```

Add to `.gitignore`:

```bash
echo "config.js" >> .gitignore
```

### 4. Set Up Database

Run SQL files in Supabase SQL Editor **in order**:

1. Initial schema (from your existing setup)
2. `prompt-2-schema.sql` (Routine templates)
3. `prompt-3-schema.sql` (Playlists)
4. `prompt-4-schema.sql` (History)
5. `prompt-5-schema.sql` (Partners)

### 5. Deploy to GitHub Pages

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

Enable Pages:
- Settings → Pages → Deploy from `main` branch

---

## 🗄️ Database Setup

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User settings and preferences |
| `routine_blocks` | User's routine activities |
| `breathwork_videos` | Breathwork video library |
| `challenge_cycles` | 30-day challenge tracking |
| `daily_completions` | Block-level completions |
| `daily_summary` | Daily progress summary |
| `routine_templates` | Saved routine templates |
| `breathwork_playlists` | Saved video playlists |
| `accountability_pairs` | Partner connections |
| `notifications` | Activity notifications |

### Running SQL Files

For each SQL file:
1. Supabase Dashboard → SQL Editor
2. Click "New query"
3. Copy/paste file contents
4. Click "Run"
5. Verify success message

**Important:** Run in order (prompt-2, 3, 4, 5).

---

## 📦 Deployment

### GitHub Pages

**Automatic:**
```bash
git push origin main
# Wait 2-3 minutes
```

**Custom Domain:**
1. Add `CNAME` file with your domain
2. Configure DNS settings
3. Enable in GitHub Pages settings

**Update Supabase:**
- Auth → URL Configuration
- Add production URL to redirect URLs

---

## 📖 Usage Guide

### First-Time Setup

**Onboarding:**
1. Sign up with email/password
2. Set arrival time (e.g., 9:00 AM)
3. Customize routine blocks
4. Add 30 breathwork video URLs
5. Start your challenge!

### Daily Routine

1. Open app
2. View today's timeline
3. Check off blocks as completed
4. Watch breathwork video
5. Track progress

### Managing Templates

1. Settings → My Routines
2. Create new templates
3. Switch anytime (restarts cycle)
4. Drag to reorder blocks

### Partner Accountability

1. Partners tab → Invite Partner
2. Enter their email
3. They accept invite
4. View each other's progress
5. Get notifications

---

## 📁 Project Structure

```
fitness-tracker/
├── index.html              # Main HTML (all views)
├── app.js                  # Application logic (~4,000 lines)
├── style.css               # Styling (~1,800 lines)
├── config.js               # Supabase config (not in repo)
├── README.md               # This file
├── prompt-2-schema.sql     # Templates table
├── prompt-3-schema.sql     # Playlists table
├── prompt-4-schema.sql     # History updates
├── prompt-5-schema.sql     # Partner system
└── PROMPT-*-COMPLETE.md    # Feature documentation
```

---

## 🐛 Troubleshooting

### Common Issues

**"supabase already declared" error:**
- Use `supabaseClient` variable name instead
- CDN creates global `supabase` object

**Email redirect to localhost:**
- Update Supabase Auth URL configuration
- Add production URL to redirect list

**Partner stats not updating:**
- Verify partner completed routine
- Check RLS policies on tables
- Refresh Partners page

**Calendar not showing:**
- Check daily_summary table for data
- Verify cycle start_date is correct
- Ensure date format is YYYY-MM-DD

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

### Guidelines

- Follow existing code style
- Add comments for complex logic
- Test thoroughly before submitting
- Update README if needed

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- **Supabase** — Backend infrastructure
- **Google Fonts** — Typography
- **YouTube** — Video integration
- **GitHub Pages** — Hosting

---

## 📞 Support

- **Issues:** GitHub Issues
- **Docs:** PROMPT-*-COMPLETE.md files
- **Updates:** Watch repository for releases

---

## 🎯 Philosophy

**RISE is built on these principles:**

1. **Consistency over intensity** — Daily progress beats occasional heroics
2. **Accountability drives success** — Partners keep you honest
3. **Data reveals patterns** — Track to understand yourself
4. **Simplicity scales** — Clean design, powerful features
5. **Privacy matters** — Share stats, hide details

**Build the routine. Own the day. 🌅**

---

**⭐ Star this repo if you find it useful!**

**📤 Share with friends who need accountability!**

**🤝 Contribute to make it even better!**
