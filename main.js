import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Configuration
const CONFIG = {
    GRAVITY: -15, // Reduced gravity (Earth is -30 for FPS feel)
    JUMP_FORCE: 8,
    SPEED: 8,
    SENSITIVITY: 0.002
};

const WEAPONS = {
    1: { name: 'PISTOLA', ammo: 12, reserve: 36, fireRate: 400, damage: 25, color: 0x00f2ff, reloadTime: 1500 },
    2: { name: 'SMG', ammo: 30, reserve: 90, fireRate: 100, damage: 15, color: 0x7000ff, reloadTime: 2000 },
    3: { name: 'SNIPER', ammo: 5, reserve: 15, fireRate: 1500, damage: 100, color: 0xff0055, reloadTime: 2500 },
    4: { name: 'FACA', ammo: Infinity, reserve: Infinity, fireRate: 300, damage: 55, color: 0xffaa00, reloadTime: 0, isMelee: true, speedMultiplier: 1.8 }
};

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050510);
        this.scene.fog = new THREE.FogExp2(0x050510, 0.035);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;

        this.controls = new PointerLockControls(this.camera, document.body);
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.currentWeapon = 1;
        this.isFiring = false;
        this.lastFireTime = 0;
        this.isReloading = false;
        this.isScoped = false;
        this.defaultFOV = 75;
        this.scopedFOV = 25;
        this.playerHealth = 100;
        this.playerAlive = true;
        this.recoilAmount = 0;
        this.recoilRecovery = 0;
        this.weaponBobTime = 0;
        this.ammoValues = {
            1: { current: 12, reserve: 36 },
            2: { current: 30, reserve: 90 },
            3: { current: 5, reserve: 15 },
            4: { current: Infinity, reserve: Infinity }
        };

        this.walls = [];
        this.targets = [];
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.weaponGroup = null;
        this.viewmodelMeshes = {};

        this.init();
    }

    init() {
        this.setupLights();
        this.setupArena();
        this.setupViewmodel();
        this.setupEventListeners();
        this.animate();
        this.updateHUD();
    }

    setupViewmodel() {
        // Viewmodel group attached to camera
        this.weaponGroup = new THREE.Group();
        this.camera.add(this.weaponGroup);
        this.scene.add(this.camera);

        // Materials
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6, metalness: 0.1 });
        const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.2, metalness: 0.9 });
        const gunDarkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.8 });
        const knifeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.1, metalness: 1.0 });
        const accentMat = new THREE.MeshStandardMaterial({ color: 0x00f2ff, emissive: 0x00f2ff, emissiveIntensity: 0.5 });

        // === PISTOL MODEL === (Smaller)
        const pistolGroup = new THREE.Group();
        const pHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.15), skinMat);
        pHand.position.set(0.05, -0.12, 0.05);
        pistolGroup.add(pHand);
        const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.2), gunMetalMat);
        pBody.position.set(0.06, -0.05, -0.1);
        pistolGroup.add(pBody);
        const pBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.1), gunDarkMat);
        pBarrel.position.set(0.06, -0.03, -0.22);
        pistolGroup.add(pBarrel);
        pistolGroup.position.set(0.2, -0.15, -0.3);
        this.viewmodelMeshes[1] = pistolGroup;

        // === SMG MODEL ===
        const smgGroup = new THREE.Group();
        const sHandR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.15), skinMat);
        sHandR.position.set(0.1, -0.15, 0.15);
        smgGroup.add(sHandR);
        const sHandL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.12), skinMat);
        sHandL.position.set(-0.15, -0.1, -0.1);
        smgGroup.add(sHandL);
        const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.5), gunMetalMat);
        sBody.position.set(0, -0.05, -0.1);
        smgGroup.add(sBody);
        smgGroup.position.set(0.25, -0.2, -0.4);
        this.viewmodelMeshes[2] = smgGroup;

        // === SNIPER MODEL === (Much larger/longer)
        const sniperGroup = new THREE.Group();
        const snBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 1.0), gunMetalMat);
        snBody.position.set(0, -0.1, 0);
        sniperGroup.add(snBody);
        const snBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.8), gunDarkMat);
        snBarrel.position.set(0, -0.05, -1.2);
        sniperGroup.add(snBarrel);
        const snMuzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2), gunDarkMat);
        snMuzzle.rotation.x = Math.PI / 2;
        snMuzzle.position.set(0, -0.05, -2.1);
        sniperGroup.add(snMuzzle);
        const snScopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3), gunDarkMat);
        snScopeBody.rotation.x = Math.PI / 2;
        snScopeBody.position.set(0, 0.08, -0.15);
        sniperGroup.add(snScopeBody);
        const snHand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.25), skinMat);
        snHand.position.set(0.12, -0.18, 0.25);
        sniperGroup.add(snHand);
        sniperGroup.position.set(0.3, -0.25, -0.4);
        this.viewmodelMeshes[3] = sniperGroup;

        // === KNIFE MODEL ===
        const knifeGroup = new THREE.Group();
        const kHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.2), skinMat);
        kHand.position.set(0.1, -0.1, 0);
        knifeGroup.add(kHand);
        const kBlade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.4), knifeMat);
        kBlade.position.set(0.12, 0.05, -0.2);
        knifeGroup.add(kBlade);
        knifeGroup.position.set(0.25, -0.3, -0.4);
        this.viewmodelMeshes[4] = knifeGroup;

        this.updateViewmodel();
    }

    updateViewmodel() {
        if (!this.weaponGroup) return;
        // Clear current meshes
        while (this.weaponGroup.children.length > 0) {
            this.weaponGroup.remove(this.weaponGroup.children[0]);
        }
        // Add current weapon mesh
        const mesh = this.viewmodelMeshes[this.currentWeapon];
        if (mesh) this.weaponGroup.add(mesh);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040, 1);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0x7000ff, 1);
        sunLight.position.set(50, 50, 50);
        sunLight.castShadow = true;
        this.scene.add(sunLight);

        // Neon Floor Lights
        const pointLight = new THREE.PointLight(0x00f2ff, 1, 50);
        pointLight.position.set(0, 5, 0);
        this.scene.add(pointLight);
    }

    setupArena() {
        // Floor
        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.1,
            metalness: 0.8
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Grid helper for tech feel
        const grid = new THREE.GridHelper(100, 20, 0x00f2ff, 0x222222);
        this.scene.add(grid);

        // Ceiling
        const ceilGeo = new THREE.PlaneGeometry(100, 100);
        const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0a0a15, roughness: 0.8, metalness: 0.2 });
        const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 20;
        this.scene.add(ceiling);

        // Ceiling neon strips
        for (let i = -40; i <= 40; i += 20) {
            const stripGeo = new THREE.BoxGeometry(0.1, 0.05, 80);
            const stripMat = new THREE.MeshBasicMaterial({ color: 0x7000ff });
            const strip = new THREE.Mesh(stripGeo, stripMat);
            strip.position.set(i, 19.95, 0);
            this.scene.add(strip);
            const stripLight = new THREE.PointLight(0x7000ff, 0.3, 20);
            stripLight.position.set(i, 19, 0);
            this.scene.add(stripLight);
        }

        // Arena Boundaries
        this.createWall(0, 10, -50, 100, 20, 1); // Back
        this.createWall(0, 10, 50, 100, 20, 1);  // Front
        this.createWall(-50, 10, 0, 1, 20, 100); // Left
        this.createWall(50, 10, 0, 1, 20, 100);  // Right

        // Central Platforms (Iceworld style)
        this.createObstacle(15, 2, 15, 5, 4, 5);
        this.createObstacle(-15, 2, 15, 5, 4, 5);
        this.createObstacle(15, 2, -15, 5, 4, 5);
        this.createObstacle(-15, 2, -15, 5, 4, 5);

        // Floating Platforms for Antigravity jumps
        this.createObstacle(0, 8, 0, 10, 0.5, 10, 0x7000ff);

        // Stairs to the platform (a spiral or simple ramp of blocks)
        this.createStairs(-8, 0, -8, 8, 4);

        // Active Enemies (humanoid characters that shoot)
        for (let i = 0; i < 6; i++) {
            this.createEnemy();
        }

        // === TRAINING ZONE (right side of arena) ===
        // Separator wall with neon sign
        this.createWall(35, 3, 0, 0.3, 6, 30);
        // Training zone light
        const trainingLight = new THREE.PointLight(0x00ff88, 0.8, 30);
        trainingLight.position.set(42, 5, 0);
        this.scene.add(trainingLight);
        // Training zone floor marker
        const markerGeo = new THREE.PlaneGeometry(20, 30);
        const markerMat = new THREE.MeshStandardMaterial({
            color: 0x003322, roughness: 0.5, metalness: 0.3, transparent: true, opacity: 0.5
        });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(42, 0.01, 0);
        this.scene.add(marker);

        // Passive dummies (don't move, don't shoot)
        for (let i = 0; i < 5; i++) {
            this.createDummy(37 + Math.random() * 10, -10 + i * 5);
        }
    }

    createDummy(x, z) {
        const dummy = new THREE.Group();

        // Green-ish materials for training dummies
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x1a2e1a, roughness: 0.3, metalness: 0.7
        });
        const accentMat = new THREE.MeshStandardMaterial({
            color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.5
        });
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.0
        });

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), bodyMat);
        head.position.y = 1.85;
        head.name = 'head';
        head.castShadow = true;
        dummy.add(head);
        // Visor
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.15), eyeMat);
        visor.position.set(0, 1.88, 0.22);
        dummy.add(visor);
        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.4), bodyMat);
        torso.position.y = 1.2;
        torso.castShadow = true;
        dummy.add(torso);
        // Stripe
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.42), accentMat);
        stripe.position.y = 1.35;
        dummy.add(stripe);
        // Arms
        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), bodyMat);
        leftArm.position.set(-0.52, 1.2, 0);
        dummy.add(leftArm);
        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), bodyMat);
        rightArm.position.set(0.52, 1.2, 0);
        dummy.add(rightArm);
        // Legs
        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, 0.25), bodyMat);
        leftLeg.position.set(-0.2, 0.375, 0);
        dummy.add(leftLeg);
        const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, 0.25), bodyMat);
        rightLeg.position.set(0.2, 0.375, 0);
        dummy.add(rightLeg);
        // Boots
        const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.12, 0.32), accentMat);
        leftBoot.position.set(-0.2, 0.06, 0.03);
        dummy.add(leftBoot);
        const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.12, 0.32), accentMat);
        rightBoot.position.set(0.2, 0.06, 0.03);
        dummy.add(rightBoot);

        dummy.position.set(x, 0, z);
        // Face left (toward main arena)
        dummy.rotation.y = -Math.PI / 2;

        dummy.userData.isEnemy = true;
        dummy.userData.isDummy = true;
        dummy.userData.health = 50;

        dummy.traverse((child) => {
            if (child.isMesh) {
                child.userData.isEnemy = true;
                child.userData.isDummy = true;
                child.userData.parentEnemy = dummy;
            }
        });

        this.scene.add(dummy);
        this.enemies.push(dummy);

        dummy.traverse((child) => {
            if (child.isMesh) {
                this.targets.push(child);
            }
        });
    }

    createStairs(startX, startY, startZ, targetHeight, numSteps) {
        const stepHeight = targetHeight / numSteps;
        const stepDepth = 2.0; // Deeper for easier climbing
        const stepWidth = 4.0;

        for (let i = 0; i < numSteps; i++) {
            const x = startX + i * 1.8;
            const y = startY + (i * stepHeight) + (stepHeight / 2);
            const z = startZ + i * 1.8;
            this.createObstacle(x, y, z, stepWidth, stepHeight, stepDepth, 0x222222);
        }
    }

    createWall(x, y, z, w, h, d) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const wall = new THREE.Mesh(geo, mat);
        wall.position.set(x, y, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);
        this.walls.push(wall);
    }

    createObstacle(x, y, z, w, h, d, color = 0x333333) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({ color });
        const obs = new THREE.Mesh(geo, mat);
        obs.position.set(x, y, z);
        obs.castShadow = true;
        obs.receiveShadow = true;
        this.scene.add(obs);
        this.walls.push(obs);
        this.targets.push(obs); // Obstacles also block shots
    }

    createEnemy() {
        const enemy = new THREE.Group();

        // Materials
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e, roughness: 0.3, metalness: 0.7
        });
        const accentMat = new THREE.MeshStandardMaterial({
            color: 0xff0055, emissive: 0xff0055, emissiveIntensity: 0.6
        });
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0x00f2ff, emissive: 0x00f2ff, emissiveIntensity: 1.0
        });

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), bodyMat);
        head.position.y = 1.85;
        head.name = 'head';
        head.castShadow = true;
        enemy.add(head);

        // Eyes (visor)
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.15), eyeMat);
        visor.position.set(0, 1.88, 0.22);
        enemy.add(visor);

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.4), bodyMat);
        torso.position.y = 1.2;
        torso.castShadow = true;
        enemy.add(torso);

        // Torso accent stripe
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.42), accentMat);
        stripe.position.y = 1.35;
        enemy.add(stripe);

        // Left Arm
        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), bodyMat);
        leftArm.position.set(-0.52, 1.2, 0);
        leftArm.geometry.translate(0, -0.35, 0); // pivot at shoulder
        leftArm.castShadow = true;
        enemy.add(leftArm);

        // Right Arm
        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), bodyMat);
        rightArm.position.set(0.52, 1.2, 0);
        rightArm.geometry.translate(0, -0.35, 0); // pivot at shoulder
        rightArm.castShadow = true;
        enemy.add(rightArm);

        // Left Leg
        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, 0.25), bodyMat);
        leftLeg.position.set(-0.2, 0.375, 0);
        leftLeg.geometry.translate(0, -0.375, 0); // pivot at hip
        leftLeg.castShadow = true;
        enemy.add(leftLeg);

        // Right Leg
        const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, 0.25), bodyMat);
        rightLeg.position.set(0.2, 0.375, 0);
        rightLeg.geometry.translate(0, -0.375, 0); // pivot at hip
        rightLeg.castShadow = true;
        enemy.add(rightLeg);

        // Boots accent
        const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.12, 0.32), accentMat);
        leftBoot.position.set(-0.2, 0.06, 0.03);
        enemy.add(leftBoot);
        const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.12, 0.32), accentMat);
        rightBoot.position.set(0.2, 0.06, 0.03);
        enemy.add(rightBoot);

        // Weapon in right hand
        const gunMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.2, metalness: 0.9 });
        const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), gunMat);
        gun.position.set(0.52, 0.95, 0.25);
        enemy.add(gun);
        // Muzzle flash point
        const muzzle = new THREE.Mesh(
            new THREE.SphereGeometry(0.06),
            new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 })
        );
        muzzle.position.set(0.52, 0.95, 0.48);
        enemy.add(muzzle);

        // Position in arena
        enemy.position.x = (Math.random() - 0.5) * 70;
        enemy.position.z = (Math.random() - 0.5) * 70;

        // Enemy data — WEAKER enemies
        enemy.userData.isEnemy = true;
        enemy.userData.health = 40; // much weaker
        enemy.userData.speed = 1.0 + Math.random() * 1.5;
        enemy.userData.walkTime = Math.random() * Math.PI * 2;
        enemy.userData.leftArm = leftArm;
        enemy.userData.rightArm = rightArm;
        enemy.userData.leftLeg = leftLeg;
        enemy.userData.rightLeg = rightLeg;
        enemy.userData.muzzle = muzzle;
        enemy.userData.lastShot = 0;
        enemy.userData.fireRate = 1500 + Math.random() * 2000; // 1.5-3.5s between shots (slower)
        enemy.userData.shootDamage = 3 + Math.floor(Math.random() * 5); // 3-7 damage (weaker)
        enemy.userData.shootRange = 25; // shorter range
        enemy.userData.accuracy = 0.3 + Math.random() * 0.25; // 30-55% accuracy (worse)

        // Set random waypoint
        enemy.userData.waypoint = new THREE.Vector3(
            (Math.random() - 0.5) * 70,
            0,
            (Math.random() - 0.5) * 70
        );

        // Mark all child meshes as part of this enemy
        enemy.traverse((child) => {
            if (child.isMesh) {
                child.userData.isEnemy = true;
                child.userData.parentEnemy = enemy;
            }
        });

        this.scene.add(enemy);
        this.enemies.push(enemy);

        // Add all child meshes to targets for raycasting
        enemy.traverse((child) => {
            if (child.isMesh) {
                this.targets.push(child);
            }
        });
    }

    updateEnemies(delta) {
        const playerPos = this.controls.getObject().position;
        const now = Date.now();

        for (const enemy of this.enemies) {
            if (!enemy.parent) continue;
            // Skip dummies — they stand still and don't shoot
            if (enemy.userData.isDummy) continue;

            const pos = enemy.position;
            const toPlayerX = playerPos.x - pos.x;
            const toPlayerZ = playerPos.z - pos.z;
            const distToPlayer = Math.sqrt(toPlayerX * toPlayerX + toPlayerZ * toPlayerZ);

            // Check if player is in range
            const inRange = distToPlayer < enemy.userData.shootRange;

            if (inRange && this.controls.isLocked && this.playerAlive) {
                // Face player
                enemy.rotation.y = Math.atan2(toPlayerX, toPlayerZ);

                // Move toward player but keep some distance
                if (distToPlayer > 8) {
                    const speed = enemy.userData.speed * delta;
                    pos.x += (toPlayerX / distToPlayer) * speed;
                    pos.z += (toPlayerZ / distToPlayer) * speed;

                    // Walking animation
                    enemy.userData.walkTime += delta * 8;
                    const swing = Math.sin(enemy.userData.walkTime) * 0.6;
                    enemy.userData.leftArm.rotation.x = swing;
                    enemy.userData.rightArm.rotation.x = -swing;
                    enemy.userData.leftLeg.rotation.x = -swing;
                    enemy.userData.rightLeg.rotation.x = swing;
                } else {
                    // Idle + aim
                    enemy.userData.leftArm.rotation.x *= 0.9;
                    enemy.userData.rightArm.rotation.x = -0.5; // Aiming pose
                    enemy.userData.leftLeg.rotation.x *= 0.9;
                    enemy.userData.rightLeg.rotation.x *= 0.9;
                }

                // SHOOT at player
                if (now - enemy.userData.lastShot > enemy.userData.fireRate) {
                    enemy.userData.lastShot = now;
                    this.enemyShoot(enemy, playerPos, distToPlayer);
                }
            } else {
                // Patrol mode
                const wp = enemy.userData.waypoint;
                const dx = wp.x - pos.x;
                const dz = wp.z - pos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist > 1.5) {
                    const speed = enemy.userData.speed * delta;
                    pos.x += (dx / dist) * speed;
                    pos.z += (dz / dist) * speed;
                    enemy.rotation.y = Math.atan2(dx, dz);

                    enemy.userData.walkTime += delta * 8;
                    const swing = Math.sin(enemy.userData.walkTime) * 0.6;
                    enemy.userData.leftArm.rotation.x = swing;
                    enemy.userData.rightArm.rotation.x = -swing;
                    enemy.userData.leftLeg.rotation.x = -swing;
                    enemy.userData.rightLeg.rotation.x = swing;
                } else {
                    enemy.userData.waypoint = new THREE.Vector3(
                        (Math.random() - 0.5) * 70, 0, (Math.random() - 0.5) * 70
                    );
                    enemy.userData.leftArm.rotation.x *= 0.9;
                    enemy.userData.rightArm.rotation.x *= 0.9;
                    enemy.userData.leftLeg.rotation.x *= 0.9;
                    enemy.userData.rightLeg.rotation.x *= 0.9;
                }
            }
        }

        // Update enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];
            const nextPos = bullet.mesh.position.clone().add(bullet.velocity.clone().multiplyScalar(delta));

            // Check wall collision for bullets
            const ray = new THREE.Raycaster(bullet.mesh.position, bullet.velocity.clone().normalize());
            ray.far = bullet.velocity.length() * delta;
            const hit = ray.intersectObjects(this.walls);

            if (hit.length > 0) {
                this.scene.remove(bullet.mesh);
                this.enemyBullets.splice(i, 1);
                continue;
            }

            bullet.mesh.position.copy(nextPos);
            bullet.life -= delta;
            if (bullet.life <= 0) {
                this.scene.remove(bullet.mesh);
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    enemyShoot(enemy, playerPos, distToPlayer) {
        // Muzzle flash
        const muzzle = enemy.userData.muzzle;
        muzzle.material.opacity = 1.0;
        setTimeout(() => { muzzle.material.opacity = 0; }, 80);

        // Create tracer bullet
        const bulletGeo = new THREE.SphereGeometry(0.05);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
        const bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);

        // Start from muzzle world position
        const muzzleWorld = new THREE.Vector3();
        muzzle.getWorldPosition(muzzleWorld);
        bulletMesh.position.copy(muzzleWorld);

        // Direction toward player with accuracy spread
        const accuracy = enemy.userData.accuracy;
        const spread = (1 - accuracy) * 2;
        const dir = new THREE.Vector3(
            playerPos.x + (Math.random() - 0.5) * spread * distToPlayer * 0.1 - muzzleWorld.x,
            playerPos.y + (Math.random() - 0.5) * spread - muzzleWorld.y,
            playerPos.z + (Math.random() - 0.5) * spread * distToPlayer * 0.1 - muzzleWorld.z
        ).normalize();

        const speed = 40;
        const velocity = dir.multiplyScalar(speed);

        this.scene.add(bulletMesh);
        this.enemyBullets.push({ mesh: bulletMesh, velocity, life: 2.0 });

        // Check hit (simplified: accuracy-based)
        if (Math.random() < accuracy && distToPlayer < enemy.userData.shootRange) {
            this.playerTakeDamage(enemy.userData.shootDamage);
        }
    }

    playerTakeDamage(amount) {
        if (!this.playerAlive) return;
        this.playerHealth -= amount;
        document.getElementById('health-value').textContent = Math.max(0, this.playerHealth);

        // Damage flash overlay
        const overlay = document.getElementById('damage-overlay');
        overlay.style.opacity = '0.4';
        setTimeout(() => { overlay.style.opacity = '0'; }, 150);

        // Screen shake
        const cam = this.controls.getObject();
        const shakeX = (Math.random() - 0.5) * 0.02;
        const shakeY = (Math.random() - 0.5) * 0.02;
        cam.rotation.x += shakeX;
        cam.rotation.y += shakeY;
        setTimeout(() => {
            cam.rotation.x -= shakeX;
            cam.rotation.y -= shakeY;
        }, 50);

        if (this.playerHealth <= 0) {
            this.addKillFeed('JOGADOR', 'INIMIGO', 'ARMA', false);
            this.playerDeath();
        }
    }

    playerDeath() {
        this.playerAlive = false;
        this.playerHealth = 0;
        document.getElementById('health-value').textContent = '0';

        // Show death screen
        const deathScreen = document.getElementById('death-screen');
        deathScreen.style.display = 'flex';
        setTimeout(() => { deathScreen.style.opacity = '1'; }, 10);

        // Auto respawn after 3 seconds
        setTimeout(() => this.respawnPlayer(), 3000);
    }

    respawnPlayer() {
        this.playerAlive = true;
        this.playerHealth = 100;
        document.getElementById('health-value').textContent = '100';

        // Reset position
        const cam = this.controls.getObject();
        cam.position.set(0, 1.6, 0);
        this.velocity.set(0, 0, 0);

        // Hide death screen
        const deathScreen = document.getElementById('death-screen');
        deathScreen.style.opacity = '0';
        setTimeout(() => { deathScreen.style.display = 'none'; }, 500);

        // Reload all weapons
        this.reloadAllWeapons();
    }

    setupEventListeners() {
        const startBtn = document.getElementById('start-btn');
        startBtn.addEventListener('click', () => {
            this.controls.lock();
        });

        this.controls.addEventListener('lock', () => {
            document.getElementById('overlay').style.opacity = '0';
            setTimeout(() => { document.getElementById('overlay').style.display = 'none'; }, 500);
        });

        this.controls.addEventListener('unlock', () => {
            document.getElementById('overlay').style.display = 'flex';
            setTimeout(() => { document.getElementById('overlay').style.opacity = '1'; }, 10);
        });

        const onKeyDown = (event) => {
            switch (event.code) {
                case 'KeyW': this.moveForward = true; break;
                case 'KeyS': this.moveBackward = true; break;
                case 'KeyA': this.moveLeft = true; break;
                case 'KeyD': this.moveRight = true; break;
                case 'Space': if (this.canJump) this.velocity.y += CONFIG.JUMP_FORCE; this.canJump = false; break;
                case 'Digit1': this.switchWeapon(1); break;
                case 'Digit2': this.switchWeapon(2); break;
                case 'Digit3': this.switchWeapon(3); break;
                case 'Digit4': this.switchWeapon(4); break;
                case 'KeyR': this.reload(); break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyW': this.moveForward = false; break;
                case 'KeyS': this.moveBackward = false; break;
                case 'KeyA': this.moveLeft = false; break;
                case 'KeyD': this.moveRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click = fire
                this.isFiring = true;
                this.fire();
            }
            if (e.button === 2 && this.currentWeapon === 3) { // Right click = scope (sniper only)
                this.toggleScope();
            }
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isFiring = false;
            }
        });
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    switchWeapon(id) {
        // Unscope if switching away from sniper
        if (this.isScoped) {
            this.toggleScope();
        }
        this.currentWeapon = id;
        this.updateViewmodel();
        this.updateHUD();
    }

    toggleScope() {
        this.isScoped = !this.isScoped;
        const scopeOverlay = document.getElementById('scope-overlay');
        if (this.isScoped) {
            this.camera.fov = this.scopedFOV;
            scopeOverlay.style.display = 'block';
        } else {
            this.camera.fov = this.defaultFOV;
            scopeOverlay.style.display = 'none';
        }
        this.camera.updateProjectionMatrix();
    }

    isPlayerMoving() {
        return this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    }

    fire() {
        if (!this.controls.isLocked || !this.playerAlive || this.isReloading) return;
        const weapon = WEAPONS[this.currentWeapon];
        // Now allows move+shoot, but adds recoil
        const now = Date.now();

        if (now - this.lastFireTime < weapon.fireRate) return;

        // Knife (melee) - no ammo needed
        if (weapon.isMelee) {
            this.lastFireTime = now;
            // Knife swing animation on crosshair
            const crosshair = document.getElementById('crosshair');
            crosshair.classList.add('knife-swing');
            setTimeout(() => crosshair.classList.remove('knife-swing'), 200);

            // Melee raycasting (short range)
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
            raycaster.far = 3; // Knife range: 3 meters

            const intersects = raycaster.intersectObjects(this.targets);
            if (intersects.length > 0) {
                const hit = intersects[0];
                this.createHitEffect(hit.point, weapon.color);
                if (hit.object.userData.isEnemy) {
                    const enemyGroup = hit.object.userData.parentEnemy || hit.object;
                    enemyGroup.userData.health -= weapon.damage;
                    this.hitFlash(hit.object);
                    if (enemyGroup.userData.health <= 0) {
                        this.eliminateEnemy(enemyGroup);
                    }
                }
            }
            return;
        }

        // Guns - need ammo
        if (this.ammoValues[this.currentWeapon].current <= 0) {
            // Auto reload when empty
            this.reload();
            return;
        }

        this.lastFireTime = now;
        if (!weapon.isMelee) {
            this.ammoValues[this.currentWeapon].current--;
            this.recoilAmount += 0.15; // Recoil push back
            this.recoilRecovery = 0;
        }
        this.updateHUD();

        // Muzzle Flash / Feedback
        const crosshair = document.getElementById('crosshair');
        crosshair.classList.add('shooting');
        setTimeout(() => crosshair.classList.remove('shooting'), 50);

        // Raycasting for hits
        const raycaster = new THREE.Raycaster();

        // Add recoil spread to camera direction
        const spreadX = (Math.random() - 0.5) * this.recoilAmount * 0.2;
        const spreadY = (Math.random() - 0.5) * this.recoilAmount * 0.2;

        raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), this.camera);
        raycaster.far = 100;

        // IMPORTANT: Unified target list for raycasting to prevent wall penetration
        const allPhysicalTargets = [...this.targets, ...this.walls];
        const intersects = raycaster.intersectObjects(allPhysicalTargets);

        if (intersects.length > 0) {
            const hit = intersects[0];
            this.createHitEffect(hit.point, weapon.color);

            // Player Tracer (smoke trail)
            this.createTracer(this.camera.position.clone().add(new THREE.Vector3(0.2, -0.2, -0.5).applyQuaternion(this.camera.quaternion)), hit.point, weapon.color);

            // Damage logic: Only if the FIRST thing we hit is an enemy mesh
            if (hit.object.userData.isEnemy) {
                const enemyGroup = hit.object.userData.parentEnemy || hit.object;
                const isHS = hit.object.name === 'head';
                const damage = isHS ? weapon.damage * 2.5 : weapon.damage;

                enemyGroup.userData.health -= damage;
                this.hitFlash(hit.object);

                if (enemyGroup.userData.health <= 0) {
                    this.addKillFeed('INIMIGO', 'VOCÊ', weapon.name, isHS);
                    this.eliminateEnemy(enemyGroup);
                }
            }
        } else {
            // Even if no hit, create a tracer to the far distance
            const direction = new THREE.Vector3(spreadX, spreadY, -1).unproject(this.camera).sub(this.camera.position).normalize();
            this.createTracer(this.camera.position.clone(), this.camera.position.clone().add(direction.multiplyScalar(100)), weapon.color);
        }

        // Automatic fire for SMG
        if (this.isFiring && this.currentWeapon === 2) {
            setTimeout(() => this.fire(), weapon.fireRate);
        }
    }

    hitFlash(hitObject) {
        const originalColor = hitObject.material.color.getHex();
        hitObject.material.emissive.setHex(0xffffff);
        hitObject.material.emissiveIntensity = 1.0;
        setTimeout(() => {
            if (hitObject.material) {
                hitObject.material.emissive.setHex(originalColor === 0x1a1a2e ? 0x000000 : originalColor);
                hitObject.material.emissiveIntensity = originalColor === 0x1a1a2e ? 0 : 0.6;
            }
        }, 100);
    }

    eliminateEnemy(enemyGroup) {
        const isDummy = enemyGroup.userData.isDummy;
        enemyGroup.traverse((child) => {
            if (child.isMesh) {
                this.targets = this.targets.filter(t => t !== child);
            }
        });
        this.scene.remove(enemyGroup);
        this.enemies = this.enemies.filter(e => e !== enemyGroup);
        this.killNotification();
        if (isDummy) {
            // Respawn dummy in training zone
            setTimeout(() => this.createDummy(37 + Math.random() * 10, -10 + Math.random() * 20), 3000);
        } else {
            setTimeout(() => this.createEnemy(), 3000);
        }
    }

    reload() {
        const weapon = WEAPONS[this.currentWeapon];
        if (weapon.isMelee) return; // Can't reload knife
        if (this.isReloading) return;

        const ammo = this.ammoValues[this.currentWeapon];
        if (ammo.current >= weapon.ammo) return; // Already full
        if (ammo.reserve <= 0) return; // No reserve ammo

        this.isReloading = true;

        // Show reload indicator
        const reloadIndicator = document.getElementById('reload-indicator');
        reloadIndicator.style.display = 'block';
        reloadIndicator.style.animation = `reloadSpin ${weapon.reloadTime}ms linear`;

        setTimeout(() => {
            const needed = weapon.ammo - ammo.current;
            const available = Math.min(needed, ammo.reserve);
            ammo.current += available;
            ammo.reserve -= available;
            this.isReloading = false;
            reloadIndicator.style.display = 'none';
            reloadIndicator.style.animation = '';
            this.updateHUD();
        }, weapon.reloadTime);
    }

    reloadAllWeapons() {
        for (let id = 1; id <= 3; id++) {
            const weapon = WEAPONS[id];
            this.ammoValues[id].current = weapon.ammo;
            this.ammoValues[id].reserve = weapon.reserve;
        }
        this.updateHUD();
    }

    createHitEffect(point, color) {
        const geo = new THREE.SphereGeometry(0.1);
        const mat = new THREE.MeshBasicMaterial({ color });
        const spark = new THREE.Mesh(geo, mat);
        spark.position.copy(point);
        this.scene.add(spark);
        setTimeout(() => this.scene.remove(spark), 200);
    }

    createTracer(start, end, color) {
        const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
        const points = [];
        points.push(start);
        points.push(end);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        setTimeout(() => {
            material.opacity -= 0.1;
            if (material.opacity <= 0) this.scene.remove(line);
            else setTimeout(() => this.scene.remove(line), 50);
        }, 50);
    }

    addKillFeed(victim, killer, weapon, isHS) {
        const feed = document.getElementById('kill-feed');
        const item = document.createElement('div');
        item.className = 'kill-item';

        let content = `<b>${killer}</b> [${weapon}] <b>${victim}</b>`;
        if (isHS) {
            content += ' <span class="hs-text">HS</span>';
        }

        item.innerHTML = content;
        feed.appendChild(item);

        setTimeout(() => {
            item.style.opacity = '0';
            setTimeout(() => item.remove(), 500);
        }, 5000);
    }

    killNotification() {
        const feed = document.getElementById('kill-feed');
        const kill = document.createElement('div');
        kill.className = 'kill-item';
        kill.style.color = '#ff0055';
        kill.textContent = 'ELIMINAÇÃO +100';
        feed.appendChild(kill);
        setTimeout(() => kill.remove(), 2000);
    }

    updateHUD() {
        const weapon = WEAPONS[this.currentWeapon];
        const ammo = this.ammoValues[this.currentWeapon];

        document.getElementById('weapon-name').textContent = weapon.name;
        if (weapon.isMelee) {
            document.getElementById('ammo-clip').textContent = '∞';
            document.getElementById('ammo-reserve').textContent = '—';
        } else {
            document.getElementById('ammo-clip').textContent = ammo.current;
            document.getElementById('ammo-reserve').textContent = ammo.reserve;
        }
        document.getElementById('weapon-info').style.borderRightColor = `#${weapon.color.toString(16).padStart(6, '0')}`;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = performance.now();
        const delta = Math.min((time - (this.prevTime || time)) / 1000, 0.1);

        // Always update enemies (they move even when menu is open)
        this.updateEnemies(delta);

        if (this.controls.isLocked && this.playerAlive) {
            // Recoil Recovery
            this.recoilAmount *= 0.9; // Fast fade

            // Speed multiplier for knife
            const weapon = WEAPONS[this.currentWeapon];
            const speedMult = weapon.speedMultiplier || 1.0;
            const moveSpeed = 80.0 * speedMult;

            // Simple Axis-Aligned Bounding Box (AABB) Collision for player
            const prevPos = this.controls.getObject().position.clone();

            this.velocity.x -= this.velocity.x * 10.0 * delta;
            this.velocity.z -= this.velocity.z * 10.0 * delta;
            this.velocity.y += CONFIG.GRAVITY * delta;

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();

            if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * moveSpeed * delta;
            if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * moveSpeed * delta;

            // Apply movement
            this.controls.moveRight(-this.velocity.x * delta);
            this.controls.moveForward(-this.velocity.z * delta);

            // Collision Detection with Walls
            const playerPos = this.controls.getObject().position;
            const playerBox = new THREE.Box3().setFromCenterAndSize(
                playerPos,
                new THREE.Vector3(1.0, 2.0, 1.0) // Slightly smaller collision
            );

            for (const wall of this.walls) {
                const wallBox = new THREE.Box3().setFromObject(wall);
                if (playerBox.intersectsBox(wallBox)) {
                    // Step up logic for stairs: if collision is low, move player up
                    const wallMaxY = wallBox.max.y;
                    const feetY = playerPos.y - 1.6;
                    const diff = wallMaxY - feetY;

                    if (diff > 0 && diff < 0.6) { // Can step up to 0.6m
                        playerPos.y = wallMaxY + 1.6;
                        this.velocity.y = 0;
                        this.canJump = true;
                    } else {
                        playerPos.x = prevPos.x;
                        playerPos.z = prevPos.z;
                        this.velocity.x = 0;
                        this.velocity.z = 0;
                    }
                    break;
                }
            }

            this.controls.getObject().position.y += (this.velocity.y * delta);

            if (this.controls.getObject().position.y < 1.6) {
                this.velocity.y = 0;
                this.controls.getObject().position.y = 1.6;
                this.canJump = true;
            }
            // Ceiling collision
            if (this.controls.getObject().position.y > 18.5) {
                this.velocity.y = 0;
                this.controls.getObject().position.y = 18.5;
            }

            // Weapon Bobbing & Recoil Animation
            if (this.weaponGroup) {
                // Bobbing when moving
                if (this.isPlayerMoving()) {
                    this.weaponBobTime += delta * 12;
                    this.weaponGroup.position.y = Math.sin(this.weaponBobTime) * 0.01;
                    this.weaponGroup.position.x = Math.cos(this.weaponBobTime * 0.5) * 0.01;
                } else {
                    this.weaponGroup.position.y *= 0.9;
                    this.weaponGroup.position.x *= 0.9;
                }

                // Recoil animation (kick back)
                this.weaponGroup.position.z = this.recoilAmount * 0.5;
                this.weaponGroup.rotation.x = -this.recoilAmount * 0.2;
            }
        }

        this.prevTime = time;
        this.renderer.render(this.scene, this.camera);
    }
}

// Start Game
window.onload = () => {
    new Game();
};
