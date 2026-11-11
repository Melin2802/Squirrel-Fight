// Squirrel Fight - JavaScript Game Logic
// This script goes before the closing </body> tag in game.html

// Game States
const GAME_STATE = {
    MENU: 'menu',
    TUTORIAL: 'tutorial',
    COUNTDOWN: 'countdown',
    PLAYING: 'playing',
    ROUND_END: 'round_end',
    GAME_OVER: 'game_over'
};

// Game Constants
const GRAVITY = 0.8;
const PLAYER_SPEED = 2;
const JUMP_FORCE = 10;
const NUT_SPAWN_INTERVAL = 5000; // 5 seconds
const NUT_SPAWN_COUNT = 2; // 2 nuts at a time
const GOLDEN_NUT_PERCENT = 30; // 30% chance for golden nut
const ROUND_TIME = 90; // 1:30 in seconds
const TUTORIAL_TALKS = 6;
const TALK_DURATION = 10000; // 10 seconds each
const COUNTDOWN_START = 3; // 3 seconds

let isPaused = false;
let tutorialIndex = 0;
let nutSpawnTimer = 0;
let countdownTimer = COUNTDOWN_START;

// Player class
class Player {
    constructor(id, x, y, controls, keys) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isOnGround = false;
        this.direction = 1; // 1 for right, -1 for left
        this.controls = controls; // {left, right, jump}
        this.keys = keys; // Reference to game keys object
        this.currentAnimation = 'parado';
        this.frame = 0;
        this.lastFrameUpdate = 0;
        this.isVisible = true;
    }

    update(deltaTime, platforms) {
        // Apply gravity
        this.velocityY += GRAVITY * deltaTime;

        // Horizontal movement using game keys
        if (this.keys[this.controls.left]) {
            this.velocityX = -PLAYER_SPEED;
            this.direction = -1;
        } else if (this.keys[this.controls.right]) {
            this.velocityX = PLAYER_SPEED;
            this.direction = 1;
        } else {
            // Apply friction when no key pressed
            this.velocityX *= 0.8;
        }

        // Apply horizontal movement
        this.x += this.velocityX * deltaTime;

        // Horizontal collision with platforms
        this.checkPlatformCollision('horizontal', platforms);

        // Vertical movement
        this.y += this.velocityY * deltaTime;

        // Vertical collision with platforms
        this.isOnGround = false;
        this.checkPlatformCollision('vertical', platforms);

        // Update animation state
        this.updateAnimation(deltaTime);
    }

    checkPlatformCollision(direction, platforms) {
        for (const platform of platforms) {
            // AABB collision detection
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {

                if (direction === 'vertical') {
                    if (this.velocityY > 0) { // Landing on platform
                        this.y = platform.y - this.height;
                        this.velocityY = 0;
                        this.isOnGround = true;
                    } else if (this.velocityY < 0) { // Head collision
                        this.y = platform.y + platform.height;
                        this.velocityY = 0;
                    }
                }
                if (direction === 'horizontal') {
                    if (this.velocityX > 0) {
                        this.x = platform.x - this.width;
                    } else if (this.velocityX < 0) {
                        this.x = platform.x + platform.width;
                    }
                }
            }
        }
    }

    updateAnimation(deltaTime) {
        // Animation update logic
        // Will use the animation sprites from the Animações folder
    }

    draw(context) {
        // Draw player using current animation frame
        // This will use the esquilo sprite sheets
        const spriteName = this.currentAnimation + (this.id === 1 ? 'Esquilo1' : 'Esquilo2');
        // Draw the appropriate animation frame
    }
}

// Nut class
class Nut {
    constructor(x, y, isGolden) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 16;
        this.isGolden = isGolden;
        this.value = isGolden ? 3 : 1;
        this.currentAnimation = isGolden ? 'dourada' : 'comum';
        this.frame = 0;
    }

    update(deltaTime) {
        // Update animation frame
    }

    draw(context) {
        // Draw nut using the appropriate animation
        const imgName = this.isGolden ? 'SpriteAnimacaoNozDourada' : 'SpriteAnimacaoNozComum';
        // Draw the nut sprite
    }
}

// Platform class
class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw(context) {
        // Draw platform using SpritePlataforma
    }
}

// Main Game Class
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.context = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Game objects
        this.players = [];
        this.nuts = [];
        this.platforms = [];
        this.keys = {};
        this.lastTime = 0;

        // Load sounds
        this.sounds = {
            musicInitial: document.getElementById('musicInitial'),
            musicPlay: document.getElementById('musicPlay'),
            soundJump: document.getElementById('soundJump'),
            soundCollectNormal: document.getElementById('soundCollectNormal'),
            soundCollectGolden: document.getElementById('soundCollectGolden'),
            soundCountdown: document.getElementById('soundCountdown'),
            soundGameOver: document.getElementById('soundGameOver'),
            soundTalk: document.getElementById('soundTalk')
        };

        // Initialize platforms
        this.initPlatforms();

        // Initialize players
        this.initPlayers();

        // Start game loop
        this.gameLoop();
    }

    gameLoop() {
        requestAnimationFrame(() => this.gameLoop());
        this.update();
    }

    initPlatforms() {
        // Create platforms for the 200x200 canvas
        // Based on the SpritePlataforma from the Cenários folder
        this.platforms = [
            new Platform(0, 180, 200, 20), // Ground platform
            new Platform(50, 150, 80, 20), // Middle platform
            new Platform(130, 120, 80, 20), // Upper platform
            new Platform(20, 90, 60, 20), // Upper-left platform
            new Platform(160, 60, 60, 20) // Upper-right platform
        ];
    }

    initPlayers() {
        // Player 1 (Esquilo1): WASD - W=jump, A=left, D=right
        this.players.push(new Player(1, 50, 180, {
            left: 'A',
            right: 'D',
            jump: 'W'
        }, this.keys));

        // Player 2 (Esquilo2): Arrow keys - ←=left, →=right, ↑=jump
        this.players.push(new Player(2, 150, 180, {
            left: 'ArrowLeft',
            right: 'ArrowRight',
            jump: 'ArrowUp'
        }, this.keys));
    }

    initEventListeners() {
        // Keyboard input
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        // Button clicks
        document.getElementById('btnPlay').addEventListener('click', () => this.startGame());
        document.getElementById('btnExit').addEventListener('click', () => this.exitGame());
        document.getElementById('btnConfig').addEventListener('click', () => this.showConfig());
        document.getElementById('btnConfigGame').addEventListener('click', () => this.showGameConfig());
        document.getElementById('btnBackToMenu').addEventListener('click', () => this.goBackToMenu());
        
        // Initial config screen back button
        document.getElementById('btnBackInitial').addEventListener('click', () => {
            document.getElementById('configScreen').style.display = 'none';
            showMenu(true);
        });
    }

    startGame() {
        // Hide menu, show tutorial
        currentState = GAME_STATE.TUTORIAL;
        tutorialIndex = 0;
        showMenu(false);
        showTutorial(true);
        startTutorialSequence();
    }

    startTutorialSequence() {
        const talks = [
            { text: "Olá, jogadores! Sejam bem-vindos ao meu mundo, onde o tempo é precioso e cada escolha faz a diferença!", duration: TALK_DURATION },
            { text: "O Player 1 irá se movimentar usando as teclas W, A, S e D, enquanto o Player 2 utilizará as teclas direcionais do teclado.", duration: TALK_DURATION },
            { text: "O objetivo de vocês é coletar o máximo de nozes possível em 1 minuto e 30 segundos! Para isso, pulem sobre as plataformas, explorem o cenário e peguem todas as nozes que conseguirem!", duration: TALK_DURATION },
            { text: "A cada rodada vencida, o jogador ganha uma coroa. Quem conseguir conquistar 3 coroas primeiro será o grande campeão!", duration: TALK_DURATION },
            { text: "Preparem-se, jogadores! Usem suas habilidades, sejam rápidos e estratégicos, porque cada noz pode fazer a diferença!", duration: TALK_DURATION },
            { text: "Que comece a competição! Quem será o rei ou a rainha das nozes?", duration: TALK_DURATION }
        ];

        const talkSound = this.sounds.soundTalk;
        let currentTalk = 0;
        
        // Show first talk immediately
        if (currentTalk < talks.length) {
            showTalk(talks[currentTalk].text, this);
            talkSound.currentTime = 0;
            talkSound.play();
            currentTalk++;
        }
        
        // Set up interval for remaining talks
        const talkInterval = setInterval(() => {
            if (currentTalk < talks.length) {
                showTalk(talks[currentTalk].text, this);
                talkSound.currentTime = 0;
                talkSound.play();
                currentTalk++;
            } else {
                clearInterval(talkInterval);
                startCountdown();
            }
        }, TALK_DURATION);
    }

    startCountdown() {
        currentState = GAME_STATE.COUNTDOWN;
        countdownTimer = COUNTDOWN_START;
        
        const countdownInterval = setInterval(() => {
            countdownTimer--;
            
            if (countdownTimer <= 0) {
                clearInterval(countdownInterval);
                startRound();
            }
        }, 1000);
    }

    startRound() {
        currentState = GAME_STATE.PLAYING;
        roundTime = ROUND_TIME;
        gameActive = true;
        isPaused = false;
        
        // Hide tutorial and config screens
        showTutorial(false);
        showConfigGame(false);
        
        // Reset nut collection for this round
        resetRoundCounters();
        
        // Start nut spawning
        nutSpawnTimer = 0;
        
        // Start music
        this.sounds.musicInitial.pause();
        this.sounds.musicPlay.play();
    }

    resetRoundCounters() {
        player1CommonNuts = 0;
        player1GoldenNuts = 0;
        player2CommonNuts = 0;
        player2GoldenNuts = 0;
        updateCounters();
    }

    update() {
        if (!gameActive && currentState !== GAME_STATE.TUTORIAL && currentState !== GAME_STATE.COUNTDOWN && currentState !== GAME_STATE.MENU) return;

        const deltaTime = this.calculateDeltaTime();

        if (currentState === GAME_STATE.PLAYING) {
            this.updatePlaying(deltaTime);
        } else if (currentState === GAME_STATE.TUTORIAL) {
            // Tutorial is handled by the sequence
        } else if (currentState === GAME_STATE.COUNTDOWN) {
            // Countdown handled separately
        }

        // Update UI
        updateTimerDisplay(roundTime);
        updateCounters();
    }

    calculateDeltaTime() {
        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        return delta / 1000; // Convert to seconds
    }

    updatePlaying(deltaTime) {
        // Update players
        for (const player of this.players) {
            player.update(deltaTime, this.platforms);
        }

        // Update nuts
        for (const nut of this.nuts) {
            nut.update(deltaTime);
        }

        // Spawn nuts
        nutSpawnTimer -= deltaTime * 1000;
        if (nutSpawnTimer <= 0) {
            spawnNuts(this);
            nutSpawnTimer = NUT_SPAWN_INTERVAL;
        }

        // Check nut collection
        checkNutCollection();

        // Check round end
        roundTime -= deltaTime;
        updateTimerDisplay(Math.max(0, Math.round(roundTime)));

        if (roundTime <= 0) {
            endRound();
        }
    }

    checkNutCollection() {
        for (const player of this.players) {
            for (let i = this.nuts.length - 1; i >= 0; i--) {
                const nut = this.nuts[i];
                if (this.checkCollision(player, nut)) {
                    // Collect nut
                    if (nut.isGolden) {
                        if (player.id === 1) {
                            player1GoldenNuts += nut.value;
                        } else {
                            player2GoldenNuts += nut.value;
                        }
                        this.sounds.soundCollectGolden.play();
                    } else {
                        if (player.id === 1) {
                            player1CommonNuts += nut.value;
                        } else {
                            player2CommonNuts += nut.value;
                        }
                        this.sounds.soundCollectNormal.play();
                    }
                    this.nuts.splice(i, 1);
                    updateCounters();
                }
            }
        }
    }

    checkCollision(player, nut) {
        return player.x < nut.x + nut.width &&
               player.x + player.width > nut.x &&
               player.y < nut.y + nut.height &&
               player.y + player.height > nut.y;
    }

    endRound() {
        gameActive = false;
        currentState = GAME_STATE.ROUND_END;

        // Determine winner of the round
        const player1Total = player1CommonNuts + (player1GoldenNuts * 3);
        const player2Total = player2CommonNuts + (player2GoldenNuts * 3);

        if (player1Total > player2Total) {
            player1Crowns++;
            showCrown(1);
        } else if (player2Total > player1Total) {
            player2Crowns++;
            showCrown(2);
        } else {
            // Tie - no crown awarded, or could go to player with more golden nuts
        }

        // Update crown display
        updateCrownDisplay();

        // Check if someone won (first to 3 crowns)
        if (player1Crowns >= 3) {
            gameOver('Player 1 (Esquilo1)');
        } else if (player2Crowns >= 3) {
            gameOver('Player 2 (Esquilo2)');
        } else {
            // Start next round after delay
            setTimeout(() => startNewRound(), 3000);
        }
    }

    startNewRound() {
        currentState = GAME_STATE.PLAYING;
        roundTime = ROUND_TIME;
        gameActive = true;
        isPaused = false;
        
        // Hide round end screen
        showRoundEnd(false);
        
        // Reset for new round
        nutSpawnTimer = 0;
    }

    gameOver(winner) {
        currentState = GAME_STATE.GAME_OVER;
        document.getElementById('winnerName').textContent = winner;
        showGameOver(true);
        
        // Play game over sound
        this.sounds.soundGameOver.play();
        
        // Add victory/def defeat sashes
        addSashAnimation(winner);
    }

    togglePause() {
        isPaused = !isPaused;
        
        if (isPaused) {
            showConfigGame(true, this);
        } else {
            showConfigGame(false, this);
        }
    }

    exitGame() {
        window.close();
    }

    showConfig() {
        // Show initial configuration screen
        showMenu(false, this);
        document.getElementById('configScreen').style.display = 'block';
    }

    showGameConfig() {
        // Show configuration screen during game
        this.togglePause();
    }

    goBackToMenu() {
        // Reset game state and go back to menu
        currentState = GAME_STATE.MENU;
        gameActive = false;
        showMenu(true);
        showTutorial(false);
        showConfigGame(false);
        showGameOver(false);
        
        // Reset scores
        player1CommonNuts = 0;
        player1GoldenNuts = 0;
        player2CommonNuts = 0;
        player2GoldenNuts = 0;
        player1Crowns = 0;
        player2Crowns = 0;
        roundTime = ROUND_TIME;
        updateTimerDisplay(roundTime);
        updateCounters();
        updateCrownDisplay();
    }
}

// Helper functions - these receive the game instance as a parameter
function updateTimerDisplay(time = null, game = null) {
    if (time !== null && game) {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        game.context.canvas.parentElement.querySelector('#timer').textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    } else if (time !== null) {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        document.getElementById('timer').textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
}

function updateCounters() {
    const total1 = player1CommonNuts + (player1GoldenNuts * 3);
    const total2 = player2CommonNuts + (player2GoldenNuts * 3);
    document.getElementById('counter1').textContent = `${total1}`;
    document.getElementById('counter2').textContent = `${total2}`;
}

function updateCrownDisplay() {
    document.getElementById('crown1').style.display = player1Crowns > 0 ? 'block' : 'none';
    document.getElementById('crown2').style.display = player2Crowns > 0 ? 'block' : 'none';
}

function showCrown(playerNum) {
    // Highlight the crown for the round winner
    // This could add an animation or effect
    if (playerNum === 1) {
        document.getElementById('crown1').style.animation = 'pulse 0.5s';
        setTimeout(() => {
            document.getElementById('crown1').style.animation = '';
        }, 500);
    } else if (playerNum === 2) {
        document.getElementById('crown2').style.animation = 'pulse 0.5s';
        setTimeout(() => {
            document.getElementById('crown2').style.animation = '';
        }, 500);
    }
}

function showMenu(show, game) {
    if (game) game.context.canvas.parentElement.querySelector('#configScreen').style.display = 'none';
    document.getElementById('btnPlay').style.display = show ? 'block' : 'none';
    document.getElementById('btnExit').style.display = show ? 'block' : 'none';
    document.getElementById('btnConfig').style.display = show ? 'block' : 'none';
}

function showTutorial(show) {
    document.getElementById('tutorial').style.display = show ? 'block' : 'none';
}

function showConfigGame(show) {
    document.getElementById('configGameScreen').style.display = show ? 'block' : 'none';
}

function showGameOver(show) {
    document.getElementById('gameOver').style.display = show ? 'flex' : 'none';
}

function showRoundEnd(show, winner = '') {
    document.getElementById('gameOver').style.display = show ? 'flex' : 'none';
    if (winner) {
        document.getElementById('winnerName').textContent = winner;
    }
}

function showTalk(text, game) {
    // Show talk text in balão de fala
    const talkElement = document.createElement('div');
    talkElement.textContent = text;
    talkElement.className = 'talk-balloon';
    document.getElementById('tutorial').appendChild(talkElement);
    // Remove after a while
    setTimeout(() => talkElement.remove(), TALK_DURATION);
}

function spawnNuts(game) {
    // Spawn 2 nuts every 5 seconds
    // Not inside platforms, about them or in air
    // 30% golden, 70% common
    
    for (let i = 0; i < NUT_SPAWN_COUNT; i++) {
        let x, y, isGolden;
        
        // Random position not inside platforms
        let validPosition = false;
        while (!validPosition) {
            x = Math.random() * (200 - 32) + 16; // Random x within canvas
            y = Math.random() * 150 + 20; // Random y
            
            // Check if position is valid (not inside a platform)
            validPosition = true;
            for (const platform of game.platforms) {
                if (x > platform.x && x < platform.x + platform.width &&
                    y > platform.y && y < platform.y + platform.height) {
                    validPosition = false;
                    break;
                }
            }
        }
        
        // 30% chance for golden nut
        isGolden = Math.random() * 100 < GOLDEN_NUT_PERCENT;
        
        game.nuts.push(new Nut(x, y, isGolden));
    }
}

function addSashAnimation(game, winner) {
    // Add victory/def defeat sashes above player heads
    const isPlayer1 = winner.includes('Player 1');
    const player = isPlayer1 ? game.players[0] : game.players[1];
    const sashClass = isPlayer1 ? 'sash-vitoria' : 'sash-derrota';
    
    const sash = document.createElement('div');
    sash.className = sashClass;
    sash.style.left = player.x + player.width / 2 - 20 + 'px';
    sash.style.top = player.y - 10 + 'px';
    game.context.canvas.parentElement.appendChild(sash);
    
    // Remove sash after animation
    setTimeout(() => sash.remove(), 2000);
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.initEventListeners();
});