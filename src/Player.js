import * as THREE from 'three';
import { PLAYER_HEIGHT, PLAYER_RADIUS, PLAYER_SPEED, PLAYER_JUMP_VEL, GRAVITY, HALF_MAP } from './constants.js';

const SPRINT_MULT    = 2.0;
const MOUSE_SENS     = 0.0022;
const CAM_LERP       = 0.14;
const FRICTION_GROUND = 0.80;
const FRICTION_AIR    = 0.97;

/**
 * Player – first/third-person character controller
 */
export class Player {
    constructor (scene, camera, input, world) {
        this.scene  = scene;
        this.camera = camera;
        this.input  = input;
        this.world  = world;

        // State
        this.pos     = new THREE.Vector3(5, PLAYER_HEIGHT/2, 5);
        this.vel     = new THREE.Vector3();
        this.yaw     = 0;
        this.pitch   = 0;
        this.onGround = false;

        // Vehicle / bench state
        this.inVehicle  = false;
        this.vehicle    = null;
        this.isSitting  = false;

        // Camera
        this.camMode = 'third';     // 'third' | 'first'
        this.camDist = 8;
        this.camPitch = 0.25;       // tilt for third-person
        this._camPos  = new THREE.Vector3();

        // Callbacks set by Game
        this.onNotify  = null;
        this.onPrompt  = null;

        // Vehicle proximity check cooldown
        this._fCooldown = 0;

        this._buildMesh();
        this._registerKeys();
    }

    // ─── Mesh ───────────────────────────────────────────────────────────────────
    _buildMesh () {
        this.group = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3,0.35,1.2,8),
            new THREE.MeshLambertMaterial({ color:0x2255aa }));
        body.position.y = 0.6;  body.castShadow = true;
        this.group.add(body);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.3,8,8),
            new THREE.MeshLambertMaterial({ color:0xffcc99 }));
        head.position.y = 1.55; head.castShadow = true;
        this.group.add(head);

        // Arms
        for (const sx of [-1,1]) {
            const arm = new THREE.Mesh(
                new THREE.CylinderGeometry(0.09,0.09,0.8,6),
                new THREE.MeshLambertMaterial({ color:0x2255aa }));
            arm.position.set(sx*0.45, 0.85, 0);
            arm.rotation.z = sx*0.4;
            this.group.add(arm);
        }

        this.group.visible = false;
        this.scene.add(this.group);
    }

    // ─── Input bindings ─────────────────────────────────────────────────────────
    _registerKeys () {
        // Toggle camera view
        this.input.on('keydown','KeyV', () => {
            this.camMode = this.camMode==='third' ? 'first' : 'third';
            this._updateMeshVis();
            this._notify(this.camMode==='third' ? '📷 Third-person view' : '👁 First-person view');
        });

        // Interact
        this.input.on('keydown','KeyE', () => {
            if (this.isSitting) { this._standUp(); return; }
            if (!this.inVehicle) this._tryInteract();
        });

        // Exit vehicle / stand from sitting
        this.input.on('keydown','Escape', () => {
            if (this.isSitting)  this._standUp();
        });
    }

    // ─── Main update ────────────────────────────────────────────────────────────
    update (dt, vehicles) {
        if (this.inVehicle) { this._updateCamera(); return; }
        if (this.isSitting) { this._updateSitting(dt); return; }

        this._fCooldown = Math.max(0, this._fCooldown - dt);

        // Mouse look
        const { dx, dy } = this.input.getDelta();
        this.yaw   -= dx * MOUSE_SENS;
        this.pitch -= dy * MOUSE_SENS;
        this.pitch  = Math.max(-1.2, Math.min(0.8, this.pitch));

        // Scroll = camera distance
        // (handled externally via Game)

        this._move(dt);
        this._gravity(dt);
        this._collide();
        this._clampBounds();

        // Sync mesh
        this.group.position.set(this.pos.x, this.pos.y - PLAYER_HEIGHT/2, this.pos.z);
        this.group.rotation.y = this.yaw;

        // Bobbing arms when moving
        const speed2d = Math.sqrt(this.vel.x**2+this.vel.z**2);
        const bob = speed2d > 0.5 ? Math.sin(Date.now()*0.008)*0.15 : 0;
        this.group.children[3] && (this.group.children[3].rotation.x = bob);
        this.group.children[4] && (this.group.children[4].rotation.x = -bob);

        this._updateCamera();
        this._checkVehicleProximity(vehicles);
        this._checkInteractables();
    }

    _move (dt) {
        const ip   = this.input;
        const fwd  = new THREE.Vector3( Math.sin(this.yaw), 0,  Math.cos(this.yaw));
        const rgt  = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const spd  = PLAYER_SPEED * ((ip.isDown('ShiftLeft')||ip.isDown('ShiftRight')) ? SPRINT_MULT : 1);

        let mx=0, mz=0;
        if (ip.isDown('KeyW')||ip.isDown('ArrowUp'))    { mx+=fwd.x; mz+=fwd.z; }
        if (ip.isDown('KeyS')||ip.isDown('ArrowDown'))  { mx-=fwd.x; mz-=fwd.z; }
        if (ip.isDown('KeyA')||ip.isDown('ArrowLeft'))  { mx-=rgt.x; mz-=rgt.z; }
        if (ip.isDown('KeyD')||ip.isDown('ArrowRight')) { mx+=rgt.x; mz+=rgt.z; }

        const len = Math.sqrt(mx*mx+mz*mz);
        if (len > 0) {
            this.vel.x = (mx/len)*spd;
            this.vel.z = (mz/len)*spd;
        } else {
            const f = this.onGround ? FRICTION_GROUND : FRICTION_AIR;
            this.vel.x *= f;
            this.vel.z *= f;
            if (Math.abs(this.vel.x)<0.01) this.vel.x=0;
            if (Math.abs(this.vel.z)<0.01) this.vel.z=0;
        }

        if (ip.isDown('Space') && this.onGround) {
            this.vel.y   = PLAYER_JUMP_VEL;
            this.onGround = false;
        }

        this.pos.x += this.vel.x * dt;
        this.pos.z += this.vel.z * dt;
        this.pos.y += this.vel.y * dt;
    }

    _gravity (dt) {
        if (!this.onGround) this.vel.y += GRAVITY * dt;
        const floor = PLAYER_HEIGHT/2;
        if (this.pos.y <= floor) {
            this.pos.y   = floor;
            this.vel.y   = 0;
            this.onGround = true;
        }
    }

    _collide () {
        const r = PLAYER_RADIUS + 0.05;
        for (const c of this.world.getCollidables()) {
            if (c.type === 'box') {
                const { minX,maxX,minZ,maxZ,maxY } = c;
                if (this.pos.y > maxY) continue;
                if (this.pos.x+r > minX && this.pos.x-r < maxX &&
                    this.pos.z+r > minZ && this.pos.z-r < maxZ) {
                    const ox = Math.min(this.pos.x+r-minX, maxX-(this.pos.x-r));
                    const oz = Math.min(this.pos.z+r-minZ, maxZ-(this.pos.z-r));
                    if (ox < oz) {
                        if (this.pos.x < (minX+maxX)/2) { this.pos.x = minX-r; } else { this.pos.x = maxX+r; }
                        this.vel.x = 0;
                    } else {
                        if (this.pos.z < (minZ+maxZ)/2) { this.pos.z = minZ-r; } else { this.pos.z = maxZ+r; }
                        this.vel.z = 0;
                    }
                }
            } else if (c.type === 'cyl') {
                if (this.pos.y > c.maxY) continue;
                const dx = this.pos.x-c.x, dz = this.pos.z-c.z;
                const d  = Math.sqrt(dx*dx+dz*dz);
                const mn = r + c.radius;
                if (d < mn && d > 0.001) {
                    this.pos.x += (dx/d)*(mn-d);
                    this.pos.z += (dz/d)*(mn-d);
                }
            }
        }
    }

    _clampBounds () {
        const B = HALF_MAP - 2;
        this.pos.x = Math.max(-B, Math.min(B+200, this.pos.x));
        this.pos.z = Math.max(-B, Math.min(B,     this.pos.z));
    }

    // ─── Camera ─────────────────────────────────────────────────────────────────
    _updateCamera () {
        if (this.camMode === 'first') {
            const eyeY = this.pos.y + PLAYER_HEIGHT*0.38;
            this.camera.position.set(this.pos.x, eyeY, this.pos.z);
            const dir = new THREE.Vector3(
                Math.sin(this.yaw)*Math.cos(this.pitch),
                Math.sin(this.pitch),
                Math.cos(this.yaw)*Math.cos(this.pitch));
            this.camera.lookAt(this.camera.position.clone().add(dir));
        } else {
            const cosP = Math.cos(this.camPitch), sinP = Math.sin(this.camPitch);
            const tx = this.pos.x - Math.sin(this.yaw)*this.camDist*cosP;
            const ty = this.pos.y + PLAYER_HEIGHT*0.5 + this.camDist*sinP;
            const tz = this.pos.z - Math.cos(this.yaw)*this.camDist*cosP;
            this._camPos.lerp(new THREE.Vector3(tx,ty,tz), CAM_LERP);
            this.camera.position.copy(this._camPos);
            this.camera.lookAt(this.pos.x, this.pos.y+PLAYER_HEIGHT*0.55, this.pos.z);
        }
    }

    _updateSitting (dt) {
        const { dx } = this.input.getDelta();
        this.yaw -= dx * MOUSE_SENS;
        this._updateCamera();
        if (this.input.isDown('KeyE') || this.input.isDown('Space')) this._standUp();
    }

    _standUp () {
        this.isSitting = false;
        this._notify('Standing up...');
    }

    // ─── Vehicle proximity ──────────────────────────────────────────────────────
    _checkVehicleProximity (vehicles) {
        if (!vehicles) return;
        for (const v of vehicles) {
            const dx = this.pos.x-v.pos.x, dz = this.pos.z-v.pos.z;
            if (dx*dx+dz*dz < 16) {
                this._prompt(`Press F to enter ${v.name}`);
                if (this.input.isDown('KeyF') && this._fCooldown <= 0) {
                    this._fCooldown = 0.5;
                    this.enterVehicle(v);
                }
                return;
            }
        }
    }

    // ─── Interactables ──────────────────────────────────────────────────────────
    _checkInteractables () {
        for (const it of this.world.getInteractables()) {
            const dx = this.pos.x-it.pos.x, dz = this.pos.z-it.pos.z;
            if (dx*dx+dz*dz < it.radius*it.radius) {
                this._prompt(it.msg);
                return;
            }
        }
        this._prompt(null);
    }

    _tryInteract () {
        for (const it of this.world.getInteractables()) {
            const dx = this.pos.x-it.pos.x, dz = this.pos.z-it.pos.z;
            if (dx*dx+dz*dz < it.radius*it.radius) {
                this._doInteract(it);
                return;
            }
        }
    }

    _doInteract (it) {
        switch (it.type) {
            case 'bench':
                this.isSitting = true;
                this.vel.set(0,0,0);
                this._notify('Relaxing on bench 🌿  –  Press E or Space to stand');
                break;
            case 'fountain':
                this._notify('💦 Splash! The water is cool and refreshing!');
                break;
            case 'fishing':
                this._notify('🎣 You cast your line into the calm water...');
                break;
            default:
                this._notify(`Interacted: ${it.type}`);
        }
    }

    // ─── Vehicle enter / exit ───────────────────────────────────────────────────
    enterVehicle (v) {
        this.inVehicle = true;
        this.vehicle   = v;
        v.driver       = this;
        this.group.visible = false;
        this._notify(`Entered ${v.name}  –  WASD/Arrows = drive  •  F = exit`);
    }

    exitVehicle () {
        const v = this.vehicle;
        this.pos.set(
            v.pos.x + Math.sin(v.heading + Math.PI/2)*3.5,
            PLAYER_HEIGHT/2,
            v.pos.z + Math.cos(v.heading + Math.PI/2)*3.5);
        this.vel.set(0,0,0);
        this.onGround = false;
        this.inVehicle = false;
        v.driver = null;
        this.vehicle = null;
        this._fCooldown = 0.8;
        this._updateMeshVis();
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────
    _updateMeshVis () {
        this.group.visible = (this.camMode==='third' && this.input.locked && !this.inVehicle);
    }

    _notify (msg) { if (this.onNotify) this.onNotify(msg); }
    _prompt (msg) { if (this.onPrompt)  this.onPrompt(msg);  }

    getPos ()    { return this.pos;     }
    getCamPos () { return this.camera.position; }
    adjustCamDist (delta) {
        this.camDist  = Math.max(3, Math.min(20, this.camDist  + delta*0.008));
        this.camPitch = Math.max(0.1, Math.min(0.9, this.camPitch + delta*0.0008));
    }
}
