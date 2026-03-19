import * as THREE from 'three';

const TYPES = {
    car:        { name:'Car',        maxSpd:28, accel:14, brake:18, turnSpd:1.6, friction:0.95,  w:2.2, h:1.5, l:4.5 },
    sportscar:  { name:'Sports Car', maxSpd:45, accel:28, brake:24, turnSpd:2.0, friction:0.94,  w:2.0, h:1.2, l:4.3 },
    truck:      { name:'Truck',      maxSpd:18, accel: 7, brake:12, turnSpd:0.9, friction:0.97,  w:2.8, h:2.5, l:7.0 },
    motorcycle: { name:'Motorcycle', maxSpd:42, accel:22, brake:28, turnSpd:2.5, friction:0.93,  w:0.8, h:1.1, l:2.2 },
    bicycle:    { name:'Bicycle',    maxSpd: 8, accel: 5, brake:16, turnSpd:3.0, friction:0.90,  w:0.5, h:1.0, l:1.8 },
};

const CAR_COLORS    = [0xff2222,0x2222ff,0x22aa22,0xffff00,0xffffff,0x888888,0xff8800,0x884488];
const BODY_COLORS   = [0x444444,0xcc3300,0x0033cc,0x888888];

/**
 * Vehicle – driveable vehicles (car, truck, motorcycle, bicycle)
 */
export class Vehicle {
    constructor (scene, typeKey, x, z, headingDeg=0) {
        this.scene   = scene;
        this.cfg     = TYPES[typeKey] || TYPES.car;
        this.name    = this.cfg.name;
        this.typeKey = typeKey;

        this.pos     = new THREE.Vector3(x, 0.4, z);
        this.heading = headingDeg * Math.PI/180;
        this.speed   = 0;          // current forward speed (m/s)
        this.driver  = null;

        // Driver camera
        this.driverYaw   = headingDeg * Math.PI/180;
        this.driverPitch = 0;
        this._camPos     = new THREE.Vector3();

        this._exitCooldown = 0;

        this._buildMesh();
    }

    // ─── Mesh builders ──────────────────────────────────────────────────────────
    _buildMesh () {
        this.group  = new THREE.Group();
        const tk    = this.typeKey;

        if (tk==='car' || tk==='sportscar') {
            this._buildCar(tk==='sportscar');
        } else if (tk==='truck') {
            this._buildTruck();
        } else if (tk==='motorcycle') {
            this._buildMoto();
        } else {
            this._buildBicycle();
        }

        this.group.position.copy(this.pos);
        this.group.rotation.y = this.heading;
        this.scene.add(this.group);
    }

    _buildCar (sporty) {
        const c   = this.cfg;
        const col = CAR_COLORS[Math.floor(Math.random()*CAR_COLORS.length)];
        const bodyMat  = new THREE.MeshLambertMaterial({ color:col });
        const glassMat = new THREE.MeshLambertMaterial({ color:0x99ccee, transparent:true, opacity:0.55 });
        const wheelMat = new THREE.MeshLambertMaterial({ color:0x1a1a1a });
        const rimMat   = new THREE.MeshLambertMaterial({ color:0xcccccc });
        const hlMat    = new THREE.MeshLambertMaterial({ color:0xffffcc, emissive:0x554433 });
        const tlMat    = new THREE.MeshLambertMaterial({ color:0xff2200, emissive:0x440000 });

        // Lower body
        const lower = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h*0.48, c.l), bodyMat);
        lower.position.y = c.h*0.24; lower.castShadow = true;
        this.group.add(lower);

        // Cabin
        const cabH = sporty ? c.h*0.46 : c.h*0.55;
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(c.w*0.84, cabH, c.l*(sporty?0.52:0.6)), bodyMat);
        cabin.position.set(0, c.h*0.48+cabH*0.5-0.04, -c.l*0.04);
        cabin.castShadow = true;
        this.group.add(cabin);

        // Windscreens
        const wsF = new THREE.Mesh(new THREE.BoxGeometry(c.w*0.76, cabH*0.72, 0.1), glassMat);
        wsF.position.set(0, c.h*0.48+cabH*0.42, c.l*(sporty?0.28:0.31));
        wsF.rotation.x = sporty ? 0.35 : 0.15;
        this.group.add(wsF);

        const wsR = new THREE.Mesh(new THREE.BoxGeometry(c.w*0.76, cabH*0.65, 0.1), glassMat);
        wsR.position.set(0, c.h*0.48+cabH*0.42, -c.l*(sporty?0.32:0.34));
        wsR.rotation.x = sporty ? -0.3 : -0.1;
        this.group.add(wsR);

        // Side windows
        for (const sx of [-1,1]) {
            const sw = new THREE.Mesh(new THREE.BoxGeometry(0.08, cabH*0.62, c.l*0.44), glassMat);
            sw.position.set(sx*(c.w*0.42+0.04), c.h*0.48+cabH*0.42, -c.l*0.04);
            this.group.add(sw);
        }

        // Headlights & taillights
        for (const sx of [-0.35,0.35]) {
            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.45,0.22,0.08), hlMat);
            hl.position.set(sx*c.w, c.h*0.18, c.l/2+0.04);
            this.group.add(hl);

            const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38,0.18,0.08), tlMat);
            tl.position.set(sx*c.w, c.h*0.18, -c.l/2-0.04);
            this.group.add(tl);
        }

        // Bumpers
        const bumpF = new THREE.Mesh(new THREE.BoxGeometry(c.w+0.1,0.18,0.1), new THREE.MeshLambertMaterial({color:0xcccccc}));
        bumpF.position.set(0, 0.09, c.l/2+0.06);
        this.group.add(bumpF);

        this._addWheels(c, wheelMat, rimMat, 0.35, 0.2);
    }

    _buildTruck () {
        const c   = this.cfg;
        const col = BODY_COLORS[Math.floor(Math.random()*BODY_COLORS.length)];
        const bodyMat = new THREE.MeshLambertMaterial({ color:col });
        const cargMat = new THREE.MeshLambertMaterial({ color:0x888888 });
        const wMat    = new THREE.MeshLambertMaterial({ color:0x1a1a1a });
        const rMat    = new THREE.MeshLambertMaterial({ color:0xbbbbbb });

        // Cab
        const cab = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h*0.7, c.l*0.32), bodyMat);
        cab.position.set(0, c.h*0.35, c.l*0.32);
        cab.castShadow = true;
        this.group.add(cab);

        // Cargo box
        const cargo = new THREE.Mesh(new THREE.BoxGeometry(c.w-0.1, c.h, c.l*0.65), cargMat);
        cargo.position.set(0, c.h*0.5, -c.l*0.17);
        cargo.castShadow = true;
        this.group.add(cargo);

        this._addWheels(c, wMat, rMat, 0.45, 0.3);
    }

    _buildMoto () {
        const c   = this.cfg;
        const col = CAR_COLORS[Math.floor(Math.random()*4)];
        const bodyMat  = new THREE.MeshLambertMaterial({ color:col });
        const metalMat = new THREE.MeshLambertMaterial({ color:0x888888 });
        const wMat     = new THREE.MeshLambertMaterial({ color:0x111111 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.38,1.4), bodyMat);
        body.position.y = 0.62; body.castShadow = true;
        this.group.add(body);

        const tank = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.32,0.65), bodyMat);
        tank.position.set(0,0.88,0.22); this.group.add(tank);

        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.33,0.1,0.7), bodyMat);
        seat.position.set(0,0.9,-0.18); this.group.add(seat);

        const hbar = new THREE.Mesh(new THREE.BoxGeometry(0.85,0.05,0.05), metalMat);
        hbar.position.set(0,1.0,0.65); this.group.add(hbar);

        // Wheels (Torus for visibility)
        this.wheels = [];
        for (const pz of [0.65,-0.65]) {
            const wg = new THREE.Group();
            const w  = new THREE.Mesh(new THREE.TorusGeometry(0.35,0.09,8,16), wMat);
            wg.add(w);
            wg.position.set(0, 0.36, pz);
            this.group.add(wg);
            this.wheels.push(wg);
        }
    }

    _buildBicycle () {
        const c = this.cfg;
        const frameMat = new THREE.MeshLambertMaterial({ color:CAR_COLORS[Math.floor(Math.random()*3)+1] });
        const wMat     = new THREE.MeshLambertMaterial({ color:0x222222 });

        const addTube = (geo, px,py,pz, rx=0,ry=0,rz=0) => {
            const m = new THREE.Mesh(geo, frameMat);
            m.position.set(px,py,pz); m.rotation.set(rx,ry,rz);
            this.group.add(m);
        };
        const tube = (len, r=0.025) => new THREE.CylinderGeometry(r,r,len,6);

        addTube(tube(1.2), 0, 0.55,  0.18, 0.28, 0, 0);   // down tube
        addTube(tube(0.82), 0, 0.82,  0.08, 0.08, 0, 0);   // top tube
        addTube(tube(0.72), 0, 0.60, -0.28, 0, 0, 0);      // seat tube

        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.05,0.28), frameMat);
        seat.position.set(0,0.97,-0.28); this.group.add(seat);

        const hbar = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.03,0.03), frameMat);
        hbar.position.set(0,1.0,0.48); this.group.add(hbar);

        this.wheels = [];
        for (const pz of [0.48,-0.48]) {
            const wg = new THREE.Group();
            const w  = new THREE.Mesh(new THREE.TorusGeometry(0.3,0.05,7,14), wMat);
            wg.add(w);
            wg.position.set(0, 0.3, pz);
            this.group.add(wg);
            this.wheels.push(wg);
        }
    }

    _addWheels (c, wMat, rMat, radius, thick) {
        this.wheels = [];
        const wPos = [
            { x: c.w/2+0.06,  z:  c.l*0.33 },
            { x:-c.w/2-0.06,  z:  c.l*0.33 },
            { x: c.w/2+0.06,  z: -c.l*0.33 },
            { x:-c.w/2-0.06,  z: -c.l*0.33 },
        ];
        if (this.typeKey==='truck') {
            wPos.push(
                { x: c.w/2+0.08, z: -c.l*0.18 },
                { x:-c.w/2-0.08, z: -c.l*0.18 });
        }
        for (const wp of wPos) {
            const wg = new THREE.Group();
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,thick,14), wMat);
            tire.rotation.z = Math.PI/2;
            wg.add(tire);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius*0.58,radius*0.58,thick+0.02,8), rMat);
            rim.rotation.z = Math.PI/2;
            wg.add(rim);
            wg.position.set(wp.x, radius-0.1, wp.z);
            this.group.add(wg);
            this.wheels.push(wg);
        }
    }

    // ─── Update / driving physics ───────────────────────────────────────────────
    update (dt, input, camera, sensitivity=0.0022) {
        this._exitCooldown = Math.max(0, this._exitCooldown - dt);

        if (this.driver) {
            // Driver camera look
            const { dx, dy } = input.getDelta();
            this.driverYaw   -= dx * sensitivity;
            this.driverPitch -= dy * sensitivity;
            this.driverPitch  = Math.max(-0.55, Math.min(0.55, this.driverPitch));

            const cfg = this.cfg;
            const throttle = (input.isDown('KeyW')||input.isDown('ArrowUp'))   ?  1 :
                             (input.isDown('KeyS')||input.isDown('ArrowDown'))  ? -1 : 0;
            const brake    = input.isDown('Space');
            const steerR   = (input.isDown('KeyD')||input.isDown('ArrowRight')) ?  1 :
                             (input.isDown('KeyA')||input.isDown('ArrowLeft'))  ? -1 : 0;

            // Accelerate / brake
            if (brake) {
                this.speed *= Math.max(0, 1 - cfg.brake * dt * 2.5);
            } else {
                this.speed += throttle * cfg.accel * dt;
            }

            // Friction
            this.speed *= Math.pow(cfg.friction, dt*60);

            // Clamp speed
            const maxS = cfg.maxSpd * (input.isDown('ShiftLeft') ? 1.4 : 1.0);
            this.speed  = Math.max(-cfg.maxSpd*0.35, Math.min(maxS, this.speed));

            // Steer (depends on speed)
            if (Math.abs(this.speed) > 0.3) {
                const steerAmt = cfg.turnSpd * steerR * dt * Math.min(1, Math.abs(this.speed)/5);
                this.heading  += steerAmt * Math.sign(this.speed);
            }

            // Move
            this.pos.x += Math.sin(this.heading)*this.speed*dt;
            this.pos.z += Math.cos(this.heading)*this.speed*dt;

            // Keep on ground
            this.pos.y = 0.4;

            // World bounds
            this.pos.x = Math.max(-255, Math.min(355, this.pos.x));
            this.pos.z = Math.max(-255, Math.min(255, this.pos.z));

            // Exit vehicle
            if (input.isDown('KeyF') && this._exitCooldown <= 0) {
                this._exitCooldown = 0.6;
                this.driver.exitVehicle();
                return;
            }

            // Horn
            if (input.isDown('KeyH')) { /* audio hook */ }

            // Camera follow
            this._updateDriverCamera(camera);
        }

        // Sync group
        this.group.position.copy(this.pos);
        this.group.rotation.y = this.heading;

        // Spin wheels
        if (this.wheels) {
            const wheelRot = this.speed * dt / 0.35;
            this.wheels.forEach(w => { w.rotation.x += wheelRot; });
        }
    }

    _updateDriverCamera (camera) {
        const camDist  = 9;
        const camHeight = 3.5;
        const tx = this.pos.x - Math.sin(this.heading)*camDist;
        const ty = this.pos.y + camHeight;
        const tz = this.pos.z - Math.cos(this.heading)*camDist;
        this._camPos.lerp(new THREE.Vector3(tx,ty,tz), 0.1);
        camera.position.copy(this._camPos);
        camera.lookAt(
            this.pos.x + Math.sin(this.driverYaw)*20,
            this.pos.y + 1.5 + this.driverPitch*8,
            this.pos.z + Math.cos(this.driverYaw)*20);
    }
}

/**
 * Factory – create a set of vehicles spread around the town
 */
export function createVehicles (scene) {
    const specs = [
        // [type, x, z, heading°]
        ['car',        30,  20,  90],
        ['car',       -50,  60,   0],
        ['car',        80, -80, 180],
        ['car',       -90,  -30, 270],
        ['car',        10, -150, 45],
        ['sportscar',   0,  100, 135],
        ['sportscar', -130, -90,  60],
        ['truck',     120,  50, 270],
        ['truck',     -60, 130,   0],
        ['motorcycle', 55,  -55, 180],
        ['motorcycle',-20,   80,  90],
        ['bicycle',    15,   30,   0],
        ['bicycle',   -40,  -40, 180],
    ];
    return specs.map(([t,x,z,h]) => new Vehicle(scene, t, x, z, h));
}
