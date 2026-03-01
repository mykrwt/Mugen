# Mugen — 無限 · Infinite Discipline

> A brutally honest, offline-first AI habit intelligence system. No gamification. No excuses.

![Mugen](https://img.shields.io/badge/PWA-Ready-d4af37?style=flat-square) ![Offline](https://img.shields.io/badge/Offline-First-22c55e?style=flat-square) ![AI](https://img.shields.io/badge/AI-Gemini-4285F4?style=flat-square)

---

## What is Mugen?

**Mugen (無限)** means *infinite* in Japanese. The name reflects the core idea: infinite accountability, infinite discipline — no escaping your patterns.

Mugen is not a productivity app. It is a **behavioral analysis and excuse-detection engine** built for people who want ruthless, data-driven self-accountability.

---

## Features

- **Habit Tracking** — Boolean (done/not) and numeric targets
- **Daily Logging** — With mandatory skip reasons (no silent failure)
- **GitHub-style Heatmaps** — Per-habit and overall activity grids
- **Discipline Score** — Daily score penalized for repeated excuses
- **Excuse Analytics** — Pie chart, frequency, pattern breakdown
- **AI Coach** — Google Gemini-powered behavioral analyst (chat + full analysis)
- **Offline First** — Full functionality without internet
- **No accounts, no cloud, no tracking**

---

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS
- IndexedDB (via `idb`)
- Google Gemini API (user-supplied key)
- Service Worker (PWA)

---

## Quick Start

```bash
# Install dependencies
npm install

# Dev server
npm run dev

# Build
npm run build
```

---

## AI Setup

1. Get a free API key at [aistudio.google.com](https://aistudio.google.com)
2. Open Mugen → Settings → paste your Gemini API key → Save
3. Go to Insights → AI Coach tab → chat or run Full Pattern Analysis

---

## PWA / Android Install

### Browser Install
1. Open the app in Chrome/Edge on Android
2. Tap the browser menu → "Add to Home Screen"
3. App runs in standalone mode (no browser UI)

### APK via WebView
To wrap as a proper APK:

**Using PWABuilder (recommended):**
1. Deploy to Vercel: `vercel --prod`
2. Go to [pwabuilder.com](https://www.pwabuilder.com)
3. Enter your Vercel URL
4. Click "Package for stores" → Android → Download APK

**Using Bubblewrap (advanced):**
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://your-app.vercel.app/manifest.json
bubblewrap build
```

---

## Deploy to Vercel

```bash
npm run build
npx vercel --prod
```

Or connect your GitHub repo at [vercel.com](https://vercel.com) for auto-deploys.

---

## Push to GitHub

```bash
echo "# Mugen" >> README.md
git init
git add .
git commit -m "Initial commit — Mugen habit intelligence system"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/Mugen.git
git push -u origin main
```

---

## Data & Privacy

- All data stored locally in **IndexedDB** on your device
- The only external call is to **Gemini API** (when you explicitly trigger AI analysis)
- No analytics, no trackers, no accounts
- Export your data anytime from Settings as JSON

---

## License

MIT — do whatever you want with it.
