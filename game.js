const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score-val');
const enemyEl = document.getElementById('enemy-count');
const startScreen = document.getElementById('start-screen');
const endScreen = document.getElementById('end-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const endTitle = document.getElementById('end-title');
const finalScoreEl = document.getElementById('final-score');

// Constants
const TILE_SIZE = 40;
const GRID_SIZE = 13;
const CANVAS_SIZE = TILE_SIZE * GRID_SIZE;

// Game State
let gameState = 'START';
let score = 0;
let enemiesDefeated = 0;
let player;
let enemies = [];
let bullets = [];
let map = [];

// Map Codes: 0-Empty, 1-Brick, 2-Steel, 9-Base
const INITIAL_MAP = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,2,2,2,0,1,0,1,0],
    [0,1,0,1,0,0,0,0,0,1,0,1,0],
    [0,0,0,0,0,1,1,1,0,0,0,0,0],
    [2,0,2,2,0,1,0,1,0,2,2,0,2],
    [0,0,0,0,0,1,1,1,0,0,0,0,0],
    [0,1,0,1,0,0,0,0,0,1,0,1,0],
    [0,1,0,1,0,2,2,2,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,0,0,0,0,1,9,1,0,0,0,0,0]
];

class Bullet {
    constructor(x, y, dir, owner) {
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.owner = owner;
        this.speed = 5;
        this.size = 6;
        this.active = true;
    }

    update() {
        if (this.dir === 'UP') this.y -= this.speed;
        if (this.dir === 'DOWN') this.y += this.speed;
        if (this.dir === 'LEFT') this.x -= this.speed;
        if (this.dir === 'RIGHT') this.x += this.speed;

        // Wall collision
        if (this.x < 0 || this.x > CANVAS_SIZE || this.y < 0 || this.y > CANVAS_SIZE) {
            this.active = false;
            return;
        }

        const gridX = Math.floor(this.x / TILE_SIZE);
        const gridY = Math.floor(this.y / TILE_SIZE);

        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
            const tile = map[gridY][gridX];
            if (tile === 1) { // Brick
                map[gridY][gridX] = 0;
                this.active = false;
            } else if (tile === 2) { // Steel
                this.active = false;
            } else if (tile === 9) { // Base
                gameOver(false);
                this.active = false;
            }
        }

        // Tank collision
        if (this.owner === 'enemy') {
            if (checkCollision(this, player)) {
                gameOver(false);
                this.active = false;
            }
        } else {
            enemies.forEach(enemy => {
                if (checkCollision(this, enemy)) {
                    enemy.hp--;
                    this.active = false;
                    if (enemy.hp <= 0) {
                        score += 100;
                        enemiesDefeated++;
                        scoreEl.innerText = score;
                    }
                }
            });
            enemies = enemies.filter(e => e.hp > 0);
            enemyEl.innerText = enemies.length;
            if (enemies.length === 0 && enemiesDefeated >= 5) {
                gameOver(true);
            }
        }
    }

    draw() {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Tank {
    constructor(x, y, dir, type) {
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.type = type;
        this.speed = type === 'player' ? 3 : 2;
        this.size = TILE_SIZE - 4;
        this.hp = 1;
        this.lastShot = 0;
        this.shootDelay = 1000;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + TILE_SIZE/2, this.y + TILE_SIZE/2);
        if (this.dir === 'DOWN') ctx.rotate(Math.PI);
        if (this.dir === 'LEFT') ctx.rotate(-Math.PI/2);
        if (this.dir === 'RIGHT') ctx.rotate(Math.PI/2);

        // Body
        ctx.fillStyle = this.type === 'player' ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        
        // Barrel
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(-4, -this.size/2 - 10, 8, 15);
        
        ctx.restore();
    }

    move(newDir) {
        this.dir = newDir;
        let nextX = this.x;
        let nextY = this.y;

        if (this.dir === 'UP') nextY -= this.speed;
        if (this.dir === 'DOWN') nextY += this.speed;
        if (this.dir === 'LEFT') nextX -= this.speed;
        if (this.dir === 'RIGHT') nextX += this.speed;

        // Boundary check
        if (nextX < 0 || nextX + TILE_SIZE > CANVAS_SIZE || nextY < 0 || nextY + TILE_SIZE > CANVAS_SIZE) return;

        // Map collision
        if (!this.checkMapCollision(nextX, nextY)) {
            this.x = nextX;
            this.y = nextY;
        }
    }

    checkMapCollision(nx, ny) {
        const padding = 4;
        const points = [
            {x: nx + padding, y: ny + padding},
            {x: nx + TILE_SIZE - padding, y: ny + padding},
            {x: nx + padding, y: ny + TILE_SIZE - padding},
            {x: nx + TILE_SIZE - padding, y: ny + TILE_SIZE - padding}
        ];

        for (let p of points) {
            const gx = Math.floor(p.x / TILE_SIZE);
            const gy = Math.floor(p.y / TILE_SIZE);
            if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
                if (map[gy][gx] !== 0) return true;
            }
        }
        return false;
    }

    shoot() {
        const now = Date.now();
        if (now - this.lastShot > this.shootDelay) {
            let bx = this.x + TILE_SIZE/2;
            let by = this.y + TILE_SIZE/2;
            bullets.push(new Bullet(bx, by, this.dir, this.type));
            this.lastShot = now;
        }
    }
}

function checkCollision(bullet, tank) {
    return bullet.x > tank.x && bullet.x < tank.x + TILE_SIZE &&
           bullet.y > tank.y && bullet.y < tank.y + TILE_SIZE;
}

const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

function init() {
    score = 0;
    enemiesDefeated = 0;
    scoreEl.innerText = score;
    map = INITIAL_MAP.map(row => [...row]);
    player = new Tank(160, 480, 'UP', 'player');
    enemies = [];
    bullets = [];
    spawnEnemies(3);
    enemyEl.innerText = enemies.length;
}

function spawnEnemies(count) {
    const spawnPoints = [{x: 0, y: 0}, {x: 240, y: 0}, {x: 480, y: 0}];
    for (let i = 0; i < count; i++) {
        const sp = spawnPoints[i % spawnPoints.length];
        enemies.push(new Tank(sp.x, sp.y, 'DOWN', 'enemy'));
    }
}

function update() {
    if (gameState !== 'PLAYING') return;

    // Player move
    if (keys['ArrowUp'] || keys['KeyW']) player.move('UP');
    else if (keys['ArrowDown'] || keys['KeyS']) player.move('DOWN');
    else if (keys['ArrowLeft'] || keys['KeyA']) player.move('LEFT');
    else if (keys['ArrowRight'] || keys['KeyD']) player.move('RIGHT');

    if (keys['Space']) player.shoot();

    // Enemy AI
    enemies.forEach(enemy => {
        if (Math.random() < 0.02) {
            const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
            enemy.nextDir = dirs[Math.floor(Math.random() * dirs.length)];
        }
        enemy.move(enemy.nextDir || 'DOWN');
        if (Math.random() < 0.01) enemy.shoot();
    });

    // Bullets update
    bullets.forEach(b => b.update());
    bullets = bullets.filter(b => b.active);

    // Spawn more enemies if needed
    if (enemies.length < 3 && (enemiesDefeated + enemies.length) < 10) {
        if (Math.random() < 0.005) spawnEnemies(1);
    }
}

function draw() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Map
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const tile = map[y][x];
            if (tile === 1) {
                ctx.fillStyle = '#a0522d'; // Brick
                ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.strokeStyle = '#5d2906';
                ctx.strokeRect(x * TILE_SIZE + 5, y * TILE_SIZE + 5, TILE_SIZE - 10, TILE_SIZE - 10);
            } else if (tile === 2) {
                ctx.fillStyle = '#7f8c8d'; // Steel
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#bdc3c7';
                ctx.strokeRect(x * TILE_SIZE + 4, y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            } else if (tile === 9) {
                ctx.fillStyle = '#f1c40f'; // Base
                ctx.beginPath();
                ctx.moveTo(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + 5);
                ctx.lineTo(x * TILE_SIZE + 5, y * TILE_SIZE + TILE_SIZE - 5);
                ctx.lineTo(x * TILE_SIZE + TILE_SIZE - 5, y * TILE_SIZE + TILE_SIZE - 5);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    player.draw();
    enemies.forEach(e => e.draw());
    bullets.forEach(b => b.draw());
}

function gameLoop() {
    update();
    draw();
    if (gameState === 'PLAYING') requestAnimationFrame(gameLoop);
}

function gameOver(win) {
    gameState = 'END';
    endScreen.classList.remove('hidden');
    endTitle.innerText = win ? 'MISSION ACCOMPLISHED' : 'BASE DESTROYED';
    endTitle.style.color = win ? '#2ecc71' : '#e74c3c';
    finalScoreEl.innerText = score;
}

startBtn.onclick = () => {
    startScreen.classList.add('hidden');
    gameState = 'PLAYING';
    init();
    gameLoop();
};

restartBtn.onclick = () => {
    endScreen.classList.add('hidden');
    gameState = 'PLAYING';
    init();
    gameLoop();
};
