function create_tictactoe(opts) {
  const { container, send, myName, opponentName, isHost } = opts;
  const startBtn = isHost ? `<button class="btn primary" id="tttStart">Начать игру</button>` : `<button class="btn secondary" id="tttExit">Выйти в меню</button>`;
  container.innerHTML = `
    <div class="ttt-wrapper">
      <div class="ttt-scores">
        <span class="ttt-pname ttt-x">${myName} (X)</span>
        <span id="tttWins">0</span>
        <span class="ttt-dash">|</span>
        <span class="ttt-draws" id="tttDraws">0</span>
        <span class="ttt-dash">|</span>
        <span id="tttOppWins">0</span>
        <span class="ttt-pname ttt-o">${opponentName} (O)</span>
      </div>
      <div class="ttt-status" id="tttStatus">${isHost ? 'Нажми "Начать"' : 'Ожидание...'}</div>
      <div class="ttt-board" id="tttBoard">${Array(9).fill(0).map((_, i) => `<div class="ttt-cell" data-cell="${i}"></div>`).join("")}</div>
      ${startBtn}
    </div>`;
  if (isHost) {
    document.getElementById("tttStart").onclick = () => send({ type: "game-action", action: "start" });
  } else {
    document.getElementById("tttExit").onclick = () => document.getElementById("backToMenu").click();
  }
  document.querySelectorAll(".ttt-cell").forEach(c => c.onclick = () => send({ type: "game-action", action: "move", data: { cell: parseInt(c.dataset.cell) } }));
  function onState(s) {
    document.querySelectorAll(".ttt-cell").forEach((c, i) => {
      c.textContent = s.board[i] || ""; c.className = "ttt-cell";
      if (s.board[i]) c.classList.add("ttt-" + s.board[i].toLowerCase());
      if (!s.gameOver && s.isMyTurn && !s.board[i]) c.classList.add("ttt-avail");
      if (s.winLine && s.winLine.includes(i)) c.classList.add("ttt-win");
    });
    document.getElementById("tttWins").textContent = s.wins;
    document.getElementById("tttDraws").textContent = s.draws;
    const st = document.getElementById("tttStatus");
    if (s.gameOver) { st.textContent = s.winLine ? `${s.myMark === "X" ? s.myName : s.opponentName} победил!` : "Ничья!"; }
    else if (s.isMyTurn) { st.textContent = "Твой ход!"; st.style.color = "#00cec9"; }
    else { st.textContent = "Ход противника..."; st.style.color = "#636e72"; }
  }
  function onGameOver(msg) { document.getElementById("tttStatus").textContent = msg.reason; document.getElementById("tttStatus").style.color = "#6c5ce7"; }
  function onOpponentLeft() { document.getElementById("tttStatus").textContent = "Противник вышел"; }
  function destroy() { container.innerHTML = ""; }
  return { onState, onGameOver, onOpponentLeft, destroy };
}
