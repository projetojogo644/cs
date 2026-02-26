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
    1: { name: 'PISTOLA', ammo: 12, reserve: 36, fireRate: 400, damage: 25, color: 0x00f2ff },
    2: { name: 'SMG', ammo: 30, reserve: 90, fireRate: 100, damage: 15, color: 0x7000ff },
    3: { name: 'SNIPER', ammo: 5, reserve: 15, fireRate: 1500, damage: 100, color: 0xff0055 }
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
        this.ammoValues = {
            1: { current: 12, reserve: 36 },
            2: { current: 30, reserve: 90 },
            3: { current: 5, reserve: 15 }
        };

        this.targets = [];
        this.bullets = [];

        this.init();
    }

    init() {
        this.setupLights();
        this.setupArena();
        this.setupEventListeners();
        this.animate();
        this.updateHUD();
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

        // Targets
        for(let i = 0; i < 8; i++) {
            this.createTarget();
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
    }

    createObstacle(x, y, z, w, h, d, color = 0x333333) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({ color });
        const obs = new THREE.Mesh(geo, mat);
        obs.position.set(x, y, z);
        obs.castShadow = true;
        obs.receiveShadow = true;
        this.scene.add(obs);
        this.targets.push(obs); // Obstacles also block shots
    }

    createTarget() {
        const geo = new THREE.BoxGeometry(1.5, 2, 0.5);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xff0055, emissiveIntensity: 0.5 });
        const target = new THREE.Mesh(geo, mat);
        
        target.position.x = (Math.random() - 0.5) * 80;
        target.position.y = 1;
        target.position.z = (Math.random() - 0.5) * 80;
        
        target.userData.isEnemy = true;
        target.userData.health = 100;
        
        this.scene.add(target);
        this.targets.push(target);
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
        document.addEventListener('mousedown', () => { this.isFiring = true; this.fire(); });
        document.addEventListener('mouseup', () => { this.isFiring = false; });
        
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    switchWeapon(id) {
        this.currentWeapon = id;
        this.updateHUD();
    }

    fire() {
        if (!this.controls.isLocked) return;
        
        const now = Date.now();
        const weapon = WEAPONS[this.currentWeapon];
        
        if (now - this.lastFireTime < weapon.fireRate) return;
        if (this.ammoValues[this.currentWeapon].current <= 0) {
            // Out of ammo sound/feedback
            return;
        }

        this.lastFireTime = now;
        this.ammoValues[this.currentWeapon].current--;
        this.updateHUD();

        // Muzzle Flash / Feedback
        const crosshair = document.getElementById('crosshair');
        crosshair.classList.add('shooting');
        setTimeout(() => crosshair.classList.remove('shooting'), 50);

        // Raycasting for hits
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

        const intersects = raycaster.intersectObjects(this.targets);

        if (intersects.length > 0) {
            const hit = intersects[0];
            this.createHitEffect(hit.point, weapon.color);
            
            if (hit.object.userData.isEnemy) {
                hit.object.userData.health -= weapon.damage;
                if (hit.object.userData.health <= 0) {
                    this.scene.remove(hit.object);
                    this.targets = this.targets.filter(t => t !== hit.object);
                    this.killNotification();
                    setTimeout(() => this.createTarget(), 3000);
                }
            }
        }

        // Automatic fire for SMG
        if (this.isFiring && this.currentWeapon === 2) {
            setTimeout(() => this.fire(), weapon.fireRate);
        }
    }

    createHitEffect(point, color) {
        const geo = new THREE.SphereGeometry(0.1);
        const mat = new THREE.MeshBasicMaterial({ color });
        const spark = new THREE.Mesh(geo, mat);
        spark.position.copy(point);
        this.scene.add(spark);
        setTimeout(() => this.scene.remove(spark), 200);
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
        document.getElementById('ammo-clip').textContent = ammo.current;
        document.getElementById('ammo-reserve').textContent = ammo.reserve;
        document.getElementById('weapon-info').style.borderRightColor = `#${weapon.color.toString(16).padStart(6, '0')}`;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.controls.isLocked) {
            const time = performance.now();
            const delta = (time - this.prevTime) / 1000;

            this.velocity.x -= this.velocity.x * 10.0 * delta;
            this.velocity.z -= this.velocity.z * 10.0 * delta;
            this.velocity.y += CONFIG.GRAVITY * delta;

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();

            if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * 80.0 * delta;
            if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * 80.0 * delta;

            this.controls.moveRight(-this.velocity.x * delta);
            this.controls.moveForward(-this.velocity.z * delta);

            this.controls.getObject().position.y += (this.velocity.y * delta);

            if (this.controls.getObject().position.y < 1.6) {
                this.velocity.y = 0;
                this.controls.getObject().position.y = 1.6;
                this.canJump = true;
            }

            this.prevTime = time;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Start Game
window.onload = () => {
    new Game();
};
