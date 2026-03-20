import * as THREE from 'three';
import { GRID, MAP_SIZE, ROAD_WIDTH, CELL_SIZE, BLOCK_SIZE, HALF_MAP } from './constants.js';

// Blocks that become parks  (col, row)
const PARK_BLOCKS = new Set(['1,1','3,2','5,4','2,5','6,6','4,0','0,6','7,3']);

/**
 * World – procedural 3-D town generation
 * Provides: collidables, interactables, street-light list
 */
export class World {
    constructor (scene) {
        this.scene        = scene;
        this.collidables  = [];
        this.interactables = [];
        this.streetLights  = [];

        // Accumulated window data for InstancedMesh (built during _buildBlocks)
        this._winFrontData = [];  // front/back face windows
        this._winSideData  = [];  // left/right face windows

        this._buildGround();
        this._buildRoads();
        this._buildSidewalks();
        this._buildBlocks();
        this._finalizeWindowMeshes();  // merge all windows into two InstancedMesh
        this._buildWater();
        this._buildSky();
        this._buildStars();
        this._addExtraProps();
    }

    // ─── Ground ────────────────────────────────────────────────────────────────
    _buildGround () {
        const geo = new THREE.PlaneGeometry(MAP_SIZE*3, MAP_SIZE*3);
        const mat = new THREE.MeshLambertMaterial({ color: 0x3a7d44 });
        const g   = new THREE.Mesh(geo, mat);
        g.rotation.x = -Math.PI/2;
        g.receiveShadow = true;
        this.scene.add(g);
    }

    // ─── Roads ─────────────────────────────────────────────────────────────────
    _buildRoads () {
        const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
        const dashMat = new THREE.MeshBasicMaterial ({ color: 0xffffff });
        const markMat = new THREE.MeshBasicMaterial ({ color: 0xeeeeee });

        const dashLen = 5, dashGap = 4;

        // ── Count instances for InstancedMesh pre-allocation ──────────────────
        let vDashCount = 0, hDashCount = 0, cwXCount = 0, cwZCount = 0;
        for (let i = 0; i <= GRID; i++) {
            for (let d = -HALF_MAP; d < HALF_MAP; d += dashLen + dashGap) {
                vDashCount++;
                hDashCount++;
            }
            for (let j = 0; j <= GRID; j++) {
                for (let s = 0; s < 5; s++) {
                    cwXCount++;
                    cwZCount++;
                }
            }
        }

        // ── Geometry with rotation pre-baked so instances only need position ──
        const dummy = new THREE.Object3D();

        const vDashGeo = new THREE.PlaneGeometry(0.25, dashLen);
        vDashGeo.rotateX(-Math.PI / 2);
        const vDashIM = new THREE.InstancedMesh(vDashGeo, dashMat, vDashCount);
        this.scene.add(vDashIM);

        const hDashGeo = new THREE.PlaneGeometry(dashLen, 0.25);
        hDashGeo.rotateX(-Math.PI / 2);
        const hDashIM = new THREE.InstancedMesh(hDashGeo, dashMat, hDashCount);
        this.scene.add(hDashIM);

        const stripeXGeo = new THREE.PlaneGeometry(1.0, ROAD_WIDTH * 0.8);
        stripeXGeo.rotateX(-Math.PI / 2);
        const stripeXIM = new THREE.InstancedMesh(stripeXGeo, markMat, cwXCount);
        this.scene.add(stripeXIM);

        const stripeZGeo = new THREE.PlaneGeometry(ROAD_WIDTH * 0.8, 1.0);
        stripeZGeo.rotateX(-Math.PI / 2);
        const stripeZIM = new THREE.InstancedMesh(stripeZGeo, markMat, cwZCount);
        this.scene.add(stripeZIM);

        let vDashIdx = 0, hDashIdx = 0, cwXIdx = 0, cwZIdx = 0;

        for (let i = 0; i <= GRID; i++) {
            const pos = -HALF_MAP + i * CELL_SIZE + ROAD_WIDTH/2;

            // Road surface strips (only 9 per direction – keep as plain meshes)
            const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, MAP_SIZE*1.4), roadMat);
            vRoad.rotation.x = -Math.PI/2;
            vRoad.position.set(pos, 0.01, 0);
            vRoad.receiveShadow = true;
            this.scene.add(vRoad);

            const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE*1.4, ROAD_WIDTH), roadMat);
            hRoad.rotation.x = -Math.PI/2;
            hRoad.position.set(0, 0.01, pos);
            hRoad.receiveShadow = true;
            this.scene.add(hRoad);

            // Centre dashes via InstancedMesh
            for (let d = -HALF_MAP; d < HALF_MAP; d += dashLen + dashGap) {
                dummy.position.set(pos, 0.025, d + dashLen/2);
                dummy.updateMatrix();
                vDashIM.setMatrixAt(vDashIdx++, dummy.matrix);

                dummy.position.set(d + dashLen/2, 0.025, pos);
                dummy.updateMatrix();
                hDashIM.setMatrixAt(hDashIdx++, dummy.matrix);
            }

            // Crosswalk stripes via InstancedMesh
            for (let j = 0; j <= GRID; j++) {
                const crossPos = -HALF_MAP + j * CELL_SIZE + ROAD_WIDTH/2;
                for (let s = 0; s < 5; s++) {
                    dummy.position.set(crossPos - ROAD_WIDTH/2 + 1.5 + s*2, 0.03, pos);
                    dummy.updateMatrix();
                    stripeXIM.setMatrixAt(cwXIdx++, dummy.matrix);

                    dummy.position.set(pos, 0.03, crossPos - ROAD_WIDTH/2 + 1.5 + s*2);
                    dummy.updateMatrix();
                    stripeZIM.setMatrixAt(cwZIdx++, dummy.matrix);
                }
            }
        }

        vDashIM.instanceMatrix.needsUpdate   = true;
        hDashIM.instanceMatrix.needsUpdate   = true;
        stripeXIM.instanceMatrix.needsUpdate = true;
        stripeZIM.instanceMatrix.needsUpdate = true;
    }

    // ─── Sidewalks (raised kerb strips on each block edge) ─────────────────────
    _buildSidewalks () {
        const swMat = new THREE.MeshLambertMaterial({ color: 0xc8b89a });
        const sw = 2.5; // sidewalk width

        for (let row = 0; row < GRID; row++) {
            for (let col = 0; col < GRID; col++) {
                const bx = this._blockCX(col);
                const bz = this._blockCZ(row);
                const hw = BLOCK_SIZE/2, hd = BLOCK_SIZE/2;

                // Four sidewalk strips around the block
                const strips = [
                    { w: BLOCK_SIZE+sw*2, d: sw,  x:0,      z:-(hd+sw/2) },
                    { w: BLOCK_SIZE+sw*2, d: sw,  x:0,      z: (hd+sw/2) },
                    { w: sw, d: BLOCK_SIZE, x:-(hw+sw/2), z:0 },
                    { w: sw, d: BLOCK_SIZE, x: (hw+sw/2), z:0 },
                ];
                strips.forEach(s => {
                    const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.12, s.d), swMat);
                    m.position.set(bx+s.x, 0.06, bz+s.z);
                    m.receiveShadow = true;
                    this.scene.add(m);
                });
            }
        }
    }

    // ─── Block placement ────────────────────────────────────────────────────────
    _buildBlocks () {
        for (let row = 0; row < GRID; row++) {
            for (let col = 0; col < GRID; col++) {
                const cx = this._blockCX(col);
                const cz = this._blockCZ(row);
                const key = `${col},${row}`;
                if (PARK_BLOCKS.has(key)) {
                    this._buildPark(cx, cz);
                } else {
                    this._buildCityBlock(cx, cz, col, row);
                }
                // Street light at each block corner
                const hw = BLOCK_SIZE/2 + ROAD_WIDTH*0.65;
                this._addStreetLight(cx - hw, cz - hw);
                this._addStreetLight(cx + hw, cz - hw);
            }
        }
    }

    // ─── City block ─────────────────────────────────────────────────────────────
    _buildCityBlock (cx, cz, col, row) {
        const rnd = _seeded(col*97 + row*53 + 1);
        const distFromCentre = Math.max(Math.abs(col - 3.5), Math.abs(row - 3.5));
        const maxH = Math.max(6, 55 - distFromCentre * 5.5);

        const layout = rnd() < 0.25 ? 1 : (rnd() < 0.5 ? 2 : 4);

        if (layout === 1) {
            const w = BLOCK_SIZE*0.82, d = BLOCK_SIZE*0.82;
            const h = _rand(rnd, maxH*0.5, maxH);
            this._addBuilding(cx, cz, w, d, h, rnd);
            this._addTreesAlongBlock(cx, cz, rnd);
        } else if (layout === 2) {
            const w = BLOCK_SIZE*0.44;
            const h1 = _rand(rnd, maxH*0.4, maxH);
            const h2 = _rand(rnd, maxH*0.4, maxH);
            this._addBuilding(cx - BLOCK_SIZE*0.24, cz, w, BLOCK_SIZE*0.80, h1, rnd);
            this._addBuilding(cx + BLOCK_SIZE*0.24, cz, w, BLOCK_SIZE*0.80, h2, rnd);
            this._addTreesAlongBlock(cx, cz, rnd, 2);
        } else {
            const qw = BLOCK_SIZE*0.44;
            for (let r2=0; r2<2; r2++) for (let c2=0; c2<2; c2++) {
                const bx = cx + (c2-0.5)*BLOCK_SIZE*0.48;
                const bz2 = cz + (r2-0.5)*BLOCK_SIZE*0.48;
                const h  = _rand(rnd, maxH*0.35, maxH);
                this._addBuilding(bx, bz2, qw, qw, h, rnd);
            }
        }
    }

    _addBuilding (x, z, w, d, h, rnd) {
        const palette = [0xe8d5b7,0xc4a882,0xa8b8c8,0x8899aa,0x7090b0,
                         0xc8d8e8,0xd0c8b8,0xb0c4d8,0x9090a8,0xe0e0d0,0x7a8a6a];
        const col = palette[Math.floor(rnd() * palette.length)];

        const mat = new THREE.MeshLambertMaterial({ color: col });

        // Main body
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        body.position.set(x, h/2, z);
        body.castShadow = body.receiveShadow = true;
        this.scene.add(body);

        // Window grid
        this._addWindowGrid(x, z, w, d, h, rnd);

        // Roof details on taller buildings
        if (h > 14 && rnd() < 0.6) this._addRooftopDetail(x, z, w, d, h, rnd);

        // Register collidable
        this.collidables.push({ type:'box',
            minX:x-w/2, maxX:x+w/2,
            minZ:z-d/2, maxZ:z+d/2, maxY:h });
    }

    _addWindowGrid (x, z, w, d, h, rnd) {
        const wWall = 1.5, wH = 1.2, floorH = 3.0;
        const floorsN   = Math.floor(h / floorH);
        const perFaceW  = Math.max(1, Math.round(w / (wWall+1.2)));
        const perFaceD  = Math.max(1, Math.round(d / (wWall+1.2)));

        // Front & back faces
        const spacingW = w / (perFaceW+1);
        for (let floor=1; floor<=floorsN; floor++) {
            const fy = floor*floorH - floorH*0.4;
            if (fy >= h) break;
            for (let wi=0; wi<perFaceW; wi++) {
                const wx = x - w/2 + spacingW*(wi+1);
                this._winFrontData.push(wx, fy, z - d/2 - 0.06);  // front
                this._winFrontData.push(wx, fy, z + d/2 + 0.06);  // back
            }
        }

        // Side faces (left & right)
        const spacingD = d / (perFaceD+1);
        for (let floor=1; floor<=floorsN; floor++) {
            const fy = floor*floorH - floorH*0.4;
            if (fy >= h) break;
            for (let wi=0; wi<perFaceD; wi++) {
                const wz = z - d/2 + spacingD*(wi+1);
                this._winSideData.push(x - w/2 - 0.06, fy, wz);  // left
                this._winSideData.push(x + w/2 + 0.06, fy, wz);  // right
            }
        }
    }

    // ─── Finalise windows as two InstancedMesh objects ──────────────────────────
    _finalizeWindowMeshes () {
        const wGlassMat = new THREE.MeshLambertMaterial({
            color: 0xaaddff, emissive: 0x223344, transparent: true, opacity: 0.8
        });
        const dummy = new THREE.Object3D();

        // Front/back windows: BoxGeometry(1.5, 1.2, 0.12)
        if (this._winFrontData.length > 0) {
            const count = this._winFrontData.length / 3;
            const geo   = new THREE.BoxGeometry(1.5, 1.2, 0.12);
            const im    = new THREE.InstancedMesh(geo, wGlassMat, count);
            for (let i = 0; i < count; i++) {
                dummy.position.set(
                    this._winFrontData[i*3],
                    this._winFrontData[i*3+1],
                    this._winFrontData[i*3+2]);
                dummy.updateMatrix();
                im.setMatrixAt(i, dummy.matrix);
            }
            im.instanceMatrix.needsUpdate = true;
            this.scene.add(im);
        }

        // Side windows: BoxGeometry(0.12, 1.2, 1.5)
        if (this._winSideData.length > 0) {
            const count = this._winSideData.length / 3;
            const geo   = new THREE.BoxGeometry(0.12, 1.2, 1.5);
            const im    = new THREE.InstancedMesh(geo, wGlassMat, count);
            for (let i = 0; i < count; i++) {
                dummy.position.set(
                    this._winSideData[i*3],
                    this._winSideData[i*3+1],
                    this._winSideData[i*3+2]);
                dummy.updateMatrix();
                im.setMatrixAt(i, dummy.matrix);
            }
            im.instanceMatrix.needsUpdate = true;
            this.scene.add(im);
        }

        // Free memory
        this._winFrontData = null;
        this._winSideData  = null;
    }

    _addRooftopDetail (x, z, w, d, h, rnd) {
        const mat = new THREE.MeshLambertMaterial({ color:0x888888 });
        if (rnd() < 0.5) {
            // Water tower
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,2,10), new THREE.MeshLambertMaterial({color:0x8B4513}));
            tank.position.set(x, h+1, z);
            this.scene.add(tank);
            for (let i=0;i<4;i++) {
                const a = i*Math.PI/2;
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,1.5,5), mat);
                leg.position.set(x+Math.cos(a)*0.65, h+0.25, z+Math.sin(a)*0.65);
                this.scene.add(leg);
            }
        } else {
            // AC + antenna
            const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.8,1.5), mat);
            ac.position.set(x+w*0.2, h+0.4, z);
            this.scene.add(ac);
            const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,3,5), mat);
            ant.position.set(x-w*0.2, h+1.5, z);
            this.scene.add(ant);
        }
    }

    // ─── Park ───────────────────────────────────────────────────────────────────
    _buildPark (cx, cz) {
        const grassMat = new THREE.MeshLambertMaterial({ color:0x4caf50 });
        const pathMat  = new THREE.MeshLambertMaterial({ color:0xd2a679 });

        // Grass base
        const grass = new THREE.Mesh(new THREE.BoxGeometry(BLOCK_SIZE, 0.05, BLOCK_SIZE), grassMat);
        grass.position.set(cx, 0.025, cz);
        grass.receiveShadow = true;
        this.scene.add(grass);

        // Cross paths
        [[BLOCK_SIZE, 2.8, 0], [2.8, BLOCK_SIZE, 0]].forEach((s,i)=>{
            const pm = new THREE.Mesh(new THREE.BoxGeometry(s[0],0.06,s[1]), pathMat);
            pm.position.set(cx, 0.055, cz);
            pm.receiveShadow = true;
            this.scene.add(pm);
        });

        // Fountain
        this._addFountain(cx, cz);

        const rnd = _seeded(cx*7+cz*13);

        // Ring of trees
        for (let i=0; i<10; i++) {
            const a = (i/10)*Math.PI*2;
            const r = BLOCK_SIZE*0.34 + rnd()*4 - 2;
            this._addTree(cx+Math.cos(a)*r, cz+Math.sin(a)*r, rnd);
        }

        // Benches around fountain
        for (let i=0; i<4; i++) {
            const a = (i/4)*Math.PI*2 + Math.PI/4;
            const r = BLOCK_SIZE*0.18;
            this._addBench(cx+Math.cos(a)*r, cz+Math.sin(a)*r, a+Math.PI);
        }
    }

    _addFountain (x, z) {
        const stoneMat = new THREE.MeshLambertMaterial({ color:0x9090aa });
        const waterMat = new THREE.MeshLambertMaterial({ color:0x4499cc, transparent:true, opacity:0.8 });

        // Basin
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.5,4,0.6,12), stoneMat);
        basin.position.set(x,0.3,z);
        basin.castShadow = true;
        this.scene.add(basin);

        // Water surface
        const ws = new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.2,0.2,12), waterMat);
        ws.position.set(x,0.55,z);
        this.scene.add(ws);
        this._waterMeshes = this._waterMeshes || [];
        this._waterMeshes.push(ws);

        // Pillar
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,1.8,8), stoneMat);
        pillar.position.set(x,1.2,z);
        pillar.castShadow = true;
        this.scene.add(pillar);

        // Top sphere (spray visual)
        const spray = new THREE.Mesh(new THREE.SphereGeometry(0.55,8,8), waterMat);
        spray.position.set(x,2.6,z);
        this.scene.add(spray);
        this._waterMeshes.push(spray);

        this.interactables.push({ pos:new THREE.Vector3(x,0,z), radius:3.5,
            type:'fountain', msg:'Press E to splash! 💧' });
    }

    _addTree (x, z, rnd) {
        const sc  = 0.75 + rnd()*0.55;
        const trunkMat  = new THREE.MeshLambertMaterial({ color:0x6B3E2E });
        const greens    = [0x2e7d32,0x388e3c,0x43a047,0x1b5e20,0x27ae60];
        const leafMat   = new THREE.MeshLambertMaterial({ color:greens[Math.floor(rnd()*greens.length)] });

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22*sc, 0.3*sc, 2.2*sc, 7), trunkMat);
        trunk.position.set(x, 1.1*sc, z);
        trunk.castShadow = true;
        this.scene.add(trunk);

        // Main canopy
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.1*sc,8,6), leafMat);
        canopy.position.set(x, (2.2+2.1)*sc, z);
        canopy.castShadow = true;
        this.scene.add(canopy);

        // Secondary blobs
        for (let i=0; i<3; i++) {
            const a = (i/3)*Math.PI*2;
            const s2 = new THREE.Mesh(new THREE.SphereGeometry(1.5*sc,7,5), leafMat);
            s2.position.set(x+Math.cos(a)*1.4*sc, (2.2+1.4)*sc, z+Math.sin(a)*1.4*sc);
            s2.castShadow = true;
            this.scene.add(s2);
        }

        // Collidable trunk
        this.collidables.push({ type:'cyl', x, z, radius:0.35*sc, maxY:5*sc });
    }

    _addTreesAlongBlock (cx, cz, rnd, density=4) {
        const hw = BLOCK_SIZE/2;
        for (let i=0; i<density; i++) {
            const side = Math.floor(rnd()*4);
            let tx, tz;
            if (side===0)      { tx=cx-hw-1.2; tz=cz+(rnd()-.5)*BLOCK_SIZE*0.7; }
            else if (side===1) { tx=cx+hw+1.2; tz=cz+(rnd()-.5)*BLOCK_SIZE*0.7; }
            else if (side===2) { tx=cx+(rnd()-.5)*BLOCK_SIZE*0.7; tz=cz-hw-1.2; }
            else               { tx=cx+(rnd()-.5)*BLOCK_SIZE*0.7; tz=cz+hw+1.2; }
            this._addTree(tx, tz, rnd);
        }
    }

    _addBench (x, z, facing) {
        const woodMat  = new THREE.MeshLambertMaterial({ color:0x8B6914 });
        const metalMat = new THREE.MeshLambertMaterial({ color:0x666666 });
        const g = new THREE.Group();

        const seat = new THREE.Mesh(new THREE.BoxGeometry(2,0.1,0.55), woodMat);
        seat.position.y = 0.5;
        g.add(seat);

        const back = new THREE.Mesh(new THREE.BoxGeometry(2,0.5,0.1), woodMat);
        back.position.set(0,0.82,-0.22);
        g.add(back);

        for (const sx of [-0.85, 0.85]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.5,0.45), metalMat);
            leg.position.set(sx,0.25,0);
            g.add(leg);
        }

        g.position.set(x,0,z);
        g.rotation.y = facing;
        g.castShadow = true;
        this.scene.add(g);

        this.interactables.push({ pos:new THREE.Vector3(x,0,z), radius:2.0,
            type:'bench', msg:'Press E to sit and relax 🌿' });
    }

    _addStreetLight (x, z) {
        const poleMat  = new THREE.MeshLambertMaterial({ color:0x555555 });
        const lampMat  = new THREE.MeshLambertMaterial({ color:0xffffcc, emissive:0x887744 });

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,8,6), poleMat);
        pole.position.set(x,4,z);
        pole.castShadow = true;
        this.scene.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.1,0.1), poleMat);
        arm.position.set(x+1.1, 8.0, z);
        this.scene.add(arm);

        const lampHead = new THREE.Mesh(new THREE.BoxGeometry(1.0,0.4,0.6), lampMat);
        lampHead.position.set(x+2.1, 7.8, z);
        this.scene.add(lampHead);

        const ptLight = new THREE.PointLight(0xffee88, 0, 22, 2);
        ptLight.position.set(x+2.1, 7.4, z);
        this.scene.add(ptLight);
        this.streetLights.push(ptLight);
    }

    // ─── Water / Beach ──────────────────────────────────────────────────────────
    _buildWater () {
        const waterMat = new THREE.MeshLambertMaterial({ color:0x006994, transparent:true, opacity:0.85 });
        const shoreMat = new THREE.MeshLambertMaterial({ color:0xdeb887 });

        // Shore
        const shore = new THREE.Mesh(new THREE.PlaneGeometry(200, 600), shoreMat);
        shore.rotation.x = -Math.PI/2;
        shore.position.set(HALF_MAP+100, 0.01, 0);
        this.scene.add(shore);

        // Lake
        const lake = new THREE.Mesh(new THREE.PlaneGeometry(180, 550), waterMat);
        lake.rotation.x = -Math.PI/2;
        lake.position.set(HALF_MAP+90, 0.08, 0);
        this.scene.add(lake);
        this._waterMeshes = this._waterMeshes || [];
        this._waterMeshes.push(lake);

        // Fishing spots along shore
        for (let i=0; i<4; i++) {
            const fz = -120 + i*80;
            this._addBench(HALF_MAP+5, fz, -Math.PI/2);
            this.interactables.push({ pos:new THREE.Vector3(HALF_MAP+8, 0, fz),
                radius:3.5, type:'fishing', msg:'Press E to fish 🎣' });
        }

        // Pier
        this._buildPier(HALF_MAP+2, 30);
    }

    _buildPier (x, z) {
        const woodMat = new THREE.MeshLambertMaterial({ color:0x8B6914 });
        const deckW = 3, deckLen = 25;
        const deck = new THREE.Mesh(new THREE.BoxGeometry(deckLen, 0.2, deckW), woodMat);
        deck.position.set(x + deckLen/2, 0.3, z);
        deck.castShadow = true;
        this.scene.add(deck);

        for (let i=0; i<=4; i++) {
            const px = x + (i/4)*deckLen;
            for (const sz of [-deckW/2, deckW/2]) {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.14,2,6), woodMat);
                post.position.set(px, 0.6, z+sz);
                this.scene.add(post);
            }
        }
    }

    // ─── Sky dome ───────────────────────────────────────────────────────────────
    _buildSky () {
        const geo = new THREE.SphereGeometry(1200, 16, 8);
        const mat = new THREE.MeshBasicMaterial({ color:0x87ceeb, side:THREE.BackSide });
        this.sky  = new THREE.Mesh(geo, mat);
        this.scene.add(this.sky);
    }

    _buildStars () {
        const N   = 2500;
        const pos = new Float32Array(N*3);
        for (let i=0; i<N; i++) {
            const theta = Math.random()*Math.PI*2;
            const phi   = Math.acos(2*Math.random()-1) * 0.5; // upper hemisphere
            const r     = 1100;
            pos[i*3]   = r*Math.sin(phi)*Math.cos(theta);
            pos[i*3+1] = r*Math.cos(phi);
            pos[i*3+2] = r*Math.sin(phi)*Math.sin(theta);
        }
        const geo  = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
        this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color:0xffffff, size:2.5, transparent:true, opacity:0 }));
        this.scene.add(this.stars);
    }

    // ─── Extra world props ──────────────────────────────────────────────────────
    _addExtraProps () {
        // Scatter some trees outside the grid
        const rnd = _seeded(42);
        for (let i=0; i<60; i++) {
            const a = rnd()*Math.PI*2;
            const r = HALF_MAP*1.1 + rnd()*80;
            this._addTree(Math.cos(a)*r, Math.sin(a)*r, rnd);
        }

        // Billboard / sign posts on major roads
        this._addSign(0, 0, 'TOWN CENTRE', 0);
        this._addSign( HALF_MAP-30, 0,         'BEACH →',   0);
        this._addSign(-HALF_MAP+30, 0,         '← PARK',    0);

        // Power poles along main avenue
        for (let px=-HALF_MAP+30; px<HALF_MAP; px+=50) {
            this._addPowerPole(px, 8);
        }
    }

    _addSign (x, z, text, rotY) {
        const poleMat  = new THREE.MeshLambertMaterial({ color:0x666666 });
        const boardMat = new THREE.MeshLambertMaterial({ color:0x22aa44 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,3,6), poleMat);
        pole.position.set(x,1.5,z);
        this.scene.add(pole);
        const board = new THREE.Mesh(new THREE.BoxGeometry(4,1.2,0.15), boardMat);
        board.position.set(x,3.2,z);
        board.rotation.y = rotY;
        this.scene.add(board);
    }

    _addPowerPole (x, z) {
        const mat = new THREE.MeshLambertMaterial({ color:0x8B6914 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,9,6), mat);
        pole.position.set(x,4.5,z);
        this.scene.add(pole);
        const arm  = new THREE.Mesh(new THREE.BoxGeometry(3,0.12,0.12), mat);
        arm.position.set(x,9,z);
        this.scene.add(arm);
    }

    // ─── Update (animated water) ────────────────────────────────────────────────
    update (dt) {
        if (!this._waterMeshes) return;
        const t = Date.now()*0.001;
        this._waterMeshes.forEach((m,i) => {
            m.position.y = (m.geometry.type === 'PlaneGeometry' ? 0.08 : 0.55) + Math.sin(t*0.4+i)*0.04;
        });
    }

    // ─── Public accessors ───────────────────────────────────────────────────────
    getCollidables ()   { return this.collidables;   }
    getInteractables () { return this.interactables; }
    getStreetLights ()  { return this.streetLights;  }
    getSky ()           { return this.sky;            }
    getStars ()         { return this.stars;          }

    // ─── Helpers ────────────────────────────────────────────────────────────────
    _blockCX (col) { return -HALF_MAP + col*CELL_SIZE + ROAD_WIDTH + BLOCK_SIZE/2; }
    _blockCZ (row) { return -HALF_MAP + row*CELL_SIZE + ROAD_WIDTH + BLOCK_SIZE/2; }
}

// Deterministic pseudo-random from a seed
function _seeded (seed) {
    let s = Math.abs(seed) + 1;
    return () => { s = (s*16807) % 2147483647; return (s-1)/2147483646; };
}

function _rand (rnd, lo, hi) { return lo + rnd()*(hi-lo); }
