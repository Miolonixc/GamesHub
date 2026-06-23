function create_connect4(opts) {
  const { container, send, myName, opponentName, isHost } = opts;
  const startBtn = isHost ? `<button class="btn primary" id="c4Start">Начать игру</button>` : `<button class="btn secondary" id="c4Exit">Выйти в меню</button>`;
  container.innerHTML = `
    <div class="c4-wrapper">
      <div class="c4-scores">
        <span class="c4-pname c4-p1">${myName}</span>
        <span id="c4Wins">0</span>
        <span class="c4-dash">|</span>
        <span class="c4-draws" id="c4Draws">0</span>
        <span class="c4-dash">|</span>
        <span id="c4OppWins">0</span>
        <span class="c4-pname c4-p2">${opponentName}</span>
      </div>
      <div class="c4-status" id="c4Status">${isHost ? 'Нажми "Начать"' : 'Ожидание...'}</div>
      <div class="c4-col-select" id="c4ColSelect">${Array(7).fill(0).map((_, i) => `<div class="c4-col-btn" data-col="${i}">▼</div>`).join("")}</div>
      <div class="c4-board" id="c4Board"></div>
      ${startBtn}
    </div>`;
  if (isHost) {
    document.getElementById("c4Start").onclick = () => send({ type: "game-action", action: "start" });
  } else {
    document.getElementById("c4Exit").onclick = () => document.getElementById("backToMenu").click();
  }
  document.querySelectorAll(".c4-col-btn").forEach(b => b.onclick = () => send({ type: "game-action", action: "drop", data: { col: parseInt(b.dataset.col) } }));
  function onState(s) {
    const board = document.getElementById("c4Board"); board.innerHTML = "";
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      const d = document.createElement("div"); d.className = "c4-cell";
      if (s.board[r][c] === 1) d.classList.add("c4-red");
      else if (s.board[r][c] === 2) d.classList.add("c4-yellow");
      if (s.winCells && s.winCells.some(([wr, wc]) => wr === r && wc === c)) d.classList.add("c4-win");
      board.appendChild(d);
    }
    document.getElementById("c4Wins").textContent = s.wins;
    document.getElementById("c4Draws").textContent = s.draws;
    const st = document.getElementById("c4Status");
    if (s.gameOver) { st.textContent = s.winCells ? `${s.myDisc === 1 ? s.myName : s.opponentName} победил!` : "Ничья!"; }
    else if (s.isMyTurn) { st.textContent = "Твой ход! (жёлтый)"; st.style.color = "#fdcb6e"; }
    else { st.textContent = "Ход противника... (красный)"; st.style.color = "#d63031"; }
  }
  function onGameOver(msg) { document.getElementById("c4Status").textContent = msg.reason; document.getElementById("c4Status").style.color = "#6c5ce7"; }
  function onOpponentLeft() { document.getElementById("c4Status").textContent = "Противник вышел"; }
  function destroy() { container.innerHTML = ""; }
  return { onState, onGameOver, onOpponentLeft, destroy };
}
