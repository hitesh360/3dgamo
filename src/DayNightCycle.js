import * as THREE from 'three';

/**
 * DayNightCycle – sun/moon movement, sky colour, street lights, stars
 */
export class DayNightCycle {
    constructor (scene) {
        this.scene       = scene;
        this.time        = 10;   // start at 10 am (hours 0-24)
        this.speed       = 0.4;  // game-hours per real second  (~36× real time)
        this.paused      = false;
        this.streetLights = [];
        this.sky         = null;
        this.stars       = null;

        this._setupLights();
        this._setupCelestialMeshes();
    }

    _setupLights () {
        this.ambient = new THREE.AmbientLight(0x8888aa, 0.5);
        this.scene.add(this.ambient);

        this.sun = new THREE.DirectionalLight(0xfffde7, 1.2);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.width  = 1024;
        this.sun.shadow.mapSize.height = 1024;
        const sc = this.sun.shadow.camera;
        sc.near = 1; sc.far = 600;
        sc.left = -200; sc.right = 200;
        sc.top  = 200;  sc.bottom = -200;
        this.scene.add(this.sun);
        this.scene.add(this.sun.target);

        this.moon = new THREE.DirectionalLight(0x4466cc, 0.18);
        this.scene.add(this.moon);
        this.scene.add(this.moon.target);
    }

    _setupCelestialMeshes () {
        const sunGeo  = new THREE.SphereGeometry(10, 16, 16);
        const sunMat  = new THREE.MeshBasicMaterial({ color: 0xfffde7 });
        this.sunMesh  = new THREE.Mesh(sunGeo, sunMat);
        this.scene.add(this.sunMesh);

        const moonGeo  = new THREE.SphereGeometry(6, 16, 16);
        const moonMat  = new THREE.MeshBasicMaterial({ color: 0xddddff });
        this.moonMesh  = new THREE.Mesh(moonGeo, moonMat);
        this.scene.add(this.moonMesh);
    }

    // Called from World after building street lights
    setStreetLights (lights) { this.streetLights = lights; }
    setSky  (sky)   { this.sky   = sky;   }
    setStars (stars) { this.stars = stars; }

    update (dt) {
        if (!this.paused) this.time = (this.time + dt * this.speed) % 24;
        this._updateScene();
    }

    _updateScene () {
        const h = this.time;
        // Angle: sun rises at 6am (angle=0), noon at 90°, set at 18h
        const angle  = ((h - 6) / 24) * Math.PI * 2;
        const R      = 500;
        const sx     = Math.cos(angle) * R;
        const sy     = Math.sin(angle) * R;

        this.sun.position.set(sx, sy, 50);
        this.sun.target.position.set(0, 0, 0);
        this.sunMesh.position.set(sx, sy, 50);

        this.moon.position.set(-sx, -sy, -50);
        this.moon.target.position.set(0, 0, 0);
        this.moonMesh.position.set(-sx, -sy, -50);

        const sunHeight = sy / R;   // -1 to 1
        this.sun.intensity  = Math.max(0, sunHeight) * 1.5;
        this.moon.intensity = Math.max(0, -sunHeight) * 0.25;
        this.sunMesh.visible  = sunHeight > -0.05;
        this.moonMesh.visible = sunHeight < 0.05;

        // Sky colour gradient
        let skyHex, ambHex, fogHex;
        if      (h >= 5.5 && h < 8)  { const t=(h-5.5)/2.5; skyHex=_lc(0x000d1a,0x87ceeb,t); ambHex=_lc(0x111133,0x8888aa,t); fogHex=_lc(0xff8833,0x87ceeb,t); }
        else if (h >= 8   && h < 18) { skyHex=0x87ceeb; ambHex=0x9999bb; fogHex=0x87ceeb; }
        else if (h >= 18  && h < 21) { const t=(h-18)/3; skyHex=_lc(0x87ceeb,0x000d1a,t); ambHex=_lc(0x9999bb,0x111133,t); fogHex=_lc(0x87ceeb,0xff6622,t); }
        else                          { skyHex=0x000d1a; ambHex=0x111133; fogHex=0x000d1a; }

        if (this.sky)   this.sky.material.color.setHex(skyHex);
        if (this.scene.fog) this.scene.fog.color.setHex(fogHex);
        this.ambient.color.setHex(ambHex);
        const baseInt = (h >= 8 && h < 18) ? 0.7 : 0.25;
        this.ambient.intensity = baseInt + Math.max(0, sunHeight) * 0.4;

        // Stars
        if (this.stars) {
            const nightness = (h < 6 || h > 20) ? 1
                : (h >= 6 && h < 8)  ? 1 - (h-6)/2
                : (h >= 18 && h < 20) ? (h-18)/2
                : 0;
            this.stars.material.opacity = nightness * 0.9;
        }

        // Street lights on at dusk
        const lightsOn = h < 6.5 || h > 19.5;
        this.streetLights.forEach(l => { l.intensity = lightsOn ? 1.8 : 0; });
    }

    getTimeString () {
        const h  = Math.floor(this.time);
        const m  = Math.floor((this.time - h) * 60);
        const ap = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`;
    }
    getHour ()       { return this.time; }
    togglePause ()   { this.paused = !this.paused; }
    setTime (h)      { this.time = ((h % 24) + 24) % 24; }
    increaseSpeed () { this.speed = Math.min(this.speed * 2, 80); }
    decreaseSpeed () { this.speed = Math.max(this.speed / 2, 0.05); }
}

function _lc (a, b, t) {
    const ra=(a>>16)&0xff, ga=(a>>8)&0xff, ba=a&0xff;
    const rb=(b>>16)&0xff, gb=(b>>8)&0xff, bb=b&0xff;
    return (Math.round(ra+(rb-ra)*t)<<16)|(Math.round(ga+(gb-ga)*t)<<8)|Math.round(ba+(bb-ba)*t);
}
