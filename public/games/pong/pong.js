function create_pong(opts) {
  const { container, send, myName, opponentName, isHost } = opts;
  const exitBtn = `<button class="btn secondary" id="pongExit" style="margin-top:12px">Выйти в меню</button>`;
  const startBtn = `<button class="btn primary" id="pongStart" style="margin-top:12px">Начать игру</button>`;
  container.innerHTML = `
    <div class="pong-wrapper">
      <div class="pong-scores">
        <span id="pongMyName">${myName}</span>
        <span class="pong-score" id="pongMyScore">0</span>
        <span class="pong-dash">:</span>
        <span class="pong-score" id="pongOppScore">0</span>
        <span id="pongOppName">${opponentName}</span>
      </div>
      <canvas id="pongCanvas"></canvas>
      <div class="pong-controls">
        <button class="dpad-btn" data-action="up">↑</button>
        <button class="dpad-btn" data-action="down">↓</button>
      </div>
      ${isHost ? startBtn : exitBtn}
    </div>
    <div id="pongOverlay" class="tetris-overlay hidden">
      <div class="tetris-overlay-content">
        <h2 id="pongOverlayTitle"></h2><p id="pongOverlayMsg"></p>
        <button class="btn primary" id="pongOverlayBtn">OK</button>
      </div>
    </div>`;
  const canvas = document.getElementById("pongCanvas"); const ctx = canvas.getContext("2d");
  let lastPongScore = null;
  function resize() { const s = Math.min((window.innerWidth - 40) / 600, (window.innerHeight - 200) / 400, 1); canvas.width = 600 * s; canvas.height = 400 * s; ctx.setTransform(s, 0, 0, s, 0, 0); }
  resize(); window.addEventListener("resize", resize);

  if (isHost) {
    document.getElementById("pongStart").onclick = () => { send({ type: "game-action", action: "start" }); document.getElementById("pongStart").style.display = "none"; };
  } else {
    document.getElementById("pongExit").onclick = () => document.getElementById("backToMenu").click();
  }

  document.querySelectorAll(".pong-controls .dpad-btn").forEach(btn => {
    const a = btn.dataset.action;
    const r = () => { send({ type: "game-action", action: a }); btn._t = setTimeout(r, 16); };
    btn.addEventListener("touchstart", e => { e.preventDefault(); r(); }); btn.addEventListener("touchend", () => clearTimeout(btn._t));
    btn.addEventListener("mousedown", () => r()); btn.addEventListener("mouseup", () => clearTimeout(btn._t));
  });
  const keyHandler = e => {
    if (e.key === "ArrowUp" || e.key === "w") { send({ type: "game-action", action: "up" }); e.preventDefault(); }
    else if (e.key === "ArrowDown" || e.key === "s") { send({ type: "game-action", action: "down" }); e.preventDefault(); }
  };
  document.addEventListener("keydown", keyHandler);
  document.getElementById("pongOverlayBtn").onclick = () => document.getElementById("pongOverlay").classList.add("hidden");
  function onState(s) {
    // Score change sound
    if (lastPongScore !== undefined) {
      if (s.myScore > lastPongScore.my) sfx.score();
      if (s.opponentScore > lastPongScore.opp) sfx.lose();
    }
    lastPongScore = { my: s.myScore, opp: s.opponentScore };

    ctx.fillStyle = "#0a0a1a"; ctx.fillRect(0, 0, 600, 400);
    ctx.setLineDash([8, 8]); ctx.strokeStyle = "#2d2d5a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(300, 0); ctx.lineTo(300, 400); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#6c5ce7"; if (s.paddle) ctx.fillRect(20, s.paddle.y, s.padW, s.padH);
    ctx.fillStyle = "#00cec9"; if (s.opponentPaddle) ctx.fillRect(580 - s.padW, s.opponentPaddle.y, s.padW, s.padH);
    ctx.fillStyle = "#dfe6e9"; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, s.ballR, 0, Math.PI * 2); ctx.fill();
    document.getElementById("pongMyScore").textContent = s.myScore;
    document.getElementById("pongOppScore").textContent = s.opponentScore;
    document.getElementById("pongMyName").textContent = s.myName;
    document.getElementById("pongOppName").textContent = s.opponentName;
  }
  function onGameOver(msg) {
    document.getElementById("pongOverlayTitle").textContent = "Игра окончена!";
    document.getElementById("pongOverlayMsg").textContent = msg.reason;
    document.getElementById("pongOverlay").classList.remove("hidden");
    const startBtn = document.getElementById("pongStart");
    if (startBtn) startBtn.style.display = "";
  }
  function onOpponentLeft() { document.getElementById("pongOverlayTitle").textContent = "Противник вышел"; document.getElementById("pongOverlayMsg").textContent = ""; document.getElementById("pongOverlay").classList.remove("hidden"); }
  function destroy() { document.removeEventListener("keydown", keyHandler); window.removeEventListener("resize", resize); container.innerHTML = ""; }
  return { onState, onGameOver, onOpponentLeft, destroy };
}
