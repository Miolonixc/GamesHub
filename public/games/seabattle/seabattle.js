function create_seabattle(opts) {
  const { container, send, myName, opponentName, isHost } = opts;

  container.innerHTML = `
    <div class="sb-wrapper">
      <div class="sb-info">
        <span class="sb-my">${myName}</span> vs <span class="sb-opp">${opponentName}</span>
      </div>
      <div class="sb-phase" id="sbPhase">Расстановка кораблей (автоматическая)</div>
      <div class="sb-grids">
        <div class="sb-grid-block">
          <div class="sb-grid-label">Твоё поле</div>
          <div class="sb-grid" id="sbMyGrid"></div>
          <div class="sb-stats" id="sbMyStats"></div>
        </div>
        <div class="sb-grid-block">
          <div class="sb-grid-label">Поле противника</div>
          <div class="sb-grid sb-grid-enemy" id="sbEnemyGrid"></div>
          <div class="sb-stats" id="sbEnemyStats">Кораблей: 4</div>
        </div>
      </div>
      <button class="btn primary" id="sbReady" style="margin-top:12px">Готов!</button>
    </div>`;

  const buildGrid = (elId, clickable) => {
    const el = document.getElementById(elId);
    el.innerHTML = "";
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = document.createElement("div");
        cell.className = "sb-cell";
        cell.dataset.row = r;
        cell.dataset.col = c;
        if (clickable) {
          cell.onclick = () => {
            if (!cell.classList.contains("sb-hit") && !cell.classList.contains("sb-miss")) {
              send({ type: "game-action", action: "sb-shoot", data: { row: r, col: c } });
            }
          };
        }
        el.appendChild(cell);
      }
    }
  };

  buildGrid("sbMyGrid", false);
  buildGrid("sbEnemyGrid", true);

  document.getElementById("sbReady").onclick = () => {
    send({ type: "game-action", action: "sb-ready" });
    document.getElementById("sbReady").style.display = "none";
  };

  // Auto-ready since ships are auto-placed
  setTimeout(() => {
    send({ type: "game-action", action: "sb-ready" });
    document.getElementById("sbReady").style.display = "none";
  }, 500);

  let lastShotCount = 0;
  function onState(s) {
    const phase = document.getElementById("sbPhase");
    if (s.phase === "placing") {
      phase.textContent = "Ожидание готовности...";
      return;
    }

    // Shot sound
    if (s.myShots.length > lastShotCount) {
      const last = s.myShots[s.myShots.length - 1];
      if (s.enemyGrid[last[0]][last[1]] === 2) sfx.hit();
      else sfx.miss();
    }
    lastShotCount = s.myShots.length;

    phase.textContent = s.isMyTurn ? "Твой ход! Стреляй!" : "Ход противника...";
    phase.style.color = s.isMyTurn ? "#00cec9" : "#636e72";

    // My grid
    const myCells = document.getElementById("sbMyGrid").children;
    s.myGrid.forEach((row, r) => row.forEach((cell, c) => {
      const el = myCells[r * 10 + c];
      el.className = "sb-cell";
      if (cell === 1) el.classList.add("sb-ship");
      else if (cell === 2) el.classList.add("sb-hit");
      else if (cell === 3) el.classList.add("sb-miss");
    }));

    // Enemy grid
    const enemyCells = document.getElementById("sbEnemyGrid").children;
    s.enemyGrid.forEach((row, r) => row.forEach((cell, c) => {
      const el = enemyCells[r * 10 + c];
      el.className = "sb-cell";
      if (cell === 2) el.classList.add("sb-hit");
      else if (cell === 3) el.classList.add("sb-miss");
    }));

    document.getElementById("sbMyStats").textContent = `Попаданий: ${s.myHits} | Промахов: ${s.myMisses}`;

    let hits = 0;
    s.enemyGrid.forEach(row => row.forEach(c => { if (c === 2) hits++; }));
    document.getElementById("sbEnemyStats").textContent = `Попаданий: ${hits}`;
  }

  function onGameOver(msg) {
    document.getElementById("sbPhase").textContent = msg.reason;
    document.getElementById("sbPhase").style.color = "#6c5ce7";
  }

  function onOpponentLeft() {
    document.getElementById("sbPhase").textContent = "Противник вышел";
  }

  function destroy() { container.innerHTML = ""; }

  return { onState, onGameOver, onOpponentLeft, destroy };
}
