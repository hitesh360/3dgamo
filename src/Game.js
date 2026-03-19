import * as THREE from 'three';
import { CAM_FOV, CAM_NEAR, CAM_FAR } from './constants.js';
import { InputManager }   from './InputManager.js';
import { World }          from './World.js';
import { Player }         from './Player.js';
import { createVehicles } from './Vehicle.js';
import { createNPCs }     from './NPC.js';
import { DayNightCycle }  from './DayNightCycle.js';
import { Weather, WeatherType } from './Weather.js';
import { UI }             from './UI.js';

/**
 * Game – top-level orchestrator
 */
export class Game {
    constructor () {
        this._setupRenderer();
        this._setupScene();
        this._setupCamera();

        this.input   = new InputManager();
        this.clock   = new THREE.Clock();

        // World must come first (buildings, roads, etc.)
        this.world   = new World(this.scene);
        this.dayNight = new DayNightCycle(this.scene);
        this.weather  = new Weather(this.scene);

        // Connect dayNight ↔ world objects
        this.dayNight.setStreetLights(this.world.getStreetLights());
        this.dayNight.setSky (this.world.getSky());
        this.dayNight.setStars(this.world.getStars());

        // Player + vehicles + NPCs
        this.player   = new Player(this.scene, this.camera, this.input, this.world);
        this.vehicles = createVehicles(this.scene);
        this.npcs     = createNPCs(this.scene, 42);

        // UI (depends on everything above)
        this.ui = new UI(this);

        // Wire up callbacks
        this.player.onNotify = msg => this.ui.notify(msg);
        this.player.onPrompt  = msg => this.ui.setPrompt(msg);

        // Input: global hotkeys
        this._bindGlobalKeys();

        // Pointer lock / start screen
        this._setupPointerLock();

        // Resize
        window.addEventListener('resize', () => this._onResize());
    }

    // ─── Renderer ───────────────────────────────────────────────────────────────
    _setupRenderer () {
        this.renderer = new THREE.WebGLRenderer({ antialias:true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace  = THREE.SRGBColorSpace;
        this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.95;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
    }

    _setupScene () {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87ceeb, 120, 500);
    }

    _setupCamera () {
        this.camera = new THREE.PerspectiveCamera(CAM_FOV,
            window.innerWidth/window.innerHeight, CAM_NEAR, CAM_FAR);
        this.camera.position.set(0, 8, 15);
    }

    // ─── Pointer lock / start overlay ───────────────────────────────────────────
    _setupPointerLock () {
        const overlay = document.getElementById('start-overlay');
        const startBtn = document.getElementById('start-btn');

        const doLock = () => {
            overlay.style.display = 'none';
            document.body.requestPointerLock();
        };

        if (startBtn) startBtn.addEventListener('click', doLock);
        this.input.onAnyClick(() => {
            if (!this.input.locked && overlay.style.display === 'none') {
                document.body.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            const locked = !!document.pointerLockElement;
            const pauseOverlay = document.getElementById('pause-overlay');
            if (pauseOverlay) pauseOverlay.style.display = locked ? 'none' : 'flex';
            if (locked) this.player._updateMeshVis();
        });
    }

    // ─── Global hotkeys ──────────────────────────────────────────────────────────
    _bindGlobalKeys () {
        // Cycle weather
        this.input.on('keydown','KeyT', () => {
            const label = this.weather.cycleWeather();
            this.ui.notify(`Weather: ${this.weather.getLabel()}`);
        });

        // Day/night speed
        this.input.on('keydown','BracketRight', () => {
            this.dayNight.increaseSpeed();
            this.ui.notify(`⏩ Time speed ×${this.dayNight.speed.toFixed(1)}`);
        });
        this.input.on('keydown','BracketLeft', () => {
            this.dayNight.decreaseSpeed();
            this.ui.notify(`⏪ Time speed ×${this.dayNight.speed.toFixed(1)}`);
        });

        // Pause time
        this.input.on('keydown','KeyP', () => {
            this.dayNight.togglePause();
            this.ui.notify(this.dayNight.paused ? '⏸ Time paused' : '▶ Time resumed');
        });

        // Jump to times
        this.input.on('keydown','Digit1', () => { this.dayNight.setTime(8);  this.ui.notify('☀ Morning'); });
        this.input.on('keydown','Digit2', () => { this.dayNight.setTime(12); this.ui.notify('☀ Noon');    });
        this.input.on('keydown','Digit3', () => { this.dayNight.setTime(18); this.ui.notify('🌅 Sunset'); });
        this.input.on('keydown','Digit4', () => { this.dayNight.setTime(22); this.ui.notify('🌙 Night');  });
        this.input.on('keydown','Digit5', () => { this.dayNight.setTime(5);  this.ui.notify('🌅 Dawn');   });

        // Set weather directly
        this.input.on('keydown','F1', () => { this.weather.setWeather(WeatherType.CLEAR);  this.ui.notify(this.weather.getLabel()); });
        this.input.on('keydown','F2', () => { this.weather.setWeather(WeatherType.RAINY);  this.ui.notify(this.weather.getLabel()); });
        this.input.on('keydown','F3', () => { this.weather.setWeather(WeatherType.STORMY); this.ui.notify(this.weather.getLabel()); });
        this.input.on('keydown','F4', () => { this.weather.setWeather(WeatherType.FOGGY);  this.ui.notify(this.weather.getLabel()); });
        this.input.on('keydown','F5', () => { this.weather.setWeather(WeatherType.SNOWY);  this.ui.notify(this.weather.getLabel()); });

        // Scroll → camera distance
        window.addEventListener('wheel', e => {
            if (this.input.locked) this.player.adjustCamDist(e.deltaY);
        }, { passive:true });
    }

    // ─── Main loop ───────────────────────────────────────────────────────────────
    start () {
        this.clock.start();
        this._loop();
        this.ui.notify('Welcome to 3D Open World Town! 🏙  Click to start playing.');
    }

    _loop () {
        requestAnimationFrame(() => this._loop());
        const dt = Math.min(this.clock.getDelta(), 0.05);   // cap at 50 ms
        this._update(dt);
        this.renderer.render(this.scene, this.camera);
    }

    _update (dt) {
        this.dayNight.update(dt);
        this.weather.update(dt, this.player.getPos());
        this.world.update(dt);

        this.player.update(dt, this.vehicles);

        for (const v of this.vehicles) v.update(dt, this.input, this.camera);
        for (const n of this.npcs)     n.update(dt);

        this.ui.update(dt);
    }

    _onResize () {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w/h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }
}
