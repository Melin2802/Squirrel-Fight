// =============================================================================
// Squirrel Fight - lógica do jogo
// -----------------------------------------------------------------------------
// Tudo é desenhado num único <canvas> com coordenadas "lógicas" de 200x200
// (a proporção pedida no Script.txt). O canvas é ampliado para caber na janela
// e o que sobrar vira borda.
//
// Os sprites vêm da pasta assets/ (gerada por tools/build_assets.py a partir
// dos GIFs originais). SPRITE_META (assets/sprites.js) diz o tamanho e a
// quantidade de quadros de cada folha de sprites.
// =============================================================================

const W = 200;
const H = 200;

// ----------------------------------------------------------------- regras ---
const ROUND_TIME = 90;          // 1:30 por rodada
const CROWNS_TO_WIN = 3;        // quem fizer 3 coroas primeiro vence
const TALK_DURATION = 10;       // cada fala do tutorial dura 10 s
const COUNTDOWN_TIME = 3;       // contagem regressiva de 3 s
const NUT_SPAWN_INTERVAL = 5;   // nozes nascem a cada 5 s...
const NUT_SPAWN_COUNT = 2;      // ...de 2 em 2
const GOLDEN_CHANCE = 0.3;      // 30% douradas
const MAX_NUTS = 16;            // limite de nozes na tela ao mesmo tempo
const ROUND_END_TIME = 5;       // tempo mostrando vencedor da rodada

// ----------------------------------------------------------------- física ---
const GRAVITY = 520;            // px lógicos / s²
const JUMP_SPEED = 215;         // pulo de ~44 px de altura
const WALK_SPEED = 75;          // px lógicos / s

// Plataformas (medidas no SpritePlataforma.gif, que tem 200x200).
// São "de mão única": dá para pular por baixo delas, mas não atravessar caindo.
const GROUND_Y = 173;
const PLATFORMS = [
    { x: 0,   y: 33,  w: 66,  h: 18 },
    { x: 161, y: 33,  w: 39,  h: 18 },
    { x: 96,  y: 51,  w: 104, h: 18 },
    { x: 47,  y: 86,  w: 66,  h: 18 },
    { x: 0,   y: 104, w: 26,  h: 18 },
    { x: 136, y: 105, w: 64,  h: 18 },
    { x: 0,   y: 122, w: 66,  h: 18 },
    { x: 82,  y: 135, w: 39,  h: 18 },
    { x: 133, y: 155, w: 67,  h: 18 },
    { x: 0,   y: GROUND_Y, w: 200, h: 27, ground: true },
];

const TALKS = [
    "Olá, jogadores! Sejam bem-vindos ao meu mundo, onde o tempo é precioso e cada escolha faz a diferença!",
    "O Player 1 irá se movimentar usando as teclas W, A, S e D, enquanto o Player 2 utilizará as teclas direcionais do teclado.",
    "O objetivo de vocês é coletar o máximo de nozes possível em 1 minuto e 30 segundos! Para isso, pulem sobre as plataformas, explorem o cenário e peguem todas as nozes que conseguirem!",
    "A cada rodada vencida, o jogador ganha uma coroa. Quem conseguir conquistar 3 coroas primeiro será o grande campeão!",
    "Preparem-se, jogadores! Usem suas habilidades, sejam rápidos e estratégicos, porque cada noz pode fazer a diferença!",
    "Que comece a competição! Quem será o rei ou a rainha das nozes?",
];

const STATE = {
    COVER: "cover",
    MENU: "menu",
    MENU_CONFIG: "menu_config",
    TUTORIAL: "tutorial",
    COUNTDOWN: "countdown",
    PLAYING: "playing",
    ROUND_END: "round_end",
    GAME_OVER: "game_over",
    EXITED: "exited",
};

// ============================================================ carregamento ===
const images = {};
const coverImage = new Image();

function loadImage(img, src) {
    return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = () => {
            console.error("Não foi possível carregar a imagem:", src);
            resolve();
        };
        img.src = encodeURI(src);
    });
}

function loadAllImages() {
    const jobs = Object.keys(SPRITE_META).map((name) => {
        images[name] = new Image();
        return loadImage(images[name], "assets/" + name + ".png");
    });
    jobs.push(loadImage(coverImage, "Cenários/Capa -  Squirrel Fight.png"));
    return Promise.all(jobs);
}

// ================================================================== sprites ==
// Desenha o quadro `frame` da folha `name` no retângulo (dx, dy, dw, dh).
function drawSprite(name, frame, dx, dy, dw, dh, flip = false) {
    const meta = SPRITE_META[name];
    const img = images[name];
    if (!meta || !img || !img.complete || !img.naturalWidth) return;
    const f = ((frame % meta.frames) + meta.frames) % meta.frames;
    if (dw === undefined) { dw = meta.w / 8; dh = meta.h / 8; }
    ctx.save();
    if (flip) {
        ctx.translate(dx + dw, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, f * meta.w, 0, meta.w, meta.h, 0, 0, dw, dh);
    } else {
        ctx.drawImage(img, f * meta.w, 0, meta.w, meta.h, dx, dy, dw, dh);
    }
    ctx.restore();
}

// Qual quadro de uma animação mostrar depois de `ms` milissegundos.
function frameAt(name, ms, loop = true) {
    const meta = SPRITE_META[name];
    const total = meta.delays.reduce((a, b) => a + b, 0);
    if (!loop && ms >= total) return meta.frames - 1;
    let t = ms % total;
    for (let i = 0; i < meta.delays.length; i++) {
        if (t < meta.delays[i]) return i;
        t -= meta.delays[i];
    }
    return 0;
}

// Números com o SpriteDosNumeros (cada dígito tem 72px + 8px de espaço).
const DIGIT_SRC_W = 72;
const DIGIT_SRC_STRIDE = 80;

function drawNumber(text, cx, cy, size) {
    text = String(text);
    const gap = size * 0.15;
    const colonW = size * 0.45;
    let width = 0;
    for (const ch of text) width += (ch === ":" ? colonW : size) + gap;
    width -= gap;
    let x = cx - width / 2;
    const y = cy - size / 2;
    const img = images.digits;
    const meta = SPRITE_META.digits;
    for (const ch of text) {
        if (ch === ":") {
            ctx.fillStyle = "#5a2e0e";
            const d = size * 0.2;
            ctx.fillRect(x + (colonW - d) / 2, y + size * 0.22, d, d);
            ctx.fillRect(x + (colonW - d) / 2, y + size * 0.62, d, d);
            x += colonW + gap;
        } else {
            const n = ch.charCodeAt(0) - 48;
            if (img && img.complete && n >= 0 && n <= 9) {
                ctx.drawImage(img, n * DIGIT_SRC_STRIDE, 0, DIGIT_SRC_W, meta.h, x, y, size, size);
            }
            x += size + gap;
        }
    }
}

function drawText(text, x, y, size, color = "#fff", align = "center") {
    ctx.font = `bold ${size}px "Trebuchet MS", Verdana, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.3;
    ctx.strokeStyle = "#3b1d0a";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

// ==================================================================== sons ===
const settings = { sfx: 1, music: 0.6 };
try {
    const saved = JSON.parse(localStorage.getItem("squirrelFightSettings") || "null");
    if (saved) Object.assign(settings, saved);
} catch (e) { /* sem localStorage: usa o padrão */ }

function saveSettings() {
    try { localStorage.setItem("squirrelFightSettings", JSON.stringify(settings)); } catch (e) { /* ignora */ }
}

function makeAudio(src, loop = false) {
    const a = new Audio(encodeURI(src));
    a.loop = loop;
    a.preload = "auto";
    return a;
}

const music = {
    initial: makeAudio("Sons/MúsicaInicial.mp3", true),
    play: makeAudio("Sons/MúsicaInicialPlay.mp3", true),
};

const sfx = {
    talk: makeAudio("Sons/SomFalaDoEsquilo.wav"),
    jump: makeAudio("Sons/SomDoPulo.mp3"),
    nut: makeAudio("Sons/SomColetarNozComum.mp3"),
    golden: makeAudio("Sons/SomColetarNo Dourada.mp3"),
    countdown: makeAudio("Sons/SomContagemRegressiva.mp3"),
    gameOver: makeAudio("Sons/SomFimDoJogo.mp3"),
};

let currentMusic = null;
let audioUnlocked = false; // navegadores só tocam som depois de um clique/tecla

function playMusic(name) {
    const next = music[name];
    if (currentMusic && currentMusic !== next) currentMusic.pause();
    if (currentMusic !== next) next.currentTime = 0;
    currentMusic = next;
    next.volume = settings.music;
    if (audioUnlocked) next.play().catch(() => {});
}

function stopMusic() {
    if (currentMusic) currentMusic.pause();
    currentMusic = null;
}

function playSfx(name) {
    if (!audioUnlocked || settings.sfx <= 0) return;
    // cloneNode permite o mesmo som tocar sobreposto (ex.: duas nozes juntas)
    const a = sfx[name].cloneNode();
    a.volume = settings.sfx;
    a.play().catch(() => {});
    return a;
}

let talkAudio = null;
function playTalk() {
    if (talkAudio) talkAudio.pause();
    talkAudio = playSfx("talk");
}

function applyVolumes() {
    if (currentMusic) currentMusic.volume = settings.music;
    saveSettings();
}

// ================================================================= jogador ===
class Squirrel {
    constructor(id, controls) {
        this.id = id;                 // 1 = Esquilo1, 2 = Esquilo2
        this.controls = controls;     // { left, right, jump, down }
        this.w = 12;                  // caixa de colisão
        this.h = 16;
        this.reset();
    }

    reset() {
        // Esquilo1 começa à direita (contador no canto inferior direito),
        // Esquilo2 à esquerda.
        this.x = this.id === 1 ? 160 : 28;
        this.y = GROUND_Y - this.h;
        this.vx = 0;
        this.vy = 0;
        this.onGround = true;
        this.facing = this.id === 1 ? -1 : 1;
        this.dropTimer = 0;
        this.anim = "Idle";
        this.animTime = 0;
        this.score = 0;
        this.result = null;           // "win" | "lose" | null
    }

    setAnim(anim) {
        if (this.anim !== anim) {
            this.anim = anim;
            this.animTime = 0;
        }
    }

    update(dt) {
        this.animTime += dt * 1000;
        if (this.result) {
            this.setAnim(this.result === "win" ? "Win" : "Lose");
            return;
        }

        const c = this.controls;
        if (keys[c.left] && !keys[c.right]) {
            this.vx = -WALK_SPEED;
            this.facing = -1;
        } else if (keys[c.right] && !keys[c.left]) {
            this.vx = WALK_SPEED;
            this.facing = 1;
        } else {
            this.vx = 0;
        }

        if (pressed[c.jump] && this.onGround) {
            this.vy = -JUMP_SPEED;
            this.onGround = false;
            playSfx("jump");
        }
        // S / ↓ desce da plataforma (menos do chão)
        if (pressed[c.down] && this.onGround && this.y + this.h < GROUND_Y - 1) {
            this.dropTimer = 0.2;
            this.onGround = false;
        }
        if (this.dropTimer > 0) this.dropTimer -= dt;

        // movimento horizontal (paredes = bordas da tela)
        this.x = Math.max(0, Math.min(W - this.w, this.x + this.vx * dt));

        // movimento vertical + aterrissagem nas plataformas
        const prevBottom = this.y + this.h;
        this.vy += GRAVITY * dt;
        this.y += this.vy * dt;
        const bottom = this.y + this.h;
        this.onGround = false;

        if (this.vy >= 0) {
            let landing = null;
            for (const p of PLATFORMS) {
                if (this.dropTimer > 0 && !p.ground) continue;
                const overlapX = this.x + this.w - 3 > p.x && this.x + 3 < p.x + p.w;
                if (overlapX && prevBottom <= p.y + 0.5 && bottom >= p.y) {
                    if (!landing || p.y < landing.y) landing = p;
                }
            }
            if (landing) {
                this.y = landing.y - this.h;
                this.vy = 0;
                this.onGround = true;
            }
        }
        if (this.y + this.h > GROUND_Y) { // segurança: nunca cai abaixo do chão
            this.y = GROUND_Y - this.h;
            this.vy = 0;
            this.onGround = true;
        }

        if (!this.onGround) this.setAnim("Jump");
        else if (this.vx !== 0) this.setAnim("Walk");
        else this.setAnim("Idle");
    }

    draw() {
        const name = "p" + this.id + this.anim;
        const meta = SPRITE_META[name];
        const loop = this.anim !== "Lose" && this.anim !== "Jump";
        const frame = frameAt(name, this.animTime, loop);
        const dw = meta.w / 8;
        const dh = meta.h / 8;
        // os desenhos olham para a direita; espelha quando anda para a esquerda
        const cx = this.x + this.w / 2;
        drawSprite(name, frame, cx - dw / 2, this.y + this.h + 2 - dh, dw, dh, this.facing < 0);

        if (this.result) {
            const sash = this.result === "win" ? "sashWin" : "sashLose";
            const sw = 34, sh = 13.6;
            const bob = Math.sin(performance.now() / 200) * 1;
            const headY = this.result === "win" ? this.y - 6 : this.y + 2; // o perdedor fica deitado
            drawSprite(sash, frameAt(sash, performance.now()), cx - sw / 2, headY - sh + bob, sw, sh);
        }
    }
}

// ==================================================================== nozes ==
class Nut {
    constructor(x, y, golden) {
        this.x = x;
        this.y = y;
        this.w = 8;
        this.h = 11;
        this.golden = golden;
        this.value = golden ? 3 : 1;
        this.t = Math.random() * 1000;
    }

    draw(dt) {
        this.t += dt * 1000;
        const name = this.golden ? "nutGolden" : "nutCommon";
        drawSprite(name, frameAt(name, this.t), this.x, this.y, this.w, this.h);
    }
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Áreas da tela ocupadas pelo placar/contadores (nozes não nascem atrás delas)
const HUD_AREAS = [
    { x: 78, y: 0, w: 44, h: 26 },
    { x: 0, y: 168, w: 54, h: 32 },
    { x: 146, y: 168, w: 54, h: 32 },
];

function spawnNut() {
    for (let tries = 0; tries < 40; tries++) {
        // escolhe uma plataforma e põe a noz em cima dela ou no ar, a uma
        // altura que o esquilo alcança pulando
        const p = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
        const nut = new Nut(0, 0, Math.random() < GOLDEN_CHANCE);
        nut.x = p.x + 2 + Math.random() * (p.w - nut.w - 4);
        nut.y = p.y - nut.h - 1 - Math.random() * 30;
        const r = { x: nut.x, y: nut.y, w: nut.w, h: nut.h };
        if (r.y < 2 || r.x < 1 || r.x + r.w > W - 1) continue;
        if (PLATFORMS.some((q) => rectsOverlap(r, q))) continue;
        if (HUD_AREAS.some((q) => rectsOverlap(r, q))) continue;
        if (game.nuts.some((n) => rectsOverlap(r, { x: n.x - 2, y: n.y - 2, w: n.w + 4, h: n.h + 4 }))) continue;
        game.nuts.push(nut);
        return;
    }
}

// ================================================================= entrada ===
const keys = {};     // teclas seguradas
const pressed = {};  // teclas apertadas neste quadro

const GAME_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];

window.addEventListener("keydown", (e) => {
    unlockAudio();
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;

    if (e.code === "Escape" && (game.state === STATE.PLAYING || game.state === STATE.COUNTDOWN)) {
        game.paused = !game.paused;
    }
    // Espaço/Enter passam a fala do tutorial
    if ((e.code === "Space" || e.code === "Enter") && game.state === STATE.TUTORIAL) nextTalk();
    if (game.state === STATE.COVER) goToMenu();
});

window.addEventListener("keyup", (e) => { keys[e.code] = false; });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    if (currentMusic) currentMusic.play().catch(() => {});
}

// ================================================================== botões ===
// Cada tela devolve sua lista de botões; a mesma lista é usada para desenhar e
// para saber em qual botão o mouse clicou.
const MENU_BTN = { w: 36, h: 24 };
const CONFIG_PANEL = { x: 40, y: 58, w: 121, h: 108 };

function configButtons(inGame) {
    const px = CONFIG_PANEL.x, py = CONFIG_PANEL.y;
    const list = [
        { x: px + 13, y: py + 35, w: 15, h: 12, onClick: () => { settings.sfx = settings.sfx > 0 ? settings.sfx : 1; applyVolumes(); playSfx("nut"); } },
        { x: px + 29, y: py + 36, w: 32, h: 8, slider: "sfx" },
        { x: px + 62, y: py + 35, w: 15, h: 12, onClick: () => { settings.sfx = 0; applyVolumes(); } },
        { x: px + 13, y: py + 56, w: 15, h: 12, onClick: () => { settings.music = settings.music > 0 ? settings.music : 0.6; applyVolumes(); } },
        { x: px + 29, y: py + 58, w: 32, h: 8, slider: "music" },
        { x: px + 62, y: py + 56, w: 15, h: 12, onClick: () => { settings.music = 0; applyVolumes(); } },
        // seta: no menu volta para a tela inicial; no jogo despausa
        { x: px + 8, y: py + 84, w: 25, h: 17, onClick: () => {
            if (inGame) game.paused = false;
            else game.state = STATE.MENU;
        } },
    ];
    if (inGame) {
        // EXIT: volta para a tela inicial
        list.push({ x: px + 89, y: py + 84, w: 25, h: 17, onClick: () => goToMenu() });
    }
    return list;
}

function currentButtons() {
    if (game.paused) return configButtons(true);
    switch (game.state) {
        case STATE.MENU: {
            const x = W / 2 - MENU_BTN.w / 2;
            return [
                { sprite: "btnPlay", x, y: 71, ...MENU_BTN, onClick: startTutorial },
                { sprite: "btnExit", x, y: 101, ...MENU_BTN, onClick: exitGame },
                { sprite: "btnConf", x, y: 131, ...MENU_BTN, onClick: () => { game.state = STATE.MENU_CONFIG; } },
            ];
        }
        case STATE.MENU_CONFIG:
            return configButtons(false);
        case STATE.COUNTDOWN:
        case STATE.PLAYING:
        case STATE.ROUND_END:
            // botão de configuração no meio da parte de baixo da tela
            return [{ sprite: "btnConf", x: 88, y: 182, w: 24, h: 16, onClick: () => { game.paused = true; } }];
        case STATE.GAME_OVER:
            return [{ sprite: "btnMenu", x: W / 2 - 18, y: 120, w: 36, h: 24, onClick: goToMenu }];
        default:
            return [];
    }
}

const mouse = { x: -1, y: -1, down: false, slider: null };

function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}

function hit(b, p) {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

function setSlider(name, x, b) {
    settings[name] = Math.max(0, Math.min(1, (x - b.x) / b.w));
    applyVolumes();
}

function onPointerDown(e) {
    unlockAudio();
    const p = toLogical(e);
    Object.assign(mouse, p, { down: true });

    if (game.state === STATE.COVER) { goToMenu(); return; }
    if (game.state === STATE.EXITED) { game.state = STATE.COVER; return; }
    if (game.state === STATE.TUTORIAL) { nextTalk(); return; }

    for (const b of currentButtons()) {
        if (!hit(b, p)) continue;
        if (b.slider) {
            mouse.slider = b;
            setSlider(b.slider, p.x, b);
        } else {
            mouse.pressedButton = b;
        }
        return;
    }
}

function onPointerMove(e) {
    Object.assign(mouse, toLogical(e));
    if (mouse.slider) setSlider(mouse.slider.slider, mouse.x, mouse.slider);
    const over = currentButtons().some((b) => hit(b, mouse));
    canvas.style.cursor = over ? "pointer" : "default";
}

function onPointerUp(e) {
    const p = toLogical(e);
    const b = mouse.pressedButton;
    mouse.down = false;
    mouse.slider = null;
    mouse.pressedButton = null;
    // o clique só vale se soltar em cima do mesmo botão
    if (b && hit(b, p) && currentButtons().some((x) => x.onClick === b.onClick || (x.x === b.x && x.y === b.y))) {
        b.onClick();
    }
}

// ============================================================== estado/jogo ==
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const game = {
    state: STATE.COVER,
    paused: false,
    players: [
        // Esquilo1: W A S D
        new Squirrel(1, { left: "KeyA", right: "KeyD", jump: "KeyW", down: "KeyS" }),
        // Esquilo2: setas
        new Squirrel(2, { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", down: "ArrowDown" }),
    ],
    nuts: [],
    crowns: { 1: 0, 2: 0 },
    round: 1,
    timeLeft: ROUND_TIME,
    nutTimer: 0,
    stateTime: 0,       // segundos desde que o estado atual começou
    talkIndex: 0,
    roundWinner: 0,
};

function setState(s) {
    game.state = s;
    game.stateTime = 0;
}

function goToMenu() {
    game.paused = false;
    game.crowns = { 1: 0, 2: 0 };
    game.round = 1;
    game.nuts = [];
    game.players.forEach((p) => p.reset());
    if (talkAudio) talkAudio.pause();
    setState(STATE.MENU);
    playMusic("initial");
}

function exitGame() {
    stopMusic();
    // window.close() só funciona em abas abertas por script; se o navegador
    // não deixar, mostramos uma tela de despedida.
    window.close();
    setState(STATE.EXITED);
}

function startTutorial() {
    game.talkIndex = 0;
    setState(STATE.TUTORIAL);
    playTalk();
}

function nextTalk() {
    game.talkIndex++;
    game.stateTime = 0;
    if (game.talkIndex >= TALKS.length) {
        if (talkAudio) talkAudio.pause();
        startRound();
    } else {
        playTalk();
    }
}

function startRound() {
    game.nuts = [];
    game.timeLeft = ROUND_TIME;
    game.nutTimer = 0;
    game.players.forEach((p) => p.reset());
    setState(STATE.COUNTDOWN);
    playSfx("countdown");
}

function endRound() {
    const [p1, p2] = game.players;
    if (p1.score > p2.score) game.roundWinner = 1;
    else if (p2.score > p1.score) game.roundWinner = 2;
    else game.roundWinner = 0; // empate: ninguém ganha coroa

    if (game.roundWinner) {
        game.crowns[game.roundWinner]++;
        for (const p of game.players) p.result = p.id === game.roundWinner ? "win" : "lose";
    }
    if (game.crowns[1] >= CROWNS_TO_WIN || game.crowns[2] >= CROWNS_TO_WIN) {
        setState(STATE.GAME_OVER);
        stopMusic();
        playSfx("gameOver");
    } else {
        setState(STATE.ROUND_END);
    }
}

function update(dt) {
    if (game.paused) return;
    game.stateTime += dt;

    switch (game.state) {
        case STATE.TUTORIAL:
            if (game.stateTime >= TALK_DURATION) nextTalk();
            break;

        case STATE.COUNTDOWN:
            if (game.stateTime >= COUNTDOWN_TIME) {
                setState(STATE.PLAYING);
                playMusic("play"); // música das rodadas começa com a partida
            }
            break;

        case STATE.PLAYING: {
            game.timeLeft -= dt;
            game.nutTimer -= dt;
            if (game.nutTimer <= 0) {
                game.nutTimer = NUT_SPAWN_INTERVAL;
                for (let i = 0; i < NUT_SPAWN_COUNT && game.nuts.length < MAX_NUTS; i++) spawnNut();
            }
            for (const p of game.players) {
                p.update(dt);
                for (let i = game.nuts.length - 1; i >= 0; i--) {
                    const n = game.nuts[i];
                    if (rectsOverlap(p, n)) {
                        p.score += n.value;
                        playSfx(n.golden ? "golden" : "nut");
                        game.nuts.splice(i, 1);
                    }
                }
            }
            if (game.timeLeft <= 0) {
                game.timeLeft = 0;
                endRound();
            }
            break;
        }

        case STATE.ROUND_END:
            game.players.forEach((p) => p.update(dt));
            if (game.stateTime >= ROUND_END_TIME) {
                game.round++;
                startRound(); // o temporizador reinicia para a próxima rodada
            }
            break;

        case STATE.GAME_OVER:
            game.players.forEach((p) => p.update(dt));
            break;
    }
}

// ================================================================= desenho ===
function drawButtons() {
    for (const b of currentButtons()) {
        if (!b.sprite) continue;
        const isDown = mouse.pressedButton && mouse.pressedButton.x === b.x && mouse.pressedButton.y === b.y && hit(b, mouse);
        drawSprite(b.sprite, isDown ? 1 : 0, b.x, b.y, b.w, b.h);
    }
}

function drawConfigPanel(inGame) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, W, H);
    const P = CONFIG_PANEL;
    drawSprite(inGame ? "configGame" : "configMenu", 0, P.x, P.y, P.w, P.h);

    // escurece o pedaço da barra acima do volume atual
    for (const [name, by] of [["sfx", 38], ["music", 60]]) {
        const bx = P.x + 29, bw = 32;
        const filled = bw * settings[name];
        ctx.fillStyle = "rgba(40, 15, 0, 0.75)";
        ctx.fillRect(bx + filled, P.y + by, bw - filled, 5);
        drawText(Math.round(settings[name] * 100) + "%", P.x + 92, P.y + by + 2.5, 5, "#fff3c4");
    }

    // destaque do botão sob o mouse
    for (const b of configButtons(inGame)) {
        if (!b.slider && hit(b, mouse)) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
            ctx.fillRect(b.x, b.y, b.w, b.h);
        }
    }
}

function drawHUD() {
    // temporizador (centro, em cima)
    drawSprite("timerBoard", 0, 81.5, 0, 37, 24);
    const t = Math.ceil(game.timeLeft);
    const mm = Math.floor(t / 60);
    const ss = String(t % 60).padStart(2, "0");
    drawNumber(`${mm}:${ss}`, 100, 14.5, 6.5);

    // contadores: Esquilo1 no canto inferior direito, Esquilo2 no esquerdo
    const c1 = { x: 149, y: 178 };
    const c2 = { x: 1, y: 178 };
    drawSprite("counter1", 0, c1.x, c1.y, 50, 21);
    drawSprite("counter2", 0, c2.x, c2.y, 50, 21);
    drawNumber(game.players[0].score, c1.x + 20.5, c1.y + 10.5, 6);
    drawNumber(game.players[1].score, c2.x + 27.5, c2.y + 10.5, 6);

    // coroas ao lado de cada contador
    for (let i = 0; i < game.crowns[1]; i++) drawSprite("crown", 0, c1.x + 39 - i * 11, c1.y - 9, 10, 8.4);
    for (let i = 0; i < game.crowns[2]; i++) drawSprite("crown", 0, c2.x + 1 + i * 11, c2.y - 9, 10, 8.4);
}

function drawGameScene(dt) {
    drawSprite("background", 0, 0, 0, W, H);
    drawSprite("platforms", 0, 0, 0, W, H);
    for (const n of game.nuts) n.draw(dt);
    for (const p of game.players) p.draw();
    drawHUD();
}

function wrapText(text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = w;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function drawTutorial() {
    drawSprite("menuBg", 0, 0, 0, W, H);
    drawSprite("tutorialBoard", 0, 36, 64, 128, 76);

    // esquilo parado em cima da plataforma da direita
    const meta = SPRITE_META.p1Idle;
    const sw = meta.w / 8 * 1.7, sh = meta.h / 8 * 1.7;
    drawSprite("p1Idle", frameAt("p1Idle", performance.now()), 186 - sw, 158 - sh, sw, sh, true);

    // balão de fala
    const bx = 102, by = 150, rx = 50, ry = 21;
    ctx.fillStyle = "#e9a877";
    ctx.strokeStyle = "#7a2e12";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx + rx - 8, by + 8);
    ctx.lineTo(bx + rx + 10, by + 10);
    ctx.lineTo(bx + rx - 3, by + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // texto da fala aparecendo aos poucos
    const text = TALKS[game.talkIndex] || "";
    const shown = text.slice(0, Math.floor(game.stateTime * 45));
    let size = 4.2;
    ctx.font = `bold ${size}px "Trebuchet MS", Verdana, sans-serif`;
    let lines = wrapText(text, rx * 1.6);
    if (lines.length > 6) {
        size = 3.6;
        ctx.font = `bold ${size}px "Trebuchet MS", Verdana, sans-serif`;
        lines = wrapText(text, rx * 1.65);
    }
    ctx.fillStyle = "#3b1d0a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let remaining = shown.length;
    const lh = size * 1.18;
    lines.forEach((ln, i) => {
        const part = ln.slice(0, Math.max(0, remaining));
        remaining -= ln.length + 1;
        // desenha alinhado como se a linha estivesse completa (texto não "anda")
        const full = ctx.measureText(ln).width;
        ctx.textAlign = "left";
        ctx.fillText(part, bx - full / 2, by + (i - (lines.length - 1) / 2) * lh);
    });

    drawText(`${game.talkIndex + 1}/${TALKS.length}  (clique ou Espaço para pular)`, 100, 196, 3.6, "#fff3c4");
}

function draw(dt) {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);

    switch (game.state) {
        case STATE.COVER:
            if (coverImage.naturalWidth) ctx.drawImage(coverImage, 0, 0, W, H);
            if (Math.floor(performance.now() / 500) % 2 === 0) {
                drawText("Clique para começar", 100, 186, 7, "#ffd27a");
            }
            break;

        case STATE.MENU:
            drawSprite("menuBg", 0, 0, 0, W, H);
            drawButtons();
            break;

        case STATE.MENU_CONFIG:
            drawSprite("menuBg", 0, 0, 0, W, H);
            drawConfigPanel(false);
            break;

        case STATE.TUTORIAL:
            drawTutorial();
            break;

        case STATE.COUNTDOWN:
            drawGameScene(game.paused ? 0 : dt);
            drawButtons();
            if (!game.paused) {
                const n = Math.max(1, COUNTDOWN_TIME - Math.floor(game.stateTime));
                const pulse = 1 + (1 - (game.stateTime % 1)) * 0.4;
                drawText(`Rodada ${game.round}`, 100, 70, 9, "#ffd27a");
                drawNumber(n, 100, 100, 22 * pulse);
            }
            break;

        case STATE.PLAYING:
            drawGameScene(game.paused ? 0 : dt);
            drawButtons();
            break;

        case STATE.ROUND_END:
            drawGameScene(dt);
            drawButtons();
            if (game.roundWinner) {
                drawText(`Esquilo ${game.roundWinner} venceu a rodada ${game.round}!`, 100, 62, 7, "#ffd27a");
            } else {
                drawText(`Rodada ${game.round}: empate!`, 100, 62, 7, "#ffd27a");
            }
            drawText(`Próxima rodada em ${Math.ceil(ROUND_END_TIME - game.stateTime)}...`, 100, 74, 5);
            break;

        case STATE.GAME_OVER: {
            drawGameScene(dt);
            ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
            ctx.fillRect(0, 40, W, 112);
            const winner = game.crowns[1] >= CROWNS_TO_WIN ? 1 : 2;
            drawText("FIM DE JOGO!", 100, 62, 11, "#ffd27a");
            drawText(`Esquilo ${winner} é o rei das nozes!`, 100, 80, 7);
            for (let i = 0; i < CROWNS_TO_WIN; i++) drawSprite("crown", 0, 84 + i * 11, 92, 10, 8.4);
            drawButtons();
            break;
        }

        case STATE.EXITED:
            ctx.fillStyle = "#1a1a2e";
            ctx.fillRect(0, 0, W, H);
            drawText("Obrigado por jogar!", 100, 90, 10, "#ffd27a");
            drawText("Pode fechar esta aba.", 100, 108, 6);
            drawText("(clique para voltar)", 100, 120, 4.5, "#bbb");
            break;
    }

    if (game.paused) drawConfigPanel(true);
}

// =============================================================== laço/tela ===
function resize() {
    const size = Math.max(200, Math.floor(Math.min(window.innerWidth, window.innerHeight)));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
}

let lastTime = 0;
function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0); // evita "saltos" se a aba ficar parada
    lastTime = now;
    update(dt);
    draw(dt);
    for (const k in pressed) delete pressed[k];
    requestAnimationFrame(loop);
}

window.addEventListener("resize", resize);
canvas.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);

resize();
loadAllImages().then(() => {
    document.getElementById("loading").remove();
    requestAnimationFrame((t) => { lastTime = t; loop(t); });
});
