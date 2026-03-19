# 3D Open World Town 🏙

A fully interactive, browser-based 3D open-world town built with [Three.js](https://threejs.org/).  
Smooth on desktop **and** playable on mobile — optimised to run lag-free in any modern browser.

🎮 **Live demo:** **https://hitesh360.github.io/3dgamo/**

---

## 🚀 One-time setup to go live

Everything is automated. You only need to do this **once** in your repository settings:

1. Open **[Settings → Pages](https://github.com/hitesh360/3dgamo/settings/pages)**
2. Under **Build and deployment → Source**, choose **GitHub Actions** *(not "Deploy from a branch")*
3. Click **Save**

That's it. Every `git push` to `main` (or any active branch) will automatically build and deploy the game. No manual steps, no extra configuration.

> The GitHub Actions workflow (`.github/workflows/pages.yml`) handles `npm install`, `npm run build`,
> and deployment to GitHub Pages entirely on its own.

---

## ✨ Features

| Category | Details |
|---|---|
| 🏗 Town | 8 × 8 block procedural city – buildings, roads, sidewalks, crosswalks, street lights |
| 🌳 Nature | Parks with fountains, benches, trees; beach with pier, fishing spots |
| 🚗 Vehicles | Car, Sports Car, Truck, Motorcycle, Bicycle – all fully driveable |
| 🚶 NPCs | 20 pedestrians (distance-culled for performance) |
| 🌤 Day / Night | Sun / moon cycle, dynamic sky colour, stars, street lights auto-toggle |
| 🌦 Weather | Clear, Cloudy, Rainy, Stormy (lightning), Foggy, Snowy |
| 📷 Camera | First-person and third-person views with scroll zoom |
| 🎮 Interactions | Sit on benches, splash fountains, fish at the beach |
| 🗺 Minimap | Live radar showing player (white), vehicles (yellow), NPCs (green) |
| 🖥 HUD | Time of day, speed, weather, position display |
| 📱 Mobile | Touch joystick + swipe-look + on-screen buttons; lower quality tier auto-applied |

## ⚡ Performance

| Optimisation | Before | After |
|---|---|---|
| Road dashes (draw calls) | ~1,008 individual meshes | **4 InstancedMesh** |
| Crosswalk stripes | ~810 individual meshes | included in above 4 |
| Building windows | ~10,000+ individual meshes | **2 InstancedMesh** |
| Shadow map | 2048 × 2048 (PCFSoft) | **1024 × 1024 (PCF)** |
| Render distance | 1800 (far beyond fog) | **600** (matches fog cutoff) |
| NPCs updated per frame | all 42 | **only those within 120 m** |
| Pixel ratio (mobile) | up to 3× | **capped at 1×** |
| Shadows (mobile) | enabled | **disabled** |

## 🎮 Controls

### Desktop (keyboard + mouse)
| Key | Action |
|---|---|
| `W A S D` / Arrow keys | Move / drive |
| `Shift` | Sprint |
| `Space` | Jump |
| Mouse | Look around |
| Scroll wheel | Camera zoom |
| `V` | Toggle 1st / 3rd person |
| `E` | Interact (bench, fountain, fishing…) |
| `F` | Enter / exit vehicle |
| `H` | Horn (while driving) |
| `T` | Cycle weather |
| `F1`–`F5` | Set weather type |
| `P` | Pause / resume time |
| `[` `]` | Slow / speed up time |
| `1`–`5` | Jump to time of day |

### Mobile (touch)
| Gesture | Action |
|---|---|
| Left-half drag | Move (virtual joystick) |
| Right-half swipe | Look around |
| **Jump** button | Jump |
| **E** button | Interact |
| **F** button | Enter / exit vehicle |
| **⚡** button | Sprint |

## 🌐 Automatic Deployment

The workflow file `.github/workflows/pages.yml` triggers on every push to:
- `main` (production)
- `copilot/fix-game-performance-issues` (current development branch)

This means all performance fixes and feature updates are deployed automatically as soon as code is pushed — no manual build or upload needed.

## 🚀 Running Locally

```bash
npm install
npm run dev      # Vite dev server at http://localhost:5173/3dgamo/
```

Production build (identical to what GitHub Actions runs):

```bash
npm run build    # outputs to dist/
npm run preview  # serves dist/ locally to verify
```

## 🗂 Project Structure

```
index.html                        – main page (HUD, overlay, entry point for Vite)
vite.config.js                    – Vite config (base: '/3dgamo/' for GitHub Pages)
.nojekyll                         – disables Jekyll so GitHub Pages serves JS/assets
.github/workflows/pages.yml       – CI/CD: auto build + deploy on every push
src/
  main.js           – entry point (exposes window.gameInstance for touch controls)
  Game.js           – orchestrator: renderer, scene, game loop, mobile detection
  World.js          – procedural town (InstancedMesh roads + windows)
  Player.js         – player controller + physics
  Vehicle.js        – driveable vehicles
  NPC.js            – pedestrian AI (distance-culled)
  DayNightCycle.js  – sun/moon, sky colour, street lights
  Weather.js        – rain, snow, fog, storm particles
  InputManager.js   – keyboard, mouse, and touch input
  UI.js             – HUD, minimap, toasts, prompts
  constants.js      – shared constants
```
