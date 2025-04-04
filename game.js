document.addEventListener('DOMContentLoaded', () => {
    // ====================== DOM Elements ======================
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const leaderboardBtn = document.getElementById('leaderboard');
    const nameInput = document.getElementById('nameInput');
    const playerNameInput = document.getElementById('playerName');
    const submitScoreBtn = document.getElementById('submitScoreBtn');
    const restartBtn = document.getElementById('restartBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const addToLeaderboardBtn = document.getElementById('addToLeaderboard');
    const currentScoreElement = document.getElementById('currentScore');
    const loaderElement = document.getElementById('loader');
    const contentWrapper = document.getElementById('content-wrapper');
    const gameContainer = document.getElementById('game-container');

    // ====================== Game Constants ======================
    const GAME_WIDTH = 400;
    const GAME_HEIGHT = 600;
    const GRAVITY = 1400;
    const JUMP_FORCE = -400;
    const PIPE_WIDTH = 60;
    const BASE_SCROLL_SPEED = 100;
    const INITIAL_SCROLL_SPEED = 100;
    const MAX_SCROLL_SPEED = 250;
    const SCROLL_SPEED_INCREMENT = 5;
    const SCORE_INTERVAL_FOR_SPEED_UP = 5;
    const INITIAL_PIPE_GAP = 160;
    const MIN_PIPE_GAP = 110;
    const GAP_REDUCTION_AMOUNT = 4;
    const SCORE_INTERVAL_FOR_GAP_REDUCTION = 8;
    const INITIAL_PIPE_SPACING = 240;
    const MIN_PIPE_SPACING = 180;
    const SPACING_REDUCTION_AMOUNT = 6;
    const SCORE_INTERVAL_FOR_SPACING_REDUCTION = 12;
    const MIN_PIPE_HEIGHT = 50;
    const PIPE_VERTICAL_MARGIN = 60;

    // ====================== Game State ======================
    let gameState = {
        bird: {
            x: 130, y: GAME_HEIGHT / 2, velocity: 0, width: 40, height: 30,
            frame: 0, rotation: 0, sprites: [new Image(), new Image(), new Image()]
        },
        pipes: [], score: 0,
        personalBest: parseInt(localStorage.getItem('personalBest')) || 0,
        gameOver: false, started: false, paused: false, baseOffset: 0,
        numbers: [], baseHeight: 112,
        lastTime: performance.now(), showFlash: false, hitGround: false,
        crashRotation: 0, scrollSpeed: INITIAL_SCROLL_SPEED,
        currentPipeGap: INITIAL_PIPE_GAP,
        currentPipeSpacing: INITIAL_PIPE_SPACING,
        playerName: localStorage.getItem('flappyPlayerName') || ''
    };

    // ====================== Game Assets ======================
    const assets = {
        background: new Image(), base: new Image(), gameOverImg: new Image(),
        pipeTop: new Image(), pipeBottom: new Image()
    };
    assets.background.src = 'background-day.png';
    assets.base.src = 'base.png';
    assets.gameOverImg.src = 'gameover.png';
    assets.pipeTop.src = 'pipe-green-top.png';
    assets.pipeBottom.src = 'pipe-green-bottom.png';
    gameState.bird.sprites[0].src = 'bluebird-upflap.png';
    gameState.bird.sprites[1].src = 'bluebird-midflap.png';
    gameState.bird.sprites[2].src = 'bluebird-downflap.png';
    for (let i = 0; i < 10; i++) {
        const img = new Image();
        img.src = `${i}.png`;
        gameState.numbers.push(img);
    }

    // ====================== Toast System ======================
    function showToast(message, duration = 3000, isError = false) {
        const existingToast = document.getElementById('toast-notification');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.textContent = message;
        toast.classList.add(isError ? 'error' : 'success');
        document.body.appendChild(toast);

        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }

    // ====================== Input Handling ======================
    function handleInput(e) {
        if (e) e.preventDefault();
        if (gameState.gameOver || gameState.paused) return;
        
        if (!gameState.started) {
            gameState.started = true;
            document.getElementById('swooshSound')?.play().catch(() => {});
        }
        
        gameState.bird.velocity = JUMP_FORCE;
        document.getElementById('wingSound')?.play().catch(() => {});
    }

    // Event Listeners
    canvas.addEventListener('mousedown', handleInput);
    canvas.addEventListener('touchstart', handleInput, { passive: false });
    
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !nameInputVisible()) handleInput(e);
        if (e.code === 'Enter' && nameInputVisible()) {
            e.preventDefault();
            e.stopPropagation();
            submitScore();
        }
    });

    function nameInputVisible() {
        return window.getComputedStyle(nameInput).display === 'block';
    }

    // ====================== Score Submission ======================
    addToLeaderboardBtn.addEventListener('click', () => {
        playerNameInput.value = gameState.playerName || '';
        nameInput.style.display = 'block';
        setTimeout(() => playerNameInput.focus(), 0);
    });

    playerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            submitScore();
        }
    });

    submitScoreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        submitScore();
    });

    async function submitScore() {
        const name = playerNameInput.value.trim();
        if (!name) {
            showToast("Please enter a name.", 3000, true);
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: name.substring(0, 15), 
                    score: gameState.score 
                }),
                redirect: 'manual'
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            showToast("Score submitted successfully!");
            gameState.personalBest = Math.max(gameState.score, gameState.personalBest);
            localStorage.setItem('personalBest', gameState.personalBest.toString());
            localStorage.setItem('flappyPlayerName', name);
            gameState.playerName = name;
            nameInput.style.display = 'none';
        } catch (error) {
            console.error('Submission error:', error);
            showToast(`Submission failed: ${error.message}`, 4000, true);
        }
    }

    // ====================== Game Controls ======================
    function togglePause() {
        if (gameState.gameOver) return;
        gameState.paused = !gameState.paused;
        
        if (!gameState.paused) {
            gameState.lastTime = performance.now();
            requestAnimationFrame(gameLoop);
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Paused', GAME_WIDTH / 2, GAME_HEIGHT / 2);
        }
    }

    function resetGame() {
        cancelAnimationFrame(animationFrameId);
        
        const preservedData = {
            personalBest: gameState.personalBest,
            playerName: gameState.playerName,
            numbers: gameState.numbers,
            birdSprites: gameState.bird.sprites
        };

        gameState = {
            ...gameState,
            bird: {
                x: 130, y: GAME_HEIGHT / 2, velocity: 0, width: 40, height: 30,
                frame: 0, rotation: 0, sprites: preservedData.birdSprites
            },
            pipes: [], score: 0,
            gameOver: false, started: false, paused: false, baseOffset: 0,
            lastTime: performance.now(), showFlash: false, hitGround: false,
            crashRotation: 0, scrollSpeed: INITIAL_SCROLL_SPEED,
            currentPipeGap: INITIAL_PIPE_GAP, currentPipeSpacing: INITIAL_PIPE_SPACING,
            personalBest: preservedData.personalBest,
            playerName: preservedData.playerName,
            numbers: preservedData.numbers
        };

        document.querySelectorAll('.game-button').forEach(btn => {
            btn.style.display = ['leaderboard', 'pauseBtn'].includes(btn.id) ? 'block' : 'none';
        });

        nameInput.style.display = 'none';
        const existingOverlay = document.getElementById('gameOverOverlay');
        if (existingOverlay) existingOverlay.remove();
        
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // ====================== Game Logic ======================
    function createPipe() {
        const usableHeight = GAME_HEIGHT - gameState.baseHeight - (PIPE_VERTICAL_MARGIN * 2);
        const gapCenterY = PIPE_VERTICAL_MARGIN + gameState.currentPipeGap / 2 + 
                         Math.random() * (usableHeight - gameState.currentPipeGap);
        
        const topPipeHeight = Math.max(MIN_PIPE_HEIGHT, gapCenterY - gameState.currentPipeGap / 2);
        const bottomPipeY = Math.min(
            GAME_HEIGHT - gameState.baseHeight - MIN_PIPE_HEIGHT,
            gapCenterY + gameState.currentPipeGap / 2
        );
        
        return {
            x: GAME_WIDTH,
            topHeight: topPipeHeight,
            bottomHeight: GAME_HEIGHT - gameState.baseHeight - bottomPipeY,
            passed: false,
            width: PIPE_WIDTH
        };
    }

    function update(deltaTime) {
        if (gameState.paused) return;

        // Base ground movement
        if (!gameState.gameOver) {
            gameState.baseOffset = (gameState.baseOffset + BASE_SCROLL_SPEED * deltaTime) % 
                                  (assets.base.naturalWidth || 336);
        }

        // Bird animation
        if (!gameState.gameOver || !gameState.hitGround) { 
            gameState.bird.frame = (gameState.bird.frame + deltaTime * 12) % 3;
        }

        // Game over state handling
        if (gameState.gameOver) {
            if (!gameState.hitGround) {
                gameState.bird.velocity += GRAVITY * deltaTime * 1.8;
                gameState.bird.y += gameState.bird.velocity * deltaTime;
                gameState.crashRotation = Math.min(90, gameState.crashRotation + 400 * deltaTime);
                gameState.bird.rotation = gameState.crashRotation;

                if (gameState.bird.y + gameState.bird.height/2 >= GAME_HEIGHT - gameState.baseHeight) {
                    gameState.hitGround = true;
                    gameState.bird.rotation = 90;
                }
            }
            return;
        }

        // Pre-game idle animation
        if (!gameState.started) {
            gameState.bird.y = GAME_HEIGHT/2 + Math.sin(performance.now()/250) * 8;
            return;
        }

        // Bird physics
        gameState.bird.velocity += GRAVITY * deltaTime;
        gameState.bird.y += gameState.bird.velocity * deltaTime;
        gameState.bird.y = Math.max(gameState.bird.height/2, gameState.bird.y);
        gameState.bird.rotation = Math.max(-20, Math.min(90, gameState.bird.velocity * 0.1));

        // Pipe generation
        if (gameState.pipes.length === 0 || 
            Math.max(...gameState.pipes.map(p => p.x)) < GAME_WIDTH - gameState.currentPipeSpacing) {
            gameState.pipes.push(createPipe());
        }

        // Pipe movement and scoring
        let collisionDetected = false;
        gameState.pipes.forEach(pipe => {
            pipe.x -= gameState.scrollSpeed * deltaTime;
            
            if (!pipe.passed && pipe.x + PIPE_WIDTH < gameState.bird.x) {
                gameState.score++;
                pipe.passed = true;
                document.getElementById('pointSound')?.play();
                
                // Difficulty increases
                if (gameState.score % SCORE_INTERVAL_FOR_SPEED_UP === 0) {
                    gameState.scrollSpeed = Math.min(MAX_SCROLL_SPEED, gameState.scrollSpeed + SCROLL_SPEED_INCREMENT);
                }
                if (gameState.score % SCORE_INTERVAL_FOR_GAP_REDUCTION === 0) {
                    gameState.currentPipeGap = Math.max(MIN_PIPE_GAP, gameState.currentPipeGap - GAP_REDUCTION_AMOUNT);
                }
                if (gameState.score % SCORE_INTERVAL_FOR_SPACING_REDUCTION === 0) {
                    gameState.currentPipeSpacing = Math.max(MIN_PIPE_SPACING, gameState.currentPipeSpacing - SPACING_REDUCTION_AMOUNT);
                }
            }

            // Collision detection
            const birdBounds = {
                left: gameState.bird.x - gameState.bird.width/2 + 2,
                right: gameState.bird.x + gameState.bird.width/2 - 2,
                top: gameState.bird.y - gameState.bird.height/2 + 2,
                bottom: gameState.bird.y + gameState.bird.height/2 - 2
            };

            const pipeBounds = {
                left: pipe.x,
                right: pipe.x + PIPE_WIDTH,
                topPipeBottom: pipe.topHeight,
                bottomPipeTop: GAME_HEIGHT - pipe.bottomHeight - gameState.baseHeight
            };

            if (birdBounds.right > pipeBounds.left && 
                birdBounds.left < pipeBounds.right && 
                (birdBounds.top < pipeBounds.topPipeBottom || 
                 birdBounds.bottom > pipeBounds.bottomPipeTop)) {
                collisionDetected = true;
            }
        });

        // Ground collision
        if (gameState.bird.y + gameState.bird.height/2 >= GAME_HEIGHT - gameState.baseHeight) {
            collisionDetected = true;
        }

        if (collisionDetected) {
            gameOver();
        }

        // Cleanup off-screen pipes
        gameState.pipes = gameState.pipes.filter(pipe => pipe.x + PIPE_WIDTH > 0);
    }

    // ====================== Game Over System ======================
    function showGameOverScreen() {
        if (document.getElementById('gameOverOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'gameOverOverlay';
        
        const scoreContainer = document.createElement('div');
        scoreContainer.className = 'score-display-box';

        function createScoreLine(score) {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'score-line';
            
            score.toString().split('').forEach(digit => {
                const numImg = document.createElement('img');
                numImg.className = 'score-digit';
                numImg.src = `${digit}.png`;
                lineDiv.appendChild(numImg);
            });
            
            return lineDiv;
        }

        // Current Score
        const currentScoreLine = createScoreLine(gameState.score);
        const currentScoreLabel = document.createElement('div');
        currentScoreLabel.textContent = 'Score: ';
        scoreContainer.appendChild(currentScoreLabel);
        scoreContainer.appendChild(currentScoreLine);

        // Best Score
        const bestScoreLine = createScoreLine(gameState.personalBest);
        const bestScoreLabel = document.createElement('div');
        bestScoreLabel.textContent = 'Best: ';
        scoreContainer.appendChild(bestScoreLabel);
        scoreContainer.appendChild(bestScoreLine);

        overlay.appendChild(scoreContainer);
        gameContainer.appendChild(overlay);

        // Show buttons
        restartBtn.style.display = 'block';
        addToLeaderboardBtn.style.display = 'block';
        positionElements();
    }

    function gameOver() {
        if (gameState.gameOver) return;
        
        gameState.gameOver = true;
        gameState.showFlash = true;
        document.getElementById('hitSound')?.play();
        setTimeout(() => document.getElementById('dieSound')?.play(), 100);
        
        if (gameState.score > gameState.personalBest) {
            gameState.personalBest = gameState.score;
            localStorage.setItem('personalBest', gameState.personalBest);
        }
        
        pauseBtn.style.display = 'none';
        showGameOverScreen();
    }

    // ====================== Rendering System ======================
    function drawBird() {
        ctx.save();
        ctx.translate(gameState.bird.x, gameState.bird.y);
        ctx.rotate(gameState.bird.rotation * Math.PI / 180);
        
        const frame = Math.floor(gameState.bird.frame) % 3;
        const sprite = gameState.bird.sprites[frame];
        
        if (sprite.complete) {
            ctx.drawImage(
                sprite,
                -gameState.bird.width/2,
                -gameState.bird.height/2,
                gameState.bird.width,
                gameState.bird.height
            );
        } else {
            ctx.fillStyle = '#00f';
            ctx.fillRect(-gameState.bird.width/2, -gameState.bird.height/2, 
                       gameState.bird.width, gameState.bird.height);
        }
        
        ctx.restore();
    }

    function drawBase() {
        const baseY = GAME_HEIGHT - gameState.baseHeight;
        const patternWidth = assets.base.naturalWidth || 336;
        
        if (assets.base.complete) {
            for (let x = -gameState.baseOffset % patternWidth; x < GAME_WIDTH; x += patternWidth) {
                ctx.drawImage(assets.base, x, baseY, patternWidth, gameState.baseHeight);
            }
        }
    }

    function drawPipes() {
        gameState.pipes.forEach(pipe => {
            if (assets.pipeTop.complete) {
                ctx.drawImage(assets.pipeTop, pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
                ctx.drawImage(
                    assets.pipeBottom, 
                    pipe.x, 
                    GAME_HEIGHT - pipe.bottomHeight - gameState.baseHeight, 
                    PIPE_WIDTH, 
                    pipe.bottomHeight
                );
            } else {
                ctx.fillStyle = '#2a7020';
                ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
                ctx.fillRect(
                    pipe.x, 
                    GAME_HEIGHT - pipe.bottomHeight - gameState.baseHeight, 
                    PIPE_WIDTH, 
                    pipe.bottomHeight
                );
            }
        });
    }

    function drawScore() {
        if (!gameState.started || gameState.gameOver) return;
        
        currentScoreElement.innerHTML = '';
        gameState.score.toString().split('').forEach(digit => {
            const numImg = document.createElement('img');
            numImg.className = 'score-digit';
            numImg.src = `${digit}.png`;
            currentScoreElement.appendChild(numImg);
        });
    }

    function draw() {
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        // Background
        if (assets.background.complete) {
            ctx.drawImage(assets.background, 0, 0, GAME_WIDTH, GAME_HEIGHT);
        } else {
            ctx.fillStyle = '#70c5ce';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }

        // Pipes
        drawPipes();

        // Ground
        drawBase();

        // Bird
        drawBird();

        // Flash effect
        if (gameState.showFlash) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            gameState.showFlash = false;
        }

        // UI Elements
        if (!gameState.started && !gameState.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Tap or SPACE to Start', GAME_WIDTH/2, GAME_HEIGHT/2);
        }

        // Current Score
        drawScore();

        // Game Over Screen
        if (gameState.gameOver && gameState.hitGround) {
            if (assets.gameOverImg.complete) {
                const scale = 0.4;
                const imgWidth = assets.gameOverImg.naturalWidth * scale;
                const imgHeight = assets.gameOverImg.naturalHeight * scale;
                ctx.drawImage(
                    assets.gameOverImg,
                    GAME_WIDTH/2 - imgWidth/2,
                    GAME_HEIGHT * 0.2,
                    imgWidth,
                    imgHeight
                );
            }
        }
    }

    // ====================== Game Loop ======================
    let animationFrameId;
    function gameLoop(currentTime) {
        const deltaTime = (currentTime - gameState.lastTime) / 1000;
        gameState.lastTime = currentTime;

        if (!gameState.paused) {
            update(Math.min(deltaTime, 0.05));
            draw();
        }

        if (!gameState.gameOver || !gameState.hitGround) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }

    // ====================== Initialization ======================
    let assetsLoaded = 0;
    const totalAssets = Object.values(assets).length + 
                      gameState.bird.sprites.length + 
                      gameState.numbers.length;

    function checkAssets() {
        assetsLoaded++;
        if (assetsLoaded === totalAssets) {
            loaderElement.style.display = 'none';
            contentWrapper.style.display = 'flex';
            initializeGame();
        }
    }

    // Asset loading handlers
    Object.values(assets).forEach(img => {
        img.onload = checkAssets;
        img.onerror = checkAssets;
    });
    gameState.bird.sprites.forEach(sprite => {
        sprite.onload = checkAssets;
        sprite.onerror = checkAssets;
    });
    gameState.numbers.forEach(number => {
        number.onload = checkAssets;
        number.onerror = checkAssets;
    });

    // Fallback initialization
    setTimeout(() => {
        if (!contentWrapper.style.display || contentWrapper.style.display === 'none') {
            console.warn('Asset loading timeout, forcing initialization');
            checkAssets();
        }
    }, 8000);

    function initializeGame() {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
        leaderboardBtn.style.display = 'block';
        pauseBtn.style.display = 'block';
        gameState.lastTime = performance.now();
        gameLoop(gameState.lastTime);
    }

    // ====================== Button Positioning ======================
    function positionElements() {
        if (!restartBtn || !addToLeaderboardBtn) return;

        if (window.getComputedStyle(restartBtn).display === 'block') {
            const restartWidth = restartBtn.offsetWidth || 100;
            restartBtn.style.left = `${(GAME_WIDTH / 2) - (restartWidth / 2)}px`;
            restartBtn.style.top = `${GAME_HEIGHT - 160}px`;
        }

        if (window.getComputedStyle(addToLeaderboardBtn).display === 'block') {
            const addWidth = addToLeaderboardBtn.offsetWidth || 170;
            addToLeaderboardBtn.style.left = `${(GAME_WIDTH / 2) - (addWidth / 2)}px`;
            addToLeaderboardBtn.style.top = `${GAME_HEIGHT - 110}px`;
        }
    }

    // ====================== Event Bindings ======================
    restartBtn.addEventListener('click', resetGame);
    pauseBtn.addEventListener('click', togglePause);
    leaderboardBtn.addEventListener('click', () => {
        window.location.href = 'leaderboard.html';
    });
});