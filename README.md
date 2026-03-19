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

## 🚀 Running Locally

```bash
npm start
# then open http://localhost:3000
```

No build step needed – the game loads Three.js directly from a CDN via an ES module import-map.

## 🗂 Project Structure

```
index.html          – main page (HUD, overlay, importmap)
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
world which matters the most, and your helps.
