# 🏛️ Family 3D Virtual Photo Exhibition

> An immersive, interactive 3D virtual art museum and photo gallery celebrating cherished family memories, milestones, and timeless stories.

![Exhibition Preview](./favicon.svg)

---

## ⚡ Instant 1-Click Launch (No npm Commands Needed!)

On Windows, simply **double-click** the file:
```text
Start-Exhibition.bat
```
This immediately starts the local server and opens the 3D exhibition in your browser at `http://localhost:3000`!

---

## 🌐 How to Upload to GitHub & Run on GitHub Pages

The repository root `index.html` is **fully self-contained and pre-bundled**. You do **not** need a build step on GitHub.

### 1. Push to your GitHub Repository
```powershell
git add .
git commit -m "Update standalone root exhibition bundle for GitHub Pages"
git push origin main
```

### 2. Turn on GitHub Pages (Standard Root Hosting)
1. Go to your repository on **GitHub.com**.
2. Click **Settings** ➔ **Pages** (in the left sidebar).
3. Under **Build and deployment** ➔ **Branch**:
   - Select branch: **`main`**
   - Select folder: **`/ (root)`**
   - Click **Save**.
4. That's it! Your site will be live at:
   `https://<YOUR-GITHUB-USERNAME>.github.io/<YOUR-REPO-NAME>/`

*(Alternatively, if you prefer GitHub Actions, the `.github/workflows/deploy.yml` workflow is also pre-configured).*

---

## 🌟 Highlights & Features

- **🎮 Full 3D Interactive Walkthrough**:
  - Roam freely through a grand museum with **WASD / Arrow Keys** and mouse look (or pointer lock).
  - Walk up to any framed artwork to see a dynamic proximity halo, spotlight illumination, and inscribed brass museum plaques.
  - Press **[E]** or click any framed painting to inspect in high-resolution with zoom, metadata, and story descriptions.

- **🌐 Trilingual Experience (E / H / EH)**:
  - **English (E)**: Elegant museum curation and detailed narratives.
  - **Hindi (H, हिन्दी)**: संस्कार, प्रेम और पारिवारिक आत्मीयता से सराबोर विवरण।
  - **Hinglish (EH)**: Conversational, fun, and lively narration (*"Puri family ke awesome moments aur nonstop masti"*).
  - Switch languages on the fly without refreshing the page!

- **🌓 Dynamic Daylight & Cyber Noir Modes**:
  - **Daylight Gallery**: Warm golden sunlight from the glass rotunda dome, marble tile floor reflections, and classical architectural warmth.
  - **Cyber Noir / Midnight Mode**: Dramatic dark slate gallery walls, glowing cyan/purple accent lighting, and jewel-like spotlights focused on the paintings.

- **📱 Seamless Mobile Experience**:
  - On-screen **Virtual Dual-Stick Joystick** for omni-directional walking.
  - Right-side touch drag for fluid camera look rotation.
  - Responsive layout, tap-to-inspect gestures, and one-tap wing teleportation.

- **🎵 Procedural Ambient Audio & Sound Effects**:
  - **Procedural Audio Engine**: Web Audio API-synthesized relaxing lo-fi jazz chords, acoustic guitar tones, and atmospheric museum pads (works 100% offline without external audio files).
  - **Dynamic Audio Visualizer**: Live animated frequency waveform bars in the bottom player bar.
  - **Spatial Sound Effects**: Realistic soft footstep sounds as you walk, authentic camera shutter click when inspecting photos, UI taps, and teleport swooshes.
  - Full player controls: Play / Pause, Next / Prev Track, Volume slider, and Mute toggle.

- **🗺️ Interactive Radar Mini-Map**:
  - Top-right compass radar showing the cross-shaped museum floor plan.
  - Real-time player position marker and vision cone showing camera orientation.
  - Click on any wing on the radar for instant teleportation!

- **🎬 Cinematic Guided Tour ("Drive Me" Mode)**:
  - Sit back and relax while the automated camera smoothly glides through the entire museum along a CatmullRom spline path, pausing at showcase pieces with soothing background music.

- **✨ The Memory Vault & Explore Hub (478+ Photos)**:
  - Complete searchable catalog of **478+ high-resolution family photos** across all 15 categories.
  - Real-time search by title, date, or collection.
  - **Favorites (Heart) System**: Save your favorite photos (persisted in `localStorage`).
  - **Auto Slideshow Mode**: Play through the photo collection with smooth transitions.
  - **Interactive Virtual Guestbook**: Visitors can post heartfelt messages and blessings, rendered as polaroid notes on the Memory Wall with celebratory confetti!

---

## 🏛️ The Five Thematic Exhibition Wings

| Wing | Theme | Description |
|---|---|---|
| **Grand Central Rotunda** | Family Highlights | The heart of the exhibition with an octagonal hall, floating golden crystal monument, and signature moments. |
| **Parents' Sanctuary** | Mummy & Papa | Celebrating Papa and Mammi, their anniversaries, Delhi trips, and guiding wisdom. |
| **Sibling Chronicles** | Brothers & Sisters | Capturing brother-sister camaraderie, playful teasing, laughter, and unbreakable bonds. |
| **Ajeet's Hall of Milestones** | Ajeet Kushwaha | Dynamic portraits, campus days, achievements, and vibrant memories of Ajeet. |
| **Heritage & Past Albums** | Nostalgia & Vintage | Throwback photographs, childhood snapshots, and time-honored roots from the family archives. |

---

## 🎮 Navigation Controls

| Input | Action |
|---|---|
| **W, A, S, D** or **Arrow Keys** | Walk Forward / Backward / Strafe Left / Right |
| **Mouse Click & Drag** | Look around (Yaw & Pitch) |
| **Left Click on Artwork** / **[E]** | Open High-Res Inspection Modal |
| **Spacebar** | Teleport / Jump in tour |
| **Esc Key** | Close open modals / Exit full screen |
| **Mobile Left Joystick** | Walk in any direction |
| **Mobile Right Swipe** | Rotate view angle |
| **Mobile Tap on Photo** | Inspect and zoom into photo |

---

## 📄 License & Credits
- **Photos & Exhibition Content**: © Kushwaha Family Archives. All Rights Reserved.
- **Architectural & 3D Interactive Design**: Crafted with care for the family.
