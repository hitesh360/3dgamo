/**
 * InputManager – keyboard + pointer-lock mouse input + mobile touch controls
 */
export class InputManager {
    constructor (mobile = false) {
        this._keys   = new Set();
        this._mdx    = 0;
        this._mdy    = 0;
        this.locked  = false;
        this._cbs    = {};          // "event:code" → [fn, …]
        this._clickCbs = [];
        this._init();
        if (mobile) this._initTouch();
    }

    _init () {
        window.addEventListener('keydown', e => {
            if (!this._keys.has(e.code)) {
                this._keys.add(e.code);
                this._fire('keydown', e.code);
            }
            if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))
                e.preventDefault();
        });

        window.addEventListener('keyup', e => {
            this._keys.delete(e.code);
            this._fire('keyup', e.code);
        });

        window.addEventListener('mousemove', e => {
            if (this.locked) {
                this._mdx += e.movementX;
                this._mdy += e.movementY;
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.locked = (document.pointerLockElement !== null);
        });

        document.addEventListener('click', () => {
            this._clickCbs.forEach(fn => fn());
        });
    }

    // ─── Touch controls ──────────────────────────────────────────────────────────
    _initTouch () {
        this._touchLeft  = null;   // { id, startX, startY }
        this._touchRight = null;   // { id, curX, curY }

        window.addEventListener('touchstart',  e => this._onTouchStart(e),  { passive: false });
        window.addEventListener('touchmove',   e => this._onTouchMove(e),   { passive: false });
        window.addEventListener('touchend',    e => this._onTouchEnd(e));
        window.addEventListener('touchcancel', e => this._onTouchEnd(e));
    }

    _onTouchStart (e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            const isLeft = t.clientX < window.innerWidth / 2;
            if (isLeft && !this._touchLeft) {
                this._touchLeft = { id: t.identifier, startX: t.clientX, startY: t.clientY };
            } else if (!isLeft && !this._touchRight) {
                this._touchRight = { id: t.identifier, curX: t.clientX, curY: t.clientY };
            }
        }
    }

    _onTouchMove (e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            // Left-side joystick → simulate WASD
            if (this._touchLeft && t.identifier === this._touchLeft.id) {
                const dx = t.clientX - this._touchLeft.startX;
                const dz = t.clientY - this._touchLeft.startY;
                const DEAD = 14;
                this._keys.delete('KeyW'); this._keys.delete('KeyS');
                this._keys.delete('KeyA'); this._keys.delete('KeyD');
                if (dz < -DEAD) this._keys.add('KeyW');
                if (dz >  DEAD) this._keys.add('KeyS');
                if (dx < -DEAD) this._keys.add('KeyA');
                if (dx >  DEAD) this._keys.add('KeyD');
            }
            // Right-side swipe → simulate mouse look
            if (this._touchRight && t.identifier === this._touchRight.id) {
                this._mdx += (t.clientX - this._touchRight.curX) * 2.0;
                this._mdy += (t.clientY - this._touchRight.curY) * 2.0;
                this._touchRight.curX = t.clientX;
                this._touchRight.curY = t.clientY;
            }
        }
    }

    _onTouchEnd (e) {
        for (const t of e.changedTouches) {
            if (this._touchLeft && t.identifier === this._touchLeft.id) {
                this._touchLeft = null;
                this._keys.delete('KeyW'); this._keys.delete('KeyS');
                this._keys.delete('KeyA'); this._keys.delete('KeyD');
            }
            if (this._touchRight && t.identifier === this._touchRight.id) {
                this._touchRight = null;
            }
        }
    }

    /** Simulate a key press from an on-screen button */
    simulateKeyDown (code) { this._keys.add(code); this._fire('keydown', code); }
    simulateKeyUp   (code) { this._keys.delete(code); this._fire('keyup', code); }

    isDown (code) { return this._keys.has(code); }

    /** Consume accumulated mouse-delta since last call */
    getDelta () {
        const d = { dx: this._mdx, dy: this._mdy };
        this._mdx = 0; this._mdy = 0;
        return d;
    }

    /** Register a key-event callback:  on('keydown','KeyV', fn) */
    on (event, code, fn) {
        const k = `${event}:${code}`;
        (this._cbs[k] = this._cbs[k] || []).push(fn);
    }

    onAnyClick (fn) { this._clickCbs.push(fn); }

    _fire (event, code) {
        const k = `${event}:${code}`;
        (this._cbs[k] || []).forEach(fn => fn());
    }

    requestLock () { document.body.requestPointerLock(); }
    exitLock    () { document.exitPointerLock();         }
}
