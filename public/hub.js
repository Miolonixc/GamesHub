(() => {
  const $ = (s) => document.querySelector(s);
  const screens = {
    lobby: $("#lobby"),
    gameSelect: $("#gameSelect"),
    waiting: $("#waiting"),
    gameScreen: $("#gameScreen")
  };

  let ws = null;
  let myName = "";
  let opponentName = "";
  let currentGame = "";
  let currentRoomId = "";
  let gameInstance = null;
  let isHost = false;

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function getGameName(g) {
    const names = {
      tetris: "Тетрис", pong: "Pong",
      tictactoe: "Крестики-нолики",
      connect4: "Четыре в ряд", memory: "Пары"
    };
    return names[g] || g;
  }

  // --- Persistence ---
  function saveSession() {
    localStorage.setItem("gh_name", myName);
    localStorage.setItem("gh_room", currentRoomId);
    localStorage.setItem("gh_host", isHost ? "1" : "0");
  }

  function clearSession() {
    localStorage.removeItem("gh_name");
    localStorage.removeItem("gh_room");
    localStorage.removeItem("gh_host");
  }

  // --- WebSocket ---
  function connectWS(onOpen) {
    if (ws && ws.readyState === WebSocket.OPEN) { onOpen(); return; }
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => { chat.init(ws); if (onOpen) onOpen(); };
    ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
    ws.onclose = () => {
      chat.addSystem("Соединение потеряно");
      setTimeout(() => {
        if (currentRoomId) {
          connectWS(() => {
            if (isHost) {
              send({ type: "create-room", name: myName });
            } else {
              send({ type: "join-room", roomId: currentRoomId, name: myName });
            }
          });
        }
      }, 2000);
    };
  }

  function send(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  // --- Lobby: Create game ---
  $("#createBtn").onclick = () => {
    const name = $("#playerName").value.trim();
    if (!name) return alert("Введите имя");
    myName = name;
    isHost = true;
    connectWS(() => send({ type: "create-room", name: myName }));
  };

  // --- Lobby: Join game ---
  $("#joinBtn").onclick = () => {
    const name = $("#playerName").value.trim();
    const code = $("#roomCodeInput").value.trim().toUpperCase();
    if (!name) return alert("Введите имя");
    if (!code) return alert("Введите код комнаты");
    myName = name;
    isHost = false;
    connectWS(() => send({ type: "join-room", roomId: code, name: myName }));
  };

  $("#roomCodeInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#joinBtn").click(); });
  $("#playerName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if ($("#roomCodeInput").value.trim()) $("#joinBtn").click();
      else $("#createBtn").click();
    }
  });

  // --- Logout button ---
  $("#logoutBtn").onclick = () => {
    if (gameInstance && gameInstance.destroy) gameInstance.destroy();
    gameInstance = null;
    send({ type: "leave-room" });
    currentRoomId = "";
    currentGame = "";
    isHost = false;
    myName = "";
    clearSession();
    showScreen("lobby");
  };

  // --- Game Selection: propose game ---
  document.querySelectorAll(".game-card").forEach(card => {
    card.onclick = () => {
      currentGame = card.dataset.game;
      send({ type: "game-action", action: "propose-game", data: { game: currentGame } });
    };
  });

  // --- Cancel ---
  $("#cancelWait").onclick = () => {
    send({ type: "leave-room" });
    currentRoomId = "";
    isHost = false;
    clearSession();
    showScreen("lobby");
  };

  // --- Handle messages ---
  function handleMessage(msg) {
    switch (msg.type) {
      case "room-created":
        currentRoomId = msg.roomId;
        $("#myNameDisplay").textContent = myName;
        $("#myRoomId").textContent = msg.roomId;
        saveSession();
        showScreen("gameSelect");
        break;

      case "room-joined":
        currentRoomId = msg.roomId;
        $("#myNameDisplay").textContent = myName;
        $("#myRoomId").textContent = msg.roomId;
        saveSession();
        showScreen("gameSelect");
        break;

      case "player-list":
        updatePlayerList(msg.players);
        break;

      case "game-proposed":
        showProposal(msg.game, msg.proposer);
        break;

      case "game-declined":
        hideProposal();
        break;

      case "room-ready":
        currentRoomId = msg.roomId;
        currentGame = msg.game;
        opponentName = msg.opponent || "Противник";
        hideProposal();
        startGame();
        break;

      case "game-state":
        if (gameInstance && gameInstance.onState) gameInstance.onState(msg.state);
        break;

      case "game-over":
        if (gameInstance && gameInstance.onGameOver) gameInstance.onGameOver(msg);
        break;

      case "opponent-left":
        chat.addSystem(`${msg.name} покинул игру`);
        if (gameInstance && gameInstance.onOpponentLeft) gameInstance.onOpponentLeft();
        break;

      case "back-to-menu":
        if (gameInstance && gameInstance.destroy) gameInstance.destroy();
        gameInstance = null;
        currentGame = "";
        hideProposal();
        showScreen("gameSelect");
        break;

      case "error":
        alert(msg.message);
        showScreen("lobby");
        break;
    }
  }

  // --- Player list ---
  function updatePlayerList(players) {
    const el = $("#onlinePlayers");
    if (!el) return;
    el.innerHTML = players.map(n => `<span class="online-dot"></span> ${n}`).join("  ");
  }

  // --- Game proposal ---
  function showProposal(game, proposer) {
    const el = $("#gameProposal");
    if (!el) return;
    const isForMe = proposer !== myName;
    el.innerHTML = `
      <div class="proposal-card">
        <p>${proposer} предлагает: <strong>${getGameName(game)}</strong></p>
        ${isForMe ? `
          <div class="proposal-btns">
            <button class="btn primary" id="proposalConfirm">Играть!</button>
            <button class="btn secondary" id="proposalDecline">Нет</button>
          </div>
        ` : `<p class="proposal-wait">Ожидание подтверждения...</p>`}
      </div>`;
    el.classList.remove("hidden");

    if (isForMe) {
      document.getElementById("proposalConfirm").onclick = () => {
        send({ type: "game-action", action: "confirm-game", data: { game } });
      };
      document.getElementById("proposalDecline").onclick = () => {
        send({ type: "game-action", action: "decline-game" });
      };
    }
  }

  function hideProposal() {
    const el = $("#gameProposal");
    if (el) el.classList.add("hidden");
  }

  // --- Start Game ---
  function startGame() {
    showScreen("gameScreen");
    $("#gameTitle").textContent = getGameName(currentGame);
    $("#gameContainer").innerHTML = "";
    gameInstance = null;

    const cssId = `css-${currentGame}`;
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = `games/${currentGame}/${currentGame}.css`;
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = `games/${currentGame}/${currentGame}.js`;
    script.onload = () => {
      const factory = window[`create_${currentGame}`];
      if (factory) {
        gameInstance = factory({
          container: $("#gameContainer"),
          send,
          myName,
          opponentName,
          isHost
        });
        send({ type: "game-action", action: "game-ready" });
      }
    };
    document.body.appendChild(script);
  }

  // --- Back to menu ---
  $("#backToMenu").onclick = () => {
    if (gameInstance && gameInstance.destroy) gameInstance.destroy();
    gameInstance = null;
    currentGame = "";
    send({ type: "game-action", action: "back-to-menu" });
    hideProposal();
    showScreen("gameSelect");
  };

  // --- Auto-reconnect on page load ---
  const savedName = localStorage.getItem("gh_name");
  const savedRoom = localStorage.getItem("gh_room");
  const savedHost = localStorage.getItem("gh_host");

  if (savedName && savedRoom) {
    myName = savedName;
    currentRoomId = savedRoom;
    isHost = savedHost === "1";
    connectWS(() => {
      if (isHost) {
        send({ type: "create-room", name: myName });
      } else {
        send({ type: "join-room", roomId: savedRoom, name: myName });
      }
    });
  }

  // --- Auto-join from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const joinId = urlParams.get("join");
  if (joinId) {
    $("#roomCodeInput").value = joinId.toUpperCase();
  }
})();
