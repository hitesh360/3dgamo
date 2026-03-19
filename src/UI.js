/**
 * UI – HUD, minimap, notification toasts, interaction prompts
 */
export class UI {
    constructor (game) {
        this.game = game;

        this._miniCtx = null;
        this._notifQ  = [];
        this._curNotif = null;
        this._promptText = null;

        this._el  = id => document.getElementById(id);
        this._build();
    }

    // ─── Build DOM structure ────────────────────────────────────────────────────
    _build () {
        // Notification toast
        this._toastEl = this._el('toast');

        // Interaction prompt
        this._promptEl = this._el('prompt');

        // Info bar items
        this._timeEl    = this._el('hud-time');
        this._speedEl   = this._el('hud-speed');
        this._weatherEl = this._el('hud-weather');
        this._posEl     = this._el('hud-pos');

        // Minimap canvas
        const mc = this._el('minimap');
        if (mc) this._miniCtx = mc.getContext('2d');

        // Controls panel toggle
        const helpBtn = this._el('help-btn');
        const controls = this._el('controls-panel');
        if (helpBtn && controls) {
            helpBtn.addEventListener('click', () => {
                controls.style.display = controls.style.display==='none' ? 'block' : 'none';
            });
        }
    }

    // ─── Main update ────────────────────────────────────────────────────────────
    update (dt) {
        const g   = this.game;
        const p   = g.player;
        const v   = p.inVehicle ? p.vehicle : null;
        const pos = p.getPos();

        // Time
        if (this._timeEl)    this._timeEl.textContent    = g.dayNight.getTimeString();
        // Speed
        if (this._speedEl)   this._speedEl.textContent   = v ? `${Math.abs(Math.round(v.speed*3.6))} km/h` : '';
        // Weather
        if (this._weatherEl) this._weatherEl.textContent = g.weather.getLabel();
        // Position (debug / exploration aid)
        if (this._posEl)     this._posEl.textContent     = `${pos.x.toFixed(0)}, ${pos.z.toFixed(0)}`;

        // Notifications
        this._tickNotifs(dt);

        // Minimap
        this._drawMinimap();
    }

    // ─── Notification queue ─────────────────────────────────────────────────────
    notify (msg) {
        if (!msg) return;
        this._notifQ.push({ msg, ttl: 3.5 });
        if (!this._curNotif) this._nextNotif();
    }

    _nextNotif () {
        if (!this._notifQ.length) { this._curNotif = null; return; }
        this._curNotif = this._notifQ.shift();
        if (this._toastEl) {
            this._toastEl.textContent = this._curNotif.msg;
            this._toastEl.classList.remove('fade-out');
            this._toastEl.style.opacity = '1';
        }
    }

    _tickNotifs (dt) {
        if (!this._curNotif) return;
        this._curNotif.ttl -= dt;
        if (this._curNotif.ttl <= 0.5 && this._toastEl) {
            this._toastEl.classList.add('fade-out');
        }
        if (this._curNotif.ttl <= 0) this._nextNotif();
    }

    // ─── Interaction prompt ──────────────────────────────────────────────────────
    setPrompt (msg) {
        if (this._promptEl) {
            if (msg) {
                this._promptEl.textContent = msg;
                this._promptEl.style.opacity = '1';
            } else {
                this._promptEl.style.opacity = '0';
            }
        }
    }

    // ─── Minimap ────────────────────────────────────────────────────────────────
    _drawMinimap () {
        const ctx = this._miniCtx;
        if (!ctx) return;

        const W = ctx.canvas.width, H = ctx.canvas.height;
        const scale = W / 600;   // 600 = ~MAP_SIZE *1.2
        const ox = W/2, oz = H/2;

        ctx.clearRect(0,0,W,H);

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.arc(ox,oz,W/2,0,Math.PI*2); ctx.fill();

        // Clip circle
        ctx.save();
        ctx.beginPath(); ctx.arc(ox,oz,W/2-2,0,Math.PI*2); ctx.clip();

        // Grass
        ctx.fillStyle = '#2a5a2a';
        ctx.fillRect(0,0,W,H);

        // Roads – just draw grid lines
        ctx.strokeStyle = '#555';
        ctx.lineWidth   = Math.max(1, ROAD_W_PX(scale));
        const g = this.game;
        const half = 250;
        for (let i=0; i<=8; i++) {
            const v = -half + i*61;
            const px = ox + v*scale, pz = oz + v*scale;
            ctx.beginPath(); ctx.moveTo(px, oz-half*scale); ctx.lineTo(px, oz+half*scale); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ox-half*scale, pz); ctx.lineTo(ox+half*scale, pz); ctx.stroke();
        }

        // Vehicles
        const vColor = '#ffcc00';
        for (const v of g.vehicles) {
            const vx = ox + v.pos.x*scale;
            const vz = oz + v.pos.z*scale;
            ctx.fillStyle = vColor;
            ctx.beginPath(); ctx.arc(vx,vz,3,0,Math.PI*2); ctx.fill();
        }

        // NPCs
        ctx.fillStyle = '#00ff88';
        for (const n of g.npcs) {
            const nx = ox + n.pos.x*scale;
            const nz = oz + n.pos.z*scale;
            ctx.beginPath(); ctx.arc(nx,nz,1.5,0,Math.PI*2); ctx.fill();
        }

        // Player
        const pp = g.player.getPos();
        const px = ox + pp.x*scale;
        const pz = oz + pp.z*scale;
        const pyaw = g.player.inVehicle ? g.player.vehicle.heading : g.player.yaw;

        ctx.save();
        ctx.translate(px, pz);
        ctx.rotate(-pyaw);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0,-6); ctx.lineTo(4,5); ctx.lineTo(-4,5); ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.restore();  // end clip

        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ox,oz,W/2-1,0,Math.PI*2); ctx.stroke();
    }
}

function ROAD_W_PX (s) { return Math.max(1, Math.round(12*s)); }
