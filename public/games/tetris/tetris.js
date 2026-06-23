function create_tetris(opts) {
  const { container, send, myName, opponentName, isHost } = opts;

  if (isHost) {
    container.innerHTML = `
      <div class="tetris-mode-select">
        <h2>Режим Тетриса</h2>
        <button class="btn primary" id="tetrisBattle">⚔️ Battle</button>
        <button class="btn secondary" id="tetrisCoop">🤝 Co-op</button>
      </div>`;
    document.getElementById("tetrisBattle").onclick = () => startMode("battle");
    document.getElementById("tetrisCoop").onclick = () => startMode("coop");
  } else {
    container.innerHTML = `
      <div class="tetris-mode-select">
        <h2>Ожидание выбора режима...</h2>
        <div class="spinner"></div>
        <button class="btn secondary" id="tetrisExit" style="margin-top:16px">Выйти в меню</button>
      </div>`;
    document.getElementById("tetrisExit").onclick = () => document.getElementById("backToMenu").click();
  }

  let mode = null, canvas, ctx, miniCanvas, miniCtx, cellSize = 0, miniCellSize = 0, lastState = null;

  function startMode(m) {
    mode = m;
    send({ type: "game-action", action: "set-mode", data: { mode: m } });
    buildUI(); setupControls();
  }

  function buildUI() {
    const isCoop = mode === "coop";
    container.innerHTML = `
      <div class="tetris-wrapper">
        <div class="tetris-board-area">
          <div class="tetris-info left">
            <div class="stat"><span class="label">Очки</span><span id="tScore">0</span></div>
            <div class="stat"><span class="label">Линии</span><span id="tLines">0</span></div>
            <div class="stat"><span class="label">Уровень</span><span id="tLevel">1</span></div>
          </div>
          <div class="tetris-main-board"><canvas id="tetrisCanvas"></canvas></div>
          <div class="tetris-info right">
            <div class="stat"><span class="label">Следующая</span></div>
            <canvas id="tetrisMini" width="80" height="80"></canvas>
            ${!isCoop ? `<div class="stat" style="margin-top:16px"><span class="label">Противник</span></div>
            <canvas id="tetrisOpp" width="80" height="160"></canvas>
            <div class="stat"><span id="tOppScore" class="opp-score">0</span></div>` : ""}
            ${isCoop ? `<div class="stat" style="margin-top:16px"><span class="label" id="tTurnLabel">Ход: ...</span></div>` : ""}
          </div>
        </div>
        <div class="tetris-dpad">
          <button class="dpad-btn" data-action="rotate">↻</button>
          <div class="dpad-row">
            <button class="dpad-btn" data-action="left">←</button>
            <button class="dpad-btn" data-action="drop">⤓</button>
            <button class="dpad-btn" data-action="right">→</button>
          </div>
          <button class="dpad-btn" data-action="softDrop">↓</button>
        </div>
      </div>
      <div id="tetrisOverlay" class="tetris-overlay hidden">
        <div class="tetris-overlay-content">
          <h2 id="overlayTitle"></h2><p id="overlayMsg"></p>
          <button class="btn primary" id="overlayBtn">OK</button>
        </div>
      </div>`;
    canvas = document.getElementById("tetrisCanvas");
    ctx = canvas.getContext("2d");
    miniCanvas = document.getElementById("tetrisMini");
    miniCtx = miniCanvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    document.querySelectorAll(".dpad-btn").forEach(btn => {
      const action = btn.dataset.action;
      const repeat = () => { send({ type: "game-action", action }); btn._t = setTimeout(repeat, 16); };
      btn.addEventListener("touchstart", e => { e.preventDefault(); repeat(); });
      btn.addEventListener("touchend", () => clearTimeout(btn._t));
      btn.addEventListener("mousedown", e => { e.preventDefault(); repeat(); });
      btn.addEventListener("mouseup", () => clearTimeout(btn._t));
      btn.addEventListener("mouseleave", () => clearTimeout(btn._t));
    });
    document.getElementById("overlayBtn").onclick = () => document.getElementById("tetrisOverlay").classList.add("hidden");
  }

  function resizeCanvas() {
    const maxH = window.innerHeight - 160, maxW = window.innerWidth - 200;
    cellSize = Math.min(Math.floor(maxW / 10), Math.floor(maxH / 20), 28);
    canvas.width = 10 * cellSize; canvas.height = 20 * cellSize;
    miniCellSize = Math.floor(cellSize * 0.4);
    miniCanvas.width = 4 * miniCellSize; miniCanvas.height = 4 * miniCellSize;
    const oppCanvas = document.getElementById("tetrisOpp");
    if (oppCanvas) { const oc = Math.floor(cellSize * 0.35); oppCanvas.width = 10 * oc; oppCanvas.height = 20 * oc; }
  }

  function setupControls() { document.addEventListener("keydown", keyHandler); }
  function keyHandler(e) {
    if (!mode) return;
    switch (e.key) {
      case "ArrowLeft": send({ type: "game-action", action: "left" }); e.preventDefault(); break;
      case "ArrowRight": send({ type: "game-action", action: "right" }); e.preventDefault(); break;
      case "ArrowUp": send({ type: "game-action", action: "rotate" }); e.preventDefault(); break;
      case "ArrowDown": send({ type: "game-action", action: "softDrop" }); e.preventDefault(); break;
      case " ": send({ type: "game-action", action: "drop" }); e.preventDefault(); break;
    }
  }

  const PIECE_COLORS = { I: "#00cec9", O: "#fdcb6e", T: "#6c5ce7", S: "#00b894", Z: "#d63031", J: "#0984e3", L: "#e17055" };
  const CELL_COLORS = { 1: "#6c5ce7", 2: "#00cec9", 3: "#fdcb6e", 4: "#e17055", 5: "#00b894", 6: "#0984e3", 7: "#d63031", 9: "#636e72" };

  function onState(state) {
    lastState = state;
    if (!ctx && state.mode) {
      mode = state.mode;
      buildUI();
      setupControls();
    }
    if (!ctx) return;
    const COLS = 10, ROWS = 20;
    ctx.fillStyle = "#0a0a1a"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a3a"; ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, ROWS * cellSize); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(COLS * cellSize, y * cellSize); ctx.stroke(); }

    const board = state.mode === "coop" ? state.board : state.board;
    for (let y = 0; y < board.length; y++) for (let x = 0; x < COLS; x++) {
      if (board[y][x]) { ctx.fillStyle = CELL_COLORS[board[y][x]] || "#6c5ce7"; ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2); }
    }

    if ((state.mode === "coop" || state.alive) && state.current) {
      const ghostY = findGhostY(board, state.current, COLS, ROWS);
      if (ghostY !== state.current.y) {
        ctx.globalAlpha = 0.25; ctx.fillStyle = PIECE_COLORS[state.current.key] || "#6c5ce7";
        state.current.shape.forEach(([x, y]) => { if (ghostY + y >= 0) ctx.fillRect((state.current.x + x) * cellSize + 1, (ghostY + y) * cellSize + 1, cellSize - 2, cellSize - 2); });
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = PIECE_COLORS[state.current.key] || "#6c5ce7";
      state.current.shape.forEach(([x, y]) => { if (state.current.y + y >= 0) ctx.fillRect((state.current.x + x) * cellSize + 1, (state.current.y + y) * cellSize + 1, cellSize - 2, cellSize - 2); });
    }

    miniCtx.fillStyle = "#0a0a1a"; miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);
    if (state.next) {
      const shapes = { T: [[0,0],[1,0],[2,0],[1,1]], O: [[0,0],[1,0],[0,1],[1,1]], I: [[0,0],[1,0],[2,0],[3,0]], S: [[1,0],[2,0],[0,1],[1,1]], Z: [[0,0],[1,0],[1,1],[2,1]], J: [[0,0],[1,0],[2,0],[0,1]], L: [[0,0],[1,0],[2,0],[2,1]] };
      const shape = shapes[state.next]; if (shape) {
        const mx = Math.max(...shape.map(p => p[0])), my = Math.max(...shape.map(p => p[1]));
        const ox = Math.floor((miniCanvas.width - (mx + 1) * miniCellSize) / 2);
        const oy = Math.floor((miniCanvas.height - (my + 1) * miniCellSize) / 2);
        miniCtx.fillStyle = PIECE_COLORS[state.next]; shape.forEach(([x, y]) => miniCtx.fillRect(ox + x * miniCellSize + 1, oy + y * miniCellSize + 1, miniCellSize - 2, miniCellSize - 2));
      }
    }

    document.getElementById("tScore").textContent = state.score;
    document.getElementById("tLines").textContent = state.lines;
    document.getElementById("tLevel").textContent = state.level;

    if (state.mode === "coop") {
      document.getElementById("tTurnLabel").textContent = `Ход: ${state.currentPlayerName}`;
    } else {
      const oppCanvas = document.getElementById("tetrisOpp");
      if (oppCanvas && state.opponentBoard) {
        const oppCtx = oppCanvas.getContext("2d"); const oc = Math.floor(cellSize * 0.35);
        oppCtx.fillStyle = "#0a0a1a"; oppCtx.fillRect(0, 0, oppCanvas.width, oppCanvas.height);
        for (let y = 0; y < state.opponentBoard.length; y++) for (let x = 0; x < COLS; x++) {
          if (state.opponentBoard[y][x]) { oppCtx.fillStyle = CELL_COLORS[state.opponentBoard[y][x]] || "#6c5ce7"; oppCtx.fillRect(x * oc + 1, y * oc + 1, oc - 2, oc - 2); }
        }
        document.getElementById("tOppScore").textContent = state.opponentScore;
      }
    }
  }

  function findGhostY(board, current, cols, rows) {
    let gy = current.y;
    while (true) {
      let hit = false;
      current.shape.forEach(([x, y]) => { const nx = current.x + x, ny = gy + 1 + y; if (nx < 0 || nx >= cols || ny >= rows || (ny >= 0 && board[ny] && board[ny][nx])) hit = true; });
      if (hit) break; gy++;
    }
    return gy;
  }

  function onGameOver(msg) {
    document.getElementById("overlayTitle").textContent = msg.winner ? "Победа!" : "Ничья!";
    document.getElementById("overlayMsg").textContent = msg.reason;
    document.getElementById("tetrisOverlay").classList.remove("hidden");
  }

  function onOpponentLeft() {
    document.getElementById("overlayTitle").textContent = "Противник вышел";
    document.getElementById("overlayMsg").textContent = "";
    document.getElementById("tetrisOverlay").classList.remove("hidden");
  }

  function destroy() { document.removeEventListener("keydown", keyHandler); window.removeEventListener("resize", resizeCanvas); container.innerHTML = ""; }

  return { onState, onGameOver, onOpponentLeft, destroy };
}
