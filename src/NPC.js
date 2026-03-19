import * as THREE from 'three';
import { HALF_MAP, CELL_SIZE, ROAD_WIDTH } from './constants.js';

const NPC_SPEED   = 1.5;
const NPC_COLORS  = [0xffcc99,0xf0a070,0xd08050,0xffe0b2,0xffb07c];
const SHIRT_COLS  = [0x2196f3,0xf44336,0x4caf50,0x9c27b0,0xff9800,0x795548,0x607d8b,0xe91e63];
const PANT_COLS   = [0x1a237e,0x212121,0x3e2723,0x006064,0x33691e];

const WAYPOINTS   = _buildWaypoints();   // generated once

/**
 * NPC – pedestrian walking along the town's road grid
 */
export class NPC {
    constructor (scene) {
        this.scene  = scene;
        this.pos    = new THREE.Vector3();
        this.heading = 0;
        this.speed   = NPC_SPEED * (0.7 + Math.random()*0.6);
        this.wpIdx   = Math.floor(Math.random()*WAYPOINTS.length);
        this.target  = WAYPOINTS[this.wpIdx].clone();

        // Spawn near first waypoint
        const spawnWP = WAYPOINTS[this.wpIdx];
        this.pos.set(spawnWP.x + (Math.random()-0.5)*4, 0, spawnWP.z + (Math.random()-0.5)*4);

        this._buildMesh();
        this._advanceWaypoint();   // pick an adjacent target immediately
    }

    _buildMesh () {
        const g     = new THREE.Group();
        const skin  = NPC_COLORS [Math.floor(Math.random()*NPC_COLORS.length)];
        const shirt = SHIRT_COLS [Math.floor(Math.random()*SHIRT_COLS.length)];
        const pants = PANT_COLS  [Math.floor(Math.random()*PANT_COLS.length)];

        const mats  = {
            skin:  new THREE.MeshLambertMaterial({ color:skin  }),
            shirt: new THREE.MeshLambertMaterial({ color:shirt }),
            pants: new THREE.MeshLambertMaterial({ color:pants }),
        };

        // Body parts
        const add = (geo, mat, px,py,pz) => {
            const m = new THREE.Mesh(geo, mats[mat]);
            m.position.set(px,py,pz); m.castShadow = true;
            g.add(m); return m;
        };

        add(new THREE.BoxGeometry(0.38,0.5,0.22), 'shirt',  0, 1.0, 0);
        add(new THREE.BoxGeometry(0.38,0.52,0.22),'pants',  0, 0.5, 0);
        add(new THREE.SphereGeometry(0.2,8,7),    'skin',   0, 1.6, 0);

        // Arms (swing during walk)
        this._armL = add(new THREE.CylinderGeometry(0.07,0.07,0.46,6),'shirt',-0.27,0.95,0);
        this._armR = add(new THREE.CylinderGeometry(0.07,0.07,0.46,6),'shirt', 0.27,0.95,0);

        // Legs
        this._legL = add(new THREE.CylinderGeometry(0.08,0.07,0.5,6),'pants',-0.12,0.25,0);
        this._legR = add(new THREE.CylinderGeometry(0.08,0.07,0.5,6),'pants', 0.12,0.25,0);

        // Feet
        add(new THREE.BoxGeometry(0.14,0.06,0.22),'pants',-0.12,0.01, 0.05);
        add(new THREE.BoxGeometry(0.14,0.06,0.22),'pants', 0.12,0.01, 0.05);

        g.position.copy(this.pos);
        this.group = g;
        this.scene.add(g);
    }

    update (dt) {
        const dx = this.target.x - this.pos.x;
        const dz = this.target.z - this.pos.z;
        const dist = Math.sqrt(dx*dx+dz*dz);

        if (dist < 1.2) {
            this._advanceWaypoint();
            return;
        }

        const vx = (dx/dist)*this.speed;
        const vz = (dz/dist)*this.speed;
        this.pos.x += vx*dt;
        this.pos.z += vz*dt;
        this.heading = Math.atan2(dx, dz);

        // Animate limbs
        const swing = Math.sin(Date.now()*0.007) * 0.5;
        this._armL.rotation.x =  swing;
        this._armR.rotation.x = -swing;
        this._legL.rotation.x = -swing * 0.8;
        this._legR.rotation.x =  swing * 0.8;

        this.group.position.copy(this.pos);
        this.group.rotation.y = this.heading;
    }

    _advanceWaypoint () {
        // Pick a random adjacent waypoint
        const cur   = WAYPOINTS[this.wpIdx];
        const cands = [];
        for (let i=0; i<WAYPOINTS.length; i++) {
            if (i===this.wpIdx) continue;
            const dx = WAYPOINTS[i].x - cur.x;
            const dz = WAYPOINTS[i].z - cur.z;
            const d  = Math.sqrt(dx*dx+dz*dz);
            if (d < CELL_SIZE*1.5) cands.push(i);
        }
        if (cands.length===0) { this.wpIdx = Math.floor(Math.random()*WAYPOINTS.length); }
        else                  { this.wpIdx = cands[Math.floor(Math.random()*cands.length)]; }
        this.target.copy(WAYPOINTS[this.wpIdx]);
    }
}

/**
 * Factory – create N NPC pedestrians
 */
export function createNPCs (scene, count=40) {
    const npcs = [];
    for (let i=0; i<count; i++) npcs.push(new NPC(scene));
    return npcs;
}

// ─── Waypoint grid (centre of each sidewalk intersection) ──────────────────
function _buildWaypoints () {
    const pts = [];
    const sw  = ROAD_WIDTH * 0.5 + 1;     // half-road + a bit onto sidewalk
    // Each road intersection ±offset
    for (let row=0; row<=8; row++) {
        for (let col=0; col<=8; col++) {
            const rx = -HALF_MAP + col*CELL_SIZE + ROAD_WIDTH/2;
            const rz = -HALF_MAP + row*CELL_SIZE + ROAD_WIDTH/2;
            pts.push(new THREE.Vector3(rx, 0, rz));
            // Mid-block on each road segment
            if (col < 8) pts.push(new THREE.Vector3(rx + CELL_SIZE/2, 0, rz));
            if (row < 8) pts.push(new THREE.Vector3(rx, 0, rz + CELL_SIZE/2));
        }
    }
    return pts;
}
