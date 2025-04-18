// --- Wrap everything in an IIFE or DOMContentLoaded listener ---
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const leaderboardBtn = document.getElementById('leaderboard');
    const nameInput = document.getElementById('nameInput'); // The div container
    const playerNameInput = document.getElementById('playerName'); // The actual text input
    const submitScoreBtn = document.getElementById('submitScoreBtn'); // Reference to the button itself
    const restartBtn = document.getElementById('restartBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const addToLeaderboardBtn = document.getElementById('addToLeaderboard');
    const currentScoreElement = document.getElementById('currentScore');
    const loaderElement = document.getElementById('loader');
    const contentWrapper = document.getElementById('content-wrapper');
    const gameContainer = document.getElementById('game-container');

    // --- Constants ---
    const GAME_WIDTH = 400;
    const GAME_HEIGHT = 600;
    const GRAVITY = 1400;
    const JUMP_FORCE = -400;
    const PIPE_WIDTH = 60;
    const BASE_SCROLL_SPEED = 100; // Separate scroll speed for the base ground

    // --- Difficulty Tuning ---
    const INITIAL_SCROLL_SPEED = 100; // Speed pipes move left
    const MAX_SCROLL_SPEED = 250;
    const SCROLL_SPEED_INCREMENT = 5;
    const SCORE_INTERVAL_FOR_SPEED_UP = 5; // Increase speed every 5 points
    const INITIAL_PIPE_GAP = 160; // Starting vertical gap
    const MIN_PIPE_GAP = 110; // Smallest allowed gap
    const GAP_REDUCTION_AMOUNT = 4; // How much to reduce gap by
    const SCORE_INTERVAL_FOR_GAP_REDUCTION = 8; // Reduce gap every 8 points
    const INITIAL_PIPE_SPACING = 240; // Starting horizontal distance between pipes
    const MIN_PIPE_SPACING = 180; // Smallest allowed spacing
    const SPACING_REDUCTION_AMOUNT = 6; // How much to reduce spacing by
    const SCORE_INTERVAL_FOR_SPACING_REDUCTION = 12; // Reduce spacing every 12 points
    const MIN_PIPE_HEIGHT = 50; // Minimum height for top or bottom pipe piece
    const PIPE_VERTICAL_MARGIN = 60; // Space from top/bottom edge pipes won't spawn in

    // --- Game State ---
    let gameState = {
        bird: {
            x: 130, y: GAME_HEIGHT / 2, velocity: 0, width: 40, height: 30,
            frame: 0, rotation: 0, sprites: [new Image(), new Image(), new Image()]
        },
        pipes: [], score: 0,
        personalBest: parseInt(localStorage.getItem('personalBest')) || 0,
        gameOver: false, started: false, paused: false, baseOffset: 0,
        numbers: [], // Array to hold number images 0-9
        baseHeight: 112, // Height of the base ground image
        lastTime: performance.now(), // For calculating deltaTime
        showFlash: false, // Flag for white screen flash on collision
        hitGround: false, // Flag for when bird hits ground after game over
        crashRotation: 0, // Stores bird rotation at the moment of crash
        scrollSpeed: INITIAL_SCROLL_SPEED,
        currentPipeGap: INITIAL_PIPE_GAP,
        currentPipeSpacing: INITIAL_PIPE_SPACING,
        playerName: localStorage.getItem('flappyPlayerName') || ''
    };

    // --- Asset Loading ---
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
    for (let i = 0; i < 10; i++) { const img = new Image(); img.src = `${i}.png`; gameState.numbers.push(img); }

    // --- Flag for Submission Debounce ---
    let isSubmitting = false;

    // --- Toast Notification ---
    function showToast(message, duration = 3000, isError = false) {
        const existingToast = document.getElementById('toast-notification');
        if (existingToast) existingToast.remove();
        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.textContent = message;
        toast.classList.add(isError ? 'error' : 'success');
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { toast.style.opacity = '1'; });
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 400);
        }, duration);
    }

    // --- Input Handling ---
    function handleInput(e) {
        if (e) e.preventDefault();
        if (gameState.gameOver || gameState.paused) return;
        if (!gameState.started) {
            gameState.started = true;
            document.getElementById('swooshSound')?.play().catch(()=>{});
        }
        gameState.bird.velocity = JUMP_FORCE;
        document.getElementById('wingSound')?.play().catch(()=>{});
    }
    // Attach listeners for game input immediately
    canvas.addEventListener('mousedown', handleInput);
    canvas.addEventListener('touchstart', handleInput, { passive: false });
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !nameInputVisible()) {
             handleInput(e);
        }
        // Handle Enter key submission
        if (e.code === 'Enter' && nameInputVisible() && submitScoreBtn) {
             e.preventDefault();
             e.stopPropagation();
             console.log("Enter key pressed, calling submitScore...");
             // Directly call submitScore, which now has the isSubmitting check
             submitScore();
             return false; // Keep for good measure
        }
    });
    // Helper to check if the name input is currently visible
    function nameInputVisible() {
        return nameInput && window.getComputedStyle(nameInput).display === 'block';
    }

    // --- Leaderboard Navigation ---
    leaderboardBtn.addEventListener('click', () => {
        window.location.href = 'leaderboard.html';
    });

    // --- Score Submission ---
    // Button to SHOW the name input panel
    addToLeaderboardBtn.addEventListener('click', () => {
        // Reset flag just in case it got stuck somehow when opening panel
        isSubmitting = false;
        if(playerNameInput) playerNameInput.value = gameState.playerName || '';
        if(nameInput) nameInput.style.display = 'block';
         // Focus the input field slightly after it becomes visible
         setTimeout(() => playerNameInput?.focus(), 0);
    });

    // ASYNC function to handle the actual submission logic
    async function submitScore() {
        // Check if already submitting
        if (isSubmitting) {
            console.log("Submission already in progress. Ignoring.");
            return;
        }
        // Set flag
        isSubmitting = true;
        console.log("Submission process started (isSubmitting = true)");

        const name = playerNameInput ? playerNameInput.value.trim() : '';
        if (!name) {
             showToast("Please enter a name.", 3000, true);
             isSubmitting = false; // Reset flag on validation error
             console.log("Submission aborted: No name provided (isSubmitting = false)");
             return;
        }

        console.log(`Submitting score ${gameState.score} for player ${name}...`);
        try {
            // *** Adjust this URL if your backend is hosted elsewhere ***
            const apiUrl = 'https://flappy-bird-backend-nw51.onrender.com/api/leaderboard'; // URL of your backend endpoint

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name: name.substring(0, 15), score: gameState.score }) // Send name (max 15 chars) and score
            });
            console.log("Fetch response status:", response.status);

            if (!response.ok) {
                // Try to parse error message from backend, otherwise use status
                const errorData = await response.json().catch(() => ({ message: 'Submission failed with status ' + response.status }));
                console.error("Submission API error:", errorData);
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            // --- On successful submission ---
            console.log("Score submitted successfully via API.");
            showToast("Score submitted successfully!"); // Show success message

            // Update local state and storage
            gameState.personalBest = Math.max(gameState.score, gameState.personalBest);
            localStorage.setItem('personalBest', gameState.personalBest.toString());
            // Save the entered name for next time
            localStorage.setItem('flappyPlayerName', name);
            gameState.playerName = name;

            // Hide the name input panel
            if(nameInput) nameInput.style.display = 'none';

            // ** IMPORTANT: Do NOT reload the page here **

        } catch (error) {
            console.error('Score submission fetch/logic failed:', error);
            showToast(`Submission failed: ${error.message}`, 4000, true); // Show error message
        } finally {
            // *** CRITICAL: Reset the flag in the finally block ***
            isSubmitting = false;
            console.log("Submission process finished (isSubmitting = false in finally block)");
        }
    }

    // --- Game Controls ---
    restartBtn.addEventListener('click', resetGame);
    pauseBtn.addEventListener('click', togglePause);

    function togglePause() {
        if (gameState.gameOver) return; // Cannot pause if game is over
        gameState.paused = !gameState.paused;
        if (!gameState.paused) {
            // Resuming: update lastTime and request next frame
            gameState.lastTime = performance.now();
            requestAnimationFrame(gameLoop);
        } else {
            // Pausing: draw pause overlay
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
        // Cancel any pending animation frame to prevent conflicts
        cancelAnimationFrame(animationFrameId);
        isSubmitting = false; // Ensure flag is reset if game resets while submitting

        // Preserve data that shouldn't be reset
        const preservedData = {
            personalBest: gameState.personalBest,
            playerName: gameState.playerName,
            numbers: gameState.numbers, // Keep loaded number images
            birdSprites: gameState.bird.sprites // Keep loaded bird images
        };

        // Reset game state to initial values
        gameState = {
            ...gameState, // Keep other properties like baseHeight if needed
            bird: {
                x: 130, y: GAME_HEIGHT / 2, velocity: 0, width: 40, height: 30,
                frame: 0, rotation: 0, sprites: preservedData.birdSprites
            },
            pipes: [], score: 0,
            gameOver: false, started: false, paused: false, baseOffset: 0,
            lastTime: performance.now(), showFlash: false, hitGround: false,
            crashRotation: 0,
            // Reset difficulty parameters
            scrollSpeed: INITIAL_SCROLL_SPEED,
            currentPipeGap: INITIAL_PIPE_GAP,
            currentPipeSpacing: INITIAL_PIPE_SPACING,
            // Restore preserved data
            personalBest: preservedData.personalBest,
            playerName: preservedData.playerName,
            numbers: preservedData.numbers
            // baseHeight will be set during init or preserved if already set
        };

        // Ensure base height is set (might be needed if reset before image loaded)
        if (assets.base.complete && assets.base.naturalHeight > 0) {
            gameState.baseHeight = assets.base.naturalHeight;
        } else {
            // If base image isn't loaded yet, set callback or use default
            assets.base.onload = () => { gameState.baseHeight = assets.base.naturalHeight || 112; };
            gameState.baseHeight = gameState.baseHeight || 112; // Use current or default
        }

        // Reset button visibility
        document.querySelectorAll('.game-button').forEach(btn => {
            // Show leaderboard and pause, hide others initially
            btn.style.display = (btn.id === 'leaderboard' || btn.id === 'pauseBtn') ? 'block' : 'none';
        });
        if(nameInput) nameInput.style.display = 'none'; // Hide name input

        // Reset audio
        document.querySelectorAll('audio').forEach(audio => { audio.pause(); audio.currentTime = 0; });

        // Remove game over overlay if it exists
        const existingOverlay = document.getElementById('gameOverOverlay');
        if (existingOverlay) existingOverlay.remove();

        // Clear score display
        if(currentScoreElement) currentScoreElement.innerHTML = '';

        // Restart the game loop
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // Position restart/add score buttons (called when game over screen shown)
    function positionElements() {
        if (!restartBtn || !addToLeaderboardBtn) return;
        // Position restart button (centered horizontally)
        if (window.getComputedStyle(restartBtn).display === 'block') {
            const restartWidth = restartBtn.offsetWidth || 100; // Use offsetWidth or fallback
            restartBtn.style.left = `${(GAME_WIDTH / 2) - (restartWidth / 2)}px`;
            restartBtn.style.top = `${GAME_HEIGHT - 160}px`; // Position from bottom
        }
         // Position add score button (centered horizontally, below restart)
         if (window.getComputedStyle(addToLeaderboardBtn).display === 'block') {
            const addWidth = addToLeaderboardBtn.offsetWidth || 170; // Use offsetWidth or fallback
            addToLeaderboardBtn.style.left = `${(GAME_WIDTH / 2) - (addWidth / 2)}px`;
            addToLeaderboardBtn.style.top = `${GAME_HEIGHT - 110}px`; // Position below restart
         }
    }

    // --- Pipe Creation ---
    function createPipe() {
        // Calculate the available vertical space for pipes (excluding base and margins)
        const usableHeight = GAME_HEIGHT - gameState.baseHeight - (PIPE_VERTICAL_MARGIN * 2);
        // Safety check: If gap is too large for available space, adjust gap down
        if (usableHeight <= gameState.currentPipeGap) {
             console.warn("Not enough usable height for pipes. Adjusting gap.");
             const adjustedGap = Math.max(MIN_PIPE_GAP, usableHeight - (MIN_PIPE_HEIGHT * 2));
             const gapCenterY = PIPE_VERTICAL_MARGIN + adjustedGap / 2 + Math.random() * (usableHeight - adjustedGap);
             const topPipeHeight = Math.max(MIN_PIPE_HEIGHT, gapCenterY - adjustedGap / 2);
             const bottomPipeY = Math.min(GAME_HEIGHT - gameState.baseHeight - MIN_PIPE_HEIGHT, gapCenterY + adjustedGap / 2);
             const bottomPipeHeight = GAME_HEIGHT - gameState.baseHeight - bottomPipeY;
              return { x: GAME_WIDTH, topHeight: topPipeHeight, bottomHeight: bottomPipeHeight, passed: false, width: PIPE_WIDTH, gap: adjustedGap };
        }
        // Normal case: Calculate center of the gap randomly within usable height
        const gapCenterY = PIPE_VERTICAL_MARGIN + gameState.currentPipeGap / 2 + Math.random() * (usableHeight - gameState.currentPipeGap);
        const topPipeHeight = Math.max(MIN_PIPE_HEIGHT, gapCenterY - gameState.currentPipeGap / 2);
        const bottomPipeY = Math.min(GAME_HEIGHT - gameState.baseHeight - MIN_PIPE_HEIGHT, gapCenterY + gameState.currentPipeGap / 2);
        const bottomPipeHeight = GAME_HEIGHT - gameState.baseHeight - bottomPipeY;
        // Return the new pipe object
        return {
             x: GAME_WIDTH, topHeight: topPipeHeight, bottomHeight: bottomPipeHeight,
             passed: false, width: PIPE_WIDTH, gap: gameState.currentPipeGap
         };
    }

    // --- Update Function (Main Game Logic) ---
    function update(deltaTime) {
        if (gameState.paused) return; // Do nothing if paused

        // Scroll base ground image continuously if not game over
        if (!gameState.gameOver) {
           const basePatternWidth = assets.base.naturalWidth || 336; // Get base image width or use default
           if (basePatternWidth > 0) {
               gameState.baseOffset = (gameState.baseOffset + BASE_SCROLL_SPEED * deltaTime) % basePatternWidth;
            }
        }

        // Animate bird flapping unless game over AND hit ground
        if (!gameState.gameOver || !gameState.hitGround) {
            gameState.bird.frame = (gameState.bird.frame + deltaTime * 12) % 3; // Cycle through 3 frames
        }

        // Game Over Logic (Bird falling after hit)
        if (gameState.gameOver) {
            if (!gameState.hitGround) { // If falling but haven't hit ground yet
                gameState.bird.velocity += GRAVITY * deltaTime * 1.8; // Apply stronger gravity when falling
                gameState.bird.y += gameState.bird.velocity * deltaTime;
                gameState.crashRotation = Math.min(90, gameState.crashRotation + 400 * deltaTime);
                gameState.bird.rotation = gameState.crashRotation;
                if (gameState.bird.y + gameState.bird.height / 2 >= GAME_HEIGHT - gameState.baseHeight) {
                    gameState.bird.y = GAME_HEIGHT - gameState.baseHeight - gameState.bird.height / 2;
                    gameState.bird.velocity = 0; gameState.hitGround = true; gameState.bird.rotation = 90;
                }
            }
            return; // Stop further updates once game is over
        }

        // Pre-Game Idle Animation (Bird floating)
        if (!gameState.started) {
            gameState.bird.y = GAME_HEIGHT / 2 + Math.sin(performance.now() / 250) * 8;
            gameState.bird.rotation = 0; gameState.bird.velocity = 0;
            return; // Stop further updates until started
        }

        // --- Gameplay Logic (Game Started and Not Over) ---
        gameState.bird.velocity += GRAVITY * deltaTime;
        gameState.bird.y += gameState.bird.velocity * deltaTime;
        if (gameState.bird.y - gameState.bird.height / 2 < 0) {
            gameState.bird.y = gameState.bird.height / 2;
            gameState.bird.velocity = Math.max(0, gameState.bird.velocity);
        }
        const targetRotation = gameState.bird.velocity * 0.1;
        gameState.bird.rotation = Math.max(-20, Math.min(90, targetRotation));

        // --- Pipe Management ---
        let generateNewPipe = gameState.pipes.length === 0;
        if (!generateNewPipe && gameState.pipes.length > 0) {
            const rightmostPipeX = Math.max(...gameState.pipes.map(p => p.x));
            if (rightmostPipeX < GAME_WIDTH - gameState.currentPipeSpacing) { generateNewPipe = true; }
        }
        if (generateNewPipe) { gameState.pipes.push(createPipe()); }

        let collisionDetected = false;
        gameState.pipes.forEach(pipe => {
            pipe.x -= gameState.scrollSpeed * deltaTime;
            if (!pipe.passed && pipe.x + pipe.width < gameState.bird.x - gameState.bird.width / 2) {
                gameState.score++; pipe.passed = true; document.getElementById('pointSound')?.play().catch(()=>{});
                if (gameState.score > 0 && gameState.score % SCORE_INTERVAL_FOR_SPEED_UP === 0) { gameState.scrollSpeed = Math.min(MAX_SCROLL_SPEED, gameState.scrollSpeed + SCROLL_SPEED_INCREMENT); }
                if (gameState.score > 0 && gameState.score % SCORE_INTERVAL_FOR_GAP_REDUCTION === 0) { gameState.currentPipeGap = Math.max(MIN_PIPE_GAP, gameState.currentPipeGap - GAP_REDUCTION_AMOUNT); }
                if (gameState.score > 0 && gameState.score % SCORE_INTERVAL_FOR_SPACING_REDUCTION === 0) { gameState.currentPipeSpacing = Math.max(MIN_PIPE_SPACING, gameState.currentPipeSpacing - SPACING_REDUCTION_AMOUNT); }
            }
            // --- Collision Detection ---
            const collisionPadding = 2;
            const birdLeft = gameState.bird.x - gameState.bird.width / 2 + collisionPadding, birdRight = gameState.bird.x + gameState.bird.width / 2 - collisionPadding;
            const birdTop = gameState.bird.y - gameState.bird.height / 2 + collisionPadding, birdBottom = gameState.bird.y + gameState.bird.height / 2 - collisionPadding;
            const pipeLeft = pipe.x, pipeRight = pipe.x + pipe.width;
            const topPipeBottom = pipe.topHeight, bottomPipeTop = GAME_HEIGHT - pipe.bottomHeight - gameState.baseHeight;
            if (birdRight > pipeLeft && birdLeft < pipeRight && (birdTop < topPipeBottom || birdBottom > bottomPipeTop)) { collisionDetected = true; }
        });
        gameState.pipes = gameState.pipes.filter(pipe => pipe.x + pipe.width > 0);
        if (!collisionDetected && gameState.bird.y + gameState.bird.height / 2 >= GAME_HEIGHT - gameState.baseHeight) {
            collisionDetected = true; gameState.bird.y = GAME_HEIGHT - gameState.baseHeight - gameState.bird.height / 2;
        }
        if (collisionDetected) { gameOver(); }
    }

    // --- gameOver Function ---
    function gameOver() {
        if (!gameState.gameOver) {
            gameState.gameOver = true; gameState.showFlash = true;
            gameState.crashRotation = gameState.bird.rotation;
            document.getElementById('hitSound')?.play().catch(()=>{});
            setTimeout(() => { document.getElementById('dieSound')?.play().catch(()=>{}); }, 100);
            if (gameState.score > gameState.personalBest) { gameState.personalBest = gameState.score; localStorage.setItem('personalBest', gameState.personalBest.toString()); }
            if(pauseBtn) pauseBtn.style.display = 'none';
        }
    }

    // --- Drawing Functions ---
    function drawBird() {
        ctx.save(); ctx.translate(gameState.bird.x, gameState.bird.y); ctx.rotate(gameState.bird.rotation * Math.PI / 180);
        const currentFrame = Math.floor(gameState.bird.frame); const sprite = gameState.bird.sprites[currentFrame];
        if (sprite && sprite.complete && sprite.naturalWidth > 0) { ctx.drawImage(sprite, -gameState.bird.width / 2, -gameState.bird.height / 2, gameState.bird.width, gameState.bird.height); }
        else { ctx.fillStyle = 'blue'; ctx.fillRect(-gameState.bird.width / 2, -gameState.bird.height / 2, gameState.bird.width, gameState.bird.height); }
        ctx.restore();
    }
    function drawBase() {
        const baseY = GAME_HEIGHT - gameState.baseHeight; const patternWidth = assets.base.naturalWidth || 336;
        if (patternWidth <= 0 || !assets.base.complete) return;
        for (let x = -gameState.baseOffset; x < GAME_WIDTH; x += patternWidth) ctx.drawImage(assets.base, x, baseY, patternWidth, gameState.baseHeight);
    }
    function drawPipes() {
        gameState.pipes.forEach(pipe => {
            if (assets.pipeTop.complete && assets.pipeTop.naturalWidth > 0) { ctx.drawImage(assets.pipeTop, pipe.x, 0, PIPE_WIDTH, pipe.topHeight); }
            else { ctx.fillStyle = '#543847'; ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight); }
            const bottomPipeY = GAME_HEIGHT - pipe.bottomHeight - gameState.baseHeight;
            if (assets.pipeBottom.complete && assets.pipeBottom.naturalWidth > 0) { ctx.drawImage(assets.pipeBottom, pipe.x, bottomPipeY, PIPE_WIDTH, pipe.bottomHeight); }
            else { ctx.fillStyle = '#543847'; ctx.fillRect(pipe.x, bottomPipeY, PIPE_WIDTH, pipe.bottomHeight); }
        });
    }
    function drawScore() {
         if (!gameState.started || gameState.gameOver || !gameState.numbers.every(img => img.complete)) { if(currentScoreElement) currentScoreElement.innerHTML = ''; return; }
         if(currentScoreElement) currentScoreElement.innerHTML = '';
         gameState.score.toString().split('').forEach(digit => {
             const numIndex = parseInt(digit);
             if (gameState.numbers[numIndex]) { const img = document.createElement('img'); img.src = gameState.numbers[numIndex].src; img.className = 'score-digit'; if(currentScoreElement) currentScoreElement.appendChild(img); }
         });
    }

    // --- Main Draw Function ---
    function draw() {
        if (!ctx) { console.error("Canvas context lost!"); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (assets.background.complete && assets.background.naturalWidth > 0) { ctx.drawImage(assets.background, 0, 0, canvas.width, canvas.height); }
        else { ctx.fillStyle = '#70c5ce'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        drawPipes();
        if (gameState.baseHeight > 0) drawBase();
        if (gameState.showFlash) { ctx.fillStyle = 'rgba(255, 255, 255, 1)'; ctx.fillRect(0, 0, canvas.width, canvas.height); gameState.showFlash = false; }
        if (!gameState.started && !gameState.gameOver && assets.background.complete) {
             ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
             ctx.fillText("Get Ready!", canvas.width / 2, canvas.height / 2 - 50);
             ctx.font = "20px Arial"; ctx.fillText("Tap or Space to Jump", canvas.width / 2, canvas.height / 2);
        }
        if (gameState.bird.sprites.every(s => s.complete)) {
             if (gameState.gameOver) {
                 ctx.save(); ctx.translate(gameState.bird.x, gameState.bird.y); ctx.rotate(gameState.bird.rotation * Math.PI / 180);
                 ctx.drawImage(gameState.bird.sprites[1], -gameState.bird.width / 2, -gameState.bird.height / 2, gameState.bird.width, gameState.bird.height);
                 ctx.restore();
                 if (gameState.hitGround) {
                     if (assets.gameOverImg.complete && assets.gameOverImg.naturalWidth > 0) {
                         // Draw game over image (scaled)
                         const scale = 0.35;
                         const imgWidth = assets.gameOverImg.naturalWidth * scale;
                         const imgHeight = assets.gameOverImg.naturalHeight * scale;
                         // *** THIS VALUE CONTROLS THE 'gameover.png' VERTICAL POSITION ***
                         ctx.drawImage(assets.gameOverImg, canvas.width / 2 - imgWidth / 2, canvas.height * 0.14, imgWidth, imgHeight); // <-- Changed 0.20 to 0.15
                     }
                     // Show the HTML overlay with scores/buttons if not already shown
                     if (!document.getElementById('gameOverOverlay')) {
                         showGameOverScreen();
                     }
                 }
             } else { drawBird(); }
        } else { drawBird(); } // Fallback drawing if sprites not loaded
        drawScore();
    }

    // --- Show Game Over Screen ---
    function showGameOverScreen() {
        if (document.getElementById('gameOverOverlay')) return;
        const overlay = document.createElement('div'); overlay.id = 'gameOverOverlay';
        const scoreContainer = document.createElement('div'); scoreContainer.className = 'score-display-box';
        function createScoreLineWithImages(scoreValue) {
            const lineDiv = document.createElement('div'); lineDiv.className = 'score-line';
            const numbersDiv = document.createElement('div'); numbersDiv.style.display = 'inline-block'; numbersDiv.style.verticalAlign = 'middle';
            scoreValue.toString().split('').forEach(digit => {
                 const numIndex = parseInt(digit);
                 if (gameState.numbers[numIndex] && gameState.numbers[numIndex].complete) { const img = document.createElement('img'); img.src = gameState.numbers[numIndex].src; img.className = 'score-digit'; numbersDiv.appendChild(img); }
                 else { const span = document.createElement('span'); span.textContent = digit; span.style.cssText = 'display: inline-block; width: 24px; text-align: center; font-family: monospace; font-size: 30px; line-height: 36px; vertical-align: middle; color: #FFF;'; numbersDiv.appendChild(span); }
            }); lineDiv.appendChild(numbersDiv); return lineDiv;
        }
        scoreContainer.appendChild(createScoreLineWithImages(gameState.score));
        scoreContainer.appendChild(createScoreLineWithImages(gameState.personalBest));
        overlay.appendChild(scoreContainer);
        if (gameContainer) { gameContainer.appendChild(overlay); } else { document.body.appendChild(overlay); }
        if(restartBtn) restartBtn.style.display = 'block'; if(addToLeaderboardBtn) addToLeaderboardBtn.style.display = 'block';
        positionElements();
    }

    // --- Game Loop ---
    let animationFrameId;
    function gameLoop(currentTime) {
        if (gameState.paused && !gameState.gameOver) { animationFrameId = requestAnimationFrame(gameLoop); return; }
        const deltaTime = Math.min(0.05, (currentTime - gameState.lastTime) / 1000); gameState.lastTime = currentTime;
        try { update(deltaTime); draw(); }
        catch (error) { console.error('Game loop error:', error); cancelAnimationFrame(animationFrameId); showToast("A critical game error occurred.", 10000, true); return; }
        if (!(gameState.gameOver && gameState.hitGround)) { animationFrameId = requestAnimationFrame(gameLoop); }
        else { console.log("Game loop stopped (Game Over sequence complete)."); }
    }

    // --- Initialization ---
    let assetsLoadedCount = 0;
    const totalAssets = Object.values(assets).length + gameState.bird.sprites.length + gameState.numbers.length;
    let gameInitialized = false;

    function initializeGame() {
         if (gameInitialized) return;
         gameInitialized = true;
         console.log("Initializing game...");
         canvas.width = GAME_WIDTH; canvas.height = GAME_HEIGHT;
         if (!ctx) { console.error("Failed to get 2D context"); loaderElement.innerHTML = "<p>Error: Canvas not supported.</p>"; return; }
         if (assets.base.complete && assets.base.naturalHeight > 0) { gameState.baseHeight = assets.base.naturalHeight; }
         else { assets.base.onload = () => { gameState.baseHeight = assets.base.naturalHeight || 112; }; gameState.baseHeight = 112; }
         if(leaderboardBtn) leaderboardBtn.style.display = 'block'; if(pauseBtn) pauseBtn.style.display = 'block';
         const storedBest = localStorage.getItem('personalBest'); if (storedBest) gameState.personalBest = parseInt(storedBest, 10) || 0;
         gameState.playerName = localStorage.getItem('flappyPlayerName') || '';

         // Add input listener for Enter key in name field
         if (playerNameInput) {
             playerNameInput.addEventListener('keydown', (e) => {
                 if (e.key === 'Enter') {
                     e.preventDefault();
                     submitScore();
                 }
             });
         }

         // Ensure submit button click handler
         if (submitScoreBtn && !submitScoreBtn.listenerAttached) {
             submitScoreBtn.addEventListener('click', (e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 submitScore();
             });
             submitScoreBtn.listenerAttached = true;
         }

         positionElements();
         if (loaderElement) loaderElement.style.display = 'none'; if (contentWrapper) contentWrapper.style.display = 'flex';
         document.body.style.overflow = 'auto';
         gameState.lastTime = performance.now();
         animationFrameId = requestAnimationFrame(gameLoop);
         console.log("Game loop started.");
    }

    // --- Asset Loading Logic ---
    function assetLoaded() {
        if (gameInitialized) return; assetsLoadedCount++;
        if (assetsLoadedCount === totalAssets) { console.log("All assets reported loaded or failed."); if (!gameInitialized) { setTimeout(initializeGame, 50); } }
    }
    function setupAssetLoading(img) {
        img.dataset.loadChecked = 'false';
        if (img.complete && img.naturalWidth !== undefined && img.naturalWidth > 0) { img.dataset.loadChecked = 'true'; assetLoaded(); }
        else if (img.complete && img.naturalWidth === 0) { console.error(`Asset failed (0 width): ${img.src}`); img.dataset.loadChecked = 'true'; assetLoaded(); }
        else {
            img.onload = () => { if (img.dataset.loadChecked === 'false') { img.dataset.loadChecked = 'true'; assetLoaded(); } };
            img.onerror = () => { if (img.dataset.loadChecked === 'false') { console.error(`Asset failed via onerror: ${img.src}`); img.dataset.loadChecked = 'true'; assetLoaded(); } };
        }
    }
    Object.values(assets).forEach(setupAssetLoading);
    gameState.bird.sprites.forEach(setupAssetLoading);
    gameState.numbers.forEach(setupAssetLoading);
    setTimeout(() => { if (!gameInitialized) { console.warn(`Asset loading timeout (${assetsLoadedCount}/${totalAssets}). Forcing initialization...`); initializeGame(); } }, 8000);

}); // End DOMContentLoaded listener
