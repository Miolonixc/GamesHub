function create_memory(opts) {
  const { container, send, myName, opponentName, isHost } = opts;
  const startBtn = isHost ? `<button class="btn primary" id="memStart">Начать игру</button>` : `<button class="btn secondary" id="memExit">Выйти в меню</button>`;
  container.innerHTML = `
    <div class="mem-wrapper">
      <div class="mem-scores">
        <span class="mem-pname mem-p1">${myName}</span>
        <span id="memMyScore">0</span>
        <span class="mem-dash">:</span>
        <span id="memOppScore">0</span>
        <span class="mem-pname mem-p2">${opponentName}</span>
      </div>
      <div class="mem-status" id="memStatus">${isHost ? 'Нажми "Начать"' : 'Ожидание...'}</div>
      <div class="mem-board" id="memBoard"></div>
      ${startBtn}
    </div>`;
  if (isHost) {
    document.getElementById("memStart").onclick = () => send({ type: "game-action", action: "start" });
  } else {
    document.getElementById("memExit").onclick = () => document.getElementById("backToMenu").click();
  }
  function onState(s) {
    const board = document.getElementById("memBoard"); board.innerHTML = "";
    s.cards.forEach(c => {
      const d = document.createElement("div"); d.className = "mem-card";
      if (c.matched) d.classList.add("mem-matched");
      d.textContent = c.emoji || "?";
      if (c.emoji) d.classList.add("mem-flipped");
      d.onclick = () => send({ type: "game-action", action: "flip", data: { idx: c.id } });
      board.appendChild(d);
    });
    document.getElementById("memMyScore").textContent = s.myScore;
    document.getElementById("memOppScore").textContent = s.opponentScore;
    const st = document.getElementById("memStatus");
    if (s.gameOver) { st.textContent = s.myScore > s.opponentScore ? "Ты победил!" : s.opponentScore > s.myScore ? "Противник победил!" : "Ничья!"; st.style.color = "#6c5ce7"; }
    else if (s.isMyTurn) { st.textContent = "Твой ход!"; st.style.color = "#00cec9"; }
    else { st.textContent = "Ход противника..."; st.style.color = "#636e72"; }
  }
  function onGameOver(msg) { document.getElementById("memStatus").textContent = msg.reason; document.getElementById("memStatus").style.color = "#6c5ce7"; }
  function onOpponentLeft() { document.getElementById("memStatus").textContent = "Противник вышел"; }
  function destroy() { container.innerHTML = ""; }
  return { onState, onGameOver, onOpponentLeft, destroy };
}
