/**
 * InputManager – keyboard + pointer-lock mouse input
 */
export class InputManager {
    constructor () {
        this._keys   = new Set();
        this._mdx    = 0;
        this._mdy    = 0;
        this.locked  = false;
        this._cbs    = {};          // "event:code" → [fn, …]
        this._clickCbs = [];
        this._init();
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
