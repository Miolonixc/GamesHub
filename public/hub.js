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

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // --- Lobby ---
  $("#enterBtn").onclick = () => {
    const n1 = $("#name1").value.trim();
    const n2 = $("#name2").value.trim();
    if (!n1 || !n2) return alert("Введите имена обоих игроков");
    myName = n1;
    opponentName = n2;
    $("#p1Display").textContent = n1;
    $("#p2Display").textContent = n2;
    connectWS(() => showScreen("gameSelect"));
  };

  $("#name2").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#enterBtn").click();
  });

  // --- WebSocket ---
  function connectWS(onOpen) {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}`);

    ws.onopen = () => {
      chat.init(ws);
      if (onOpen) onOpen();
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      handleMessage(msg);
    };

    ws.onclose = () => {
      chat.addSystem("Соединение потеряно");
    };
  }

  function send(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  // --- Game Selection ---
  document.querySelectorAll(".game-card").forEach(card => {
    card.onclick = () => {
      currentGame = card.dataset.game;
      createRoom();
    };
  });

  function createRoom() {
    showScreen("waiting");
    $("#waitGame").textContent = getGameName(currentGame);
    send({ type: "create-room", game: currentGame, name: myName });
  }

  function getGameName(g) {
    const names = {
      tetris: "Тетрис", pong: "Pong",
      tictactoe: "Крестики-нолики",
      connect4: "Четыре в ряд", memory: "Пары"
    };
    return names[g] || g;
  }

  // --- Modal ---
  let pendingRoomId = "";

  function showRoomModal(roomId) {
    pendingRoomId = roomId;
    $("#roomCode").textContent = roomId;
    $("#modalHint").textContent = `Отправь код другу: ${roomId}`;
    $("#roomModal").classList.remove("hidden");
    $("#waitingSpinner").style.display = "none";
  }

  $("#closeModal").onclick = () => {
    $("#roomModal").classList.add("hidden");
    send({ type: "leave-room" });
    showScreen("gameSelect");
  };

  $("#cancelWait").onclick = () => {
    send({ type: "leave-room" });
    showScreen("gameSelect");
  };

  // --- Handle messages ---
  function handleMessage(msg) {
    switch (msg.type) {
      case "room-created":
        currentRoomId = msg.roomId;
        showRoomModal(msg.roomId);
        break;

      case "room-joined":
        currentRoomId = msg.roomId;
        currentGame = msg.game;
        $("#roomModal").classList.add("hidden");
        showScreen("waiting");
        $("#waitGame").textContent = getGameName(msg.game);
        break;

      case "room-ready":
        currentRoomId = msg.roomId;
        currentGame = msg.game;
        opponentName = msg.opponent || "Противник";
        startGame();
        break;

      case "game-state":
        if (gameInstance && gameInstance.onState) {
          gameInstance.onState(msg.state);
        }
        break;

      case "game-over":
        if (gameInstance && gameInstance.onGameOver) {
          gameInstance.onGameOver(msg);
        }
        break;

      case "opponent-left":
        chat.addSystem(`${msg.name} покинул игру`);
        if (gameInstance && gameInstance.onOpponentLeft) {
          gameInstance.onOpponentLeft();
        }
        break;

      case "game-action": {
        if (gameInstance && gameInstance.onAction) {
          gameInstance.onAction(msg.action, msg.data);
        }
        break;
      }

      case "error":
        alert(msg.message);
        showScreen("gameSelect");
        break;
    }
  }

  // --- Start Game ---
  function startGame() {
    showScreen("gameScreen");
    $("#gameTitle").textContent = getGameName(currentGame);
    $("#gameContainer").innerHTML = "";

    // Load game CSS
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
          opponentName
        });
      }
    };
    document.body.appendChild(script);
  }

  // --- Back to menu ---
  $("#backToMenu").onclick = () => {
    if (gameInstance && gameInstance.destroy) gameInstance.destroy();
    gameInstance = null;
    send({ type: "leave-room" });
    showScreen("gameSelect");
  };

  // --- Join room from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const joinId = urlParams.get("join");
  if (joinId) {
    // Show lobby but auto-fill join
    window._autoJoin = joinId.toUpperCase();
  }
})();
