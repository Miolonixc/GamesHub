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

  // --- WebSocket ---
  function connectWS(onOpen) {
    if (ws && ws.readyState === WebSocket.OPEN) { onOpen(); return; }
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => { chat.init(ws); if (onOpen) onOpen(); };
    ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
    ws.onclose = () => chat.addSystem("Соединение потеряно");
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
    connectWS(() => {
      send({ type: "create-room", name: myName });
    });
  };

  // --- Lobby: Join game ---
  $("#joinBtn").onclick = () => {
    const name = $("#playerName").value.trim();
    const code = $("#roomCodeInput").value.trim().toUpperCase();
    if (!name) return alert("Введите имя");
    if (!code) return alert("Введите код комнаты");
    myName = name;
    isHost = false;
    connectWS(() => {
      send({ type: "join-room", roomId: code, name: myName });
    });
  };

  $("#roomCodeInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#joinBtn").click();
  });

  $("#playerName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if ($("#roomCodeInput").value.trim()) $("#joinBtn").click();
      else $("#createBtn").click();
    }
  });

  // --- Game Selection (host picks game) ---
  document.querySelectorAll(".game-card").forEach(card => {
    card.onclick = () => {
      currentGame = card.dataset.game;
      showScreen("waiting");
      $("#waitInfo").textContent = `${getGameName(currentGame)} — ожидание противника...`;
      send({ type: "game-action", action: "select-game", data: { game: currentGame } });
    };
  });

  // --- Cancel ---
  $("#cancelWait").onclick = () => {
    send({ type: "leave-room" });
    currentRoomId = "";
    isHost = false;
    showScreen("lobby");
  };

  // --- Handle messages ---
  function handleMessage(msg) {
    switch (msg.type) {
      case "room-created":
        currentRoomId = msg.roomId;
        $("#myNameDisplay").textContent = myName;
        $("#myRoomId").textContent = msg.roomId;
        showScreen("gameSelect");
        break;

      case "room-joined":
        currentRoomId = msg.roomId;
        showScreen("waiting");
        $("#waitInfo").textContent = "Ожидание выбора игры хостом...";
        break;

      case "room-ready":
        currentRoomId = msg.roomId;
        currentGame = msg.game;
        opponentName = msg.opponent || "Противник";
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

      case "error":
        alert(msg.message);
        showScreen("lobby");
        break;
    }
  }

  // --- Start Game ---
  function startGame() {
    showScreen("gameScreen");
    $("#gameTitle").textContent = getGameName(currentGame);
    $("#gameContainer").innerHTML = "";

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
    currentRoomId = "";
    isHost = false;
    showScreen("lobby");
  };

  // --- Auto-join from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const joinId = urlParams.get("join");
  if (joinId) {
    $("#roomCodeInput").value = joinId.toUpperCase();
  }
})();
