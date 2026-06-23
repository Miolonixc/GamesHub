function create_checkers(opts) {
  const { container, send, myName, opponentName, isHost } = opts;
  let selected = null;

  container.innerHTML = `
    <div class="ck-wrapper">
      <div class="ck-info">
        <span class="ck-my">${myName}</span> vs <span class="ck-opp">${opponentName}</span>
      </div>
      <div class="ck-phase" id="ckPhase">Твой ход!</div>
      <div class="ck-board" id="ckBoard"></div>
      <div class="ck-legend">
        <span class="ck-legend-item"><span class="ck-dot ck-dot1"></span> Твои</span>
        <span class="ck-legend-item"><span class="ck-dot ck-dot2"></span> Противник</span>
      </div>
    </div>`;

  const boardEl = document.getElementById("ckBoard");

  function renderBoard(board) {
    boardEl.innerHTML = "";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement("div");
        cell.className = "ck-cell " + ((r + c) % 2 === 0 ? "ck-light" : "ck-dark");
        cell.dataset.row = r;
        cell.dataset.col = c;

        if (board[r][c] === 1) cell.innerHTML = '<div class="ck-piece ck-p1"></div>';
        else if (board[r][c] === 2) cell.innerHTML = '<div class="ck-piece ck-p2"></div>';
        else if (board[r][c] === 3) cell.innerHTML = '<div class="ck-piece ck-p1 ck-king">♛</div>';
        else if (board[r][c] === 4) cell.innerHTML = '<div class="ck-piece ck-p2 ck-king">♛</div>';

        cell.onclick = () => handleCellClick(r, c, board);
        boardEl.appendChild(cell);
      }
    }
  }

  function handleCellClick(r, c, board) {
    const piece = board[r][c];
    if (piece === 1 || piece === 3) {
      selected = { r, c };
      sfx.move();
      highlightMoves(board, r, c);
    } else if (selected && piece === 0) {
      sfx.capture();
      send({ type: "game-action", action: "move", data: { fromR: selected.r, fromC: selected.c, toR: r, toC: c } });
      selected = null;
    }
  }

  function highlightMoves(board, r, c) {
    document.querySelectorAll(".ck-cell").forEach(el => el.classList.remove("ck-selected", "ck-avail"));
    const cell = boardEl.children[r * 8 + c];
    if (cell) cell.classList.add("ck-selected");
  }

  function onState(s) {
    renderBoard(s.board);
    const phase = document.getElementById("ckPhase");
    if (s.mustContinue) {
      phase.textContent = "Продолжай взятие!";
      phase.style.color = "#d63031";
    } else if (s.isMyTurn) {
      phase.textContent = "Твой ход!";
      phase.style.color = "#00cec9";
    } else {
      phase.textContent = "Ход противника...";
      phase.style.color = "#636e72";
    }
  }

  function onGameOver(msg) {
    document.getElementById("ckPhase").textContent = msg.reason;
    document.getElementById("ckPhase").style.color = "#6c5ce7";
  }

  function onOpponentLeft() {
    document.getElementById("ckPhase").textContent = "Противник вышел";
  }

  function destroy() { container.innerHTML = ""; }

  return { onState, onGameOver, onOpponentLeft, destroy };
}
