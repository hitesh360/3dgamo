import * as THREE from 'three';

export const WeatherType = { CLEAR:'clear', CLOUDY:'cloudy', RAINY:'rainy', STORMY:'stormy', FOGGY:'foggy', SNOWY:'snowy' };

/**
 * Weather – rain/snow particles, fog, clouds, lightning
 */
export class Weather {
    constructor (scene) {
        this.scene   = scene;
        this.current = WeatherType.CLEAR;
        this._lightningTimer = 0;
        this._flashLight     = null;

        this._buildRain();
        this._buildSnow();
        this._buildClouds();
    }

    _buildRain () {
        const N = 3000, spread = 120, height = 60;
        const pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            pos[i*3]   = (Math.random()-.5)*spread;
            pos[i*3+1] = Math.random()*height;
            pos[i*3+2] = (Math.random()-.5)*spread;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
        this._rainPos = pos;
        this.rain = new THREE.Points(geo, new THREE.PointsMaterial({color:0xaaccff,size:0.08,transparent:true,opacity:0.55,sizeAttenuation:true}));
        this.rain.visible = false;
        this.rain.frustumCulled = false;
        this.scene.add(this.rain);
    }

    _buildSnow () {
        const N = 1800, spread = 110, height = 55;
        const pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            pos[i*3]   = (Math.random()-.5)*spread;
            pos[i*3+1] = Math.random()*height;
            pos[i*3+2] = (Math.random()-.5)*spread;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
        this._snowPos = pos;
        this.snow = new THREE.Points(geo, new THREE.PointsMaterial({color:0xffffff,size:0.35,transparent:true,opacity:0.75,sizeAttenuation:true}));
        this.snow.visible = false;
        this.snow.frustumCulled = false;
        this.scene.add(this.snow);
    }

    _buildClouds () {
        this.clouds = [];
        const greyMat  = new THREE.MeshLambertMaterial({color:0xbbbbbb,transparent:true,opacity:0.72});
        const darkMat  = new THREE.MeshLambertMaterial({color:0x556677,transparent:true,opacity:0.80});

        for (let i = 0; i < 18; i++) {
            const g    = new THREE.Group();
            const mat  = (i < 9) ? greyMat : darkMat;
            const blobs = 4 + Math.floor(Math.random()*4);
            for (let j = 0; j < blobs; j++) {
                const r = 6 + Math.random()*10;
                const m = new THREE.Mesh(new THREE.SphereGeometry(r,6,4), mat);
                m.position.set((Math.random()-.5)*22,(Math.random()-.5)*6,(Math.random()-.5)*18);
                g.add(m);
            }
            const angle  = (i/18)*Math.PI*2;
            const radius = 120 + (i*17)%130;
            g.position.set(Math.cos(angle)*radius, 90+Math.random()*40, Math.sin(angle)*radius);
            g.visible = false;
            this.clouds.push(g);
            this.scene.add(g);
        }
    }

    setWeather (type) { this.current = type; this._apply(); }

    cycleWeather () {
        const types = Object.values(WeatherType);
        this.current = types[(types.indexOf(this.current)+1) % types.length];
        this._apply();
        return this.current;
    }

    _apply () {
        this.rain.visible = false;
        this.snow.visible = false;
        this.clouds.forEach(c=>{ c.visible=false; });
        if (this.scene.fog) { this.scene.fog.far = 500; this.scene.fog.color.setHex(0x87ceeb); }

        switch (this.current) {
            case WeatherType.CLOUDY:
                this.clouds.forEach(c=>{c.visible=true;});
                if (this.scene.fog) this.scene.fog.far = 380;
                break;
            case WeatherType.RAINY:
                this.rain.visible = true;
                this.clouds.slice(0,12).forEach(c=>{c.visible=true;});
                if (this.scene.fog) { this.scene.fog.far=180; this.scene.fog.color.setHex(0x778899); }
                break;
            case WeatherType.STORMY:
                this.rain.visible = true;
                this.clouds.forEach(c=>{c.visible=true;});
                if (this.scene.fog) { this.scene.fog.far=120; this.scene.fog.color.setHex(0x445566); }
                this._lightningTimer = 2;
                break;
            case WeatherType.FOGGY:
                if (this.scene.fog) { this.scene.fog.far=70; this.scene.fog.color.setHex(0xaabbcc); }
                break;
            case WeatherType.SNOWY:
                this.snow.visible = true;
                this.clouds.slice(0,10).forEach(c=>{c.visible=true;});
                if (this.scene.fog) { this.scene.fog.far=160; this.scene.fog.color.setHex(0xddeeff); }
                break;
        }
    }

    update (dt, playerPos) {
        const px = playerPos ? playerPos.x : 0;
        const pz = playerPos ? playerPos.z : 0;

        if (this.rain.visible) {
            const p = this._rainPos, n = p.length/3;
            this.rain.position.set(px, 0, pz);
            for (let i=0;i<n;i++) {
                p[i*3+1] -= 35*dt;
                if (p[i*3+1] < -2) p[i*3+1] = 58;
            }
            this.rain.geometry.attributes.position.needsUpdate = true;
        }

        if (this.snow.visible) {
            const p = this._snowPos, n = p.length/3, t = Date.now()*0.001;
            this.snow.position.set(px, 0, pz);
            for (let i=0;i<n;i++) {
                p[i*3+1] -= 2.5*dt;
                p[i*3]   += Math.sin(t*0.3+i*0.4)*0.015;
                if (p[i*3+1] < -2) p[i*3+1] = 53;
            }
            this.snow.geometry.attributes.position.needsUpdate = true;
        }

        // Slowly orbit clouds
        const ct = Date.now()*0.000008;
        this.clouds.forEach((c,i) => {
            if (!c.visible) return;
            const a = ct*(0.3+i*0.07) + (i/18)*Math.PI*2;
            const r = 120 + (i*17)%130;
            c.position.x = Math.cos(a)*r;
            c.position.z = Math.sin(a)*r;
        });

        // Lightning
        if (this.current === WeatherType.STORMY) {
            this._lightningTimer -= dt;
            if (this._lightningTimer <= 0) {
                this._lightningTimer = 2 + Math.random()*6;
                this._triggerLightning();
            }
        }
        if (this._flashLight) {
            this._flashLight.userData.life -= dt;
            if (this._flashLight.userData.life <= 0) {
                this.scene.remove(this._flashLight);
                this._flashLight = null;
            }
        }
    }

    _triggerLightning () {
        const fl = new THREE.PointLight(0xaaccff, 15, 600);
        fl.position.set((Math.random()-.5)*300, 120, (Math.random()-.5)*300);
        fl.userData.life = 0.12;
        this.scene.add(fl);
        if (this._flashLight) this.scene.remove(this._flashLight);
        this._flashLight = fl;
    }

    getLabel () {
        const n = {[WeatherType.CLEAR]:'☀ Clear',[WeatherType.CLOUDY]:'⛅ Cloudy',
                   [WeatherType.RAINY]:'🌧 Rainy',[WeatherType.STORMY]:'⛈ Storm',
                   [WeatherType.FOGGY]:'🌫 Foggy',[WeatherType.SNOWY]:'❄ Snow'};
        return n[this.current] || this.current;
    }
}
