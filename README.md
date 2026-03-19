# 3D Open World Town 🏙

A fully interactive, browser-based 3D open-world town built with [Three.js](https://threejs.org/).

## ✨ Features

| Category | Details |
|---|---|
| 🏗 Town | 8 × 8 block procedural city – buildings, roads, sidewalks, crosswalks, street lights |
| 🌳 Nature | Parks with fountains, benches, trees; beach with pier, fishing spots |
| 🚗 Vehicles | Car, Sports Car, Truck, Motorcycle, Bicycle – all fully driveable |
| 🚶 NPCs | 42 pedestrians walking along the sidewalk grid |
| 🌤 Day / Night | Sun / moon cycle, dynamic sky colour, stars, street lights auto-toggle |
| 🌦 Weather | Clear, Cloudy, Rainy, Stormy (lightning), Foggy, Snowy |
| 📷 Camera | First-person and third-person views with scroll zoom |
| 🎮 Interactions | Sit on benches, splash fountains, fish at the beach |
| 🗺 Minimap | Live radar showing player (white), vehicles (yellow), NPCs (green) |
| 🖥 HUD | Time of day, speed, weather, position display |

## 🎮 Controls

### Movement
| Key | Action |
|---|---|
| `W A S D` / Arrow keys | Move / drive |
| `Shift` | Sprint |
| `Space` | Jump |
| Mouse | Look around |
| Scroll wheel | Camera zoom |
| `V` | Toggle 1st / 3rd person |

### Interaction
| Key | Action |
|---|---|
| `E` | Interact (bench, fountain, fishing…) |
| `F` | Enter / exit vehicle |
| `H` | Horn (while driving) |

### World Controls
| Key | Action |
|---|---|
| `T` | Cycle weather |
| `F1`–`F5` | Set weather (Clear, Rain, Storm, Fog, Snow) |
| `P` | Pause / resume time |
| `[` `]` | Slow down / speed up time |
| `1`–`5` | Jump to Morning / Noon / Sunset / Night / Dawn |

## 🌐 GitHub Pages Deployment

The repository includes a GitHub Actions workflow (`.github/workflows/pages.yml`) that
automatically publishes the game to GitHub Pages on every push.

### One-time setup (do this once in your repository settings)

1. Go to your repository on GitHub → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions** *(not "Deploy from a branch")*
3. Click **Save**
4. Push any change (or click **Actions → Deploy to GitHub Pages → Run workflow**)
5. Your game will be live at **`https://hitesh360.github.io/3dgamo/`**

> **Why was I seeing the README instead of the game?**
> GitHub Pages was configured to serve from the `main` branch, which only contained
> `README.md` at that point. Changing the source to **GitHub Actions** (step 2 above)
> lets the workflow build and publish all the game files automatically.

## 🚀 Running Locally

```bash
npm install
npm run dev      # starts Vite dev server at http://localhost:5173
```

For a production build (what GitHub Actions runs):

```bash
npm run build    # outputs to dist/
npm run preview  # serves dist/ locally to verify
```

## 🗂 Project Structure

```
index.html                        – main page (HUD, overlay, entry point for Vite)
vite.config.js                    – Vite config (sets base: '/3dgamo/' for GitHub Pages)
.nojekyll                         – disables Jekyll so GitHub Pages serves files as-is
.github/workflows/pages.yml       – auto-build + deploy to GitHub Pages on every push
src/
  main.js           – entry point
  Game.js           – orchestrator (scene, renderer, game loop)
  World.js          – procedural town generation
  Player.js         – player controller + physics
  Vehicle.js        – driveable vehicles
  NPC.js            – pedestrian AI
  DayNightCycle.js  – sun/moon, sky, street lights
  Weather.js        – rain, snow, fog, storm particles
  InputManager.js   – keyboard & mouse input
  UI.js             – HUD, minimap, toasts, prompts
  constants.js      – shared constants
```
