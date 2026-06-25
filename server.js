const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const RoomManager = require("./server/room-manager");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.join(PUBLIC, urlPath);
  // защита от обхода каталога (../): итоговый путь обязан быть внутри public/
  if (filePath !== PUBLIC && !filePath.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 }); // игровые сообщения крошечные
const roomManager = new RoomManager();
const clients = new Map();

// чистим имя игрока: убираем управляющие символы и угловые скобки (анти-XSS:
// имена вставляются в innerHTML в хабе и в каждой игре), режем длину
function cleanName(n) {
  const s = (typeof n === "string" ? n : "").replace(/[\x00-\x1f\x7f<>]/g, "").trim().slice(0, 20);
  return s || "Игрок";
}

// анти-абуз: лимит соединений на IP, частоты сообщений и чата
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP) || 16;
const MSG_PER_SEC = 60;
const CHAT_INTERVAL_MS = 600;
const ipConns = new Map();

const gameModules = {};
try { gameModules.tetris = require("./server/games/tetris-server"); } catch(e) {}
try { gameModules.pong = require("./server/games/pong-server"); } catch(e) {}
try { gameModules.tictactoe = require("./server/games/tictactoe-server"); } catch(e) {}
try { gameModules.connect4 = require("./server/games/connect4-server"); } catch(e) {}
try { gameModules.memory = require("./server/games/memory-server"); } catch(e) {}
try { gameModules.seabattle = require("./server/games/seabattle-server"); } catch(e) {}
try { gameModules.checkers = require("./server/games/checkers-server"); } catch(e) {}

wss.on("connection", (ws, req) => {
  const ip = (req && req.socket && req.socket.remoteAddress) || "?";
  const cur = ipConns.get(ip) || 0;
  if (cur >= MAX_CONN_PER_IP) { try { ws.close(1008, "too many connections"); } catch (e) {} return; }
  ipConns.set(ip, cur + 1);

  const playerId = Math.random().toString(36).substring(2, 10);
  clients.set(playerId, { ws, name: null, roomId: null });
  let winStart = 0, msgCount = 0, lastChat = 0;

  ws.on("message", (raw) => {
    const now = Date.now();
    if (now - winStart >= 1000) { winStart = now; msgCount = 0; }
    if (++msgCount > MSG_PER_SEC) return; // флуд сообщениями — игнорируем

    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== "string") return;

    try {
    switch (msg.type) {
      case "create-room": {
        const name = cleanName(msg.name);
        const room = roomManager.createRoom(null);
        room.hostId = playerId;
        roomManager.joinRoom(room.id, { id: playerId, name, _ws: ws });
        clients.get(playerId).roomId = room.id;
        clients.get(playerId).name = name;
        ws.send(JSON.stringify({ type: "room-created", roomId: room.id }));
        ws.send(JSON.stringify({ type: "scoreboard", score: room.score }));
        broadcastPlayerList(room); // чтобы хост сразу видел себя в списке «В лобби»
        break;
      }

      case "join-room": {
        if (typeof msg.roomId !== "string") return;
        const roomId = msg.roomId.toUpperCase();
        const name = cleanName(msg.name);
        const room = roomManager.getRoomById(roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Комната не найдена" }));
          return;
        }
        if (room.players.length >= 2) {
          ws.send(JSON.stringify({ type: "error", message: "Комната заполнена" }));
          return;
        }
        const result = roomManager.joinRoom(roomId, { id: playerId, name, _ws: ws });
        if (result.error) {
          ws.send(JSON.stringify({ type: "error", message: result.error }));
          return;
        }
        clients.get(playerId).roomId = roomId;
        clients.get(playerId).name = name;
        ws.send(JSON.stringify({ type: "room-joined", roomId }));
        ws.send(JSON.stringify({ type: "scoreboard", score: room.score }));
        broadcastPlayerList(room);
        break;
      }

      case "game-action": {
        const room = roomManager.getRoom(playerId);
        if (!room) return;

        if (msg.action === "propose-game") {
          const game = msg.data?.game;
          if (!game || !gameModules[game]) return;
          // если соперник уже предложил эту же игру — это согласие, сразу стартуем
          if (room.proposedGame === game && room.proposedBy && room.proposedBy !== playerId) {
            startProposedGame(room, game);
            return;
          }
          room.proposedGame = game;
          room.proposedBy = playerId;
          broadcastToRoom(room, { type: "game-proposed", game, proposer: clients.get(playerId).name });
          return;
        }

        if (msg.action === "confirm-game") {
          const game = msg.data?.game || room.proposedGame;
          if (!game || !gameModules[game]) return;
          startProposedGame(room, game);
          return;
        }

        if (msg.action === "decline-game") {
          room.proposedGame = null;
          room.proposedBy = null;
          broadcastToRoom(room, { type: "game-declined" });
          return;
        }

        if (msg.action === "game-ready") {
          if (!room.readyPlayers) room.readyPlayers = new Set();
          room.readyPlayers.add(playerId);
          if (room.readyPlayers.size >= room.players.length && room.game) {
            room.readyPlayers = null;
            const gameModule = gameModules[room.game];
            if (gameModule && gameModule.startTicking && room.state) {
              gameModule.startTicking(room);
            }
          }
          return;
        }

        if (msg.action === "back-to-menu") {
          if (room.game) {
            const gameModule = gameModules[room.game];
            if (gameModule && gameModule.cleanup) gameModule.cleanup(room);
          }
          room.game = null;
          room.state = null;
          broadcastToRoom(room, { type: "back-to-menu" });
          return;
        }

        if (!room.game) return;
        const gameModule = gameModules[room.game];
        if (gameModule && gameModule.handleAction) {
          const result = gameModule.handleAction(room, playerId, msg.action, msg.data);
          if (result) {
            if (result.type === "game-over") {
              room.players.forEach(p => {
                if (!room.score[p.name]) room.score[p.name] = { wins: 0, losses: 0, draws: 0 };
              });
              if (result.winner) {
                const winnerName = result.winner;
                const loserName = room.players.find(p => p.name !== winnerName)?.name;
                if (room.score[winnerName]) room.score[winnerName].wins++;
                if (loserName && room.score[loserName]) room.score[loserName].losses++;
              } else {
                room.players.forEach(p => { if (room.score[p.name]) room.score[p.name].draws++; });
              }
              broadcastToRoom(room, { type: "scoreboard", score: room.score });
            }
            broadcastToRoom(room, result);
          }
        }
        break;
      }

      case "chat": {
        if (now - lastChat < CHAT_INTERVAL_MS) return; // антиспам чата
        const room = roomManager.getRoom(playerId);
        if (!room) return;
        const name = clients.get(playerId)?.name || "Unknown";
        const text = (typeof msg.text === "string" ? msg.text : "").replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200);
        if (!text) return;
        lastChat = now;
        broadcastToRoom(room, { type: "chat", name, text });
        break;
      }

      case "leave-room": {
        const client = clients.get(playerId);
        if (client && client.roomId) {
          const room = roomManager.getRoomById(client.roomId);
          roomManager.leaveRoom(playerId);
          client.roomId = null;
          if (room && room.players.length > 0) {
            broadcastToRoom(room, { type: "opponent-left", name: client.name });
            if (room.game) { const gm = gameModules[room.game]; if (gm && gm.cleanup) gm.cleanup(room); }
            broadcastPlayerList(room);
          }
        }
        break;
      }
    }
    } catch (e) { /* кривое сообщение не должно ронять весь сервер */ }
  });

  ws.on("close", () => {
    const left = (ipConns.get(ip) || 1) - 1;
    if (left <= 0) ipConns.delete(ip); else ipConns.set(ip, left);
    const client = clients.get(playerId);
    if (client && client.roomId) {
      const room = roomManager.getRoomById(client.roomId);
      roomManager.leaveRoom(playerId);

      if (room && room.players.length > 0) {
        broadcastToRoom(room, { type: "opponent-left", name: client.name });
        if (room.game) {
          const gameModule = gameModules[room.game];
          if (gameModule && gameModule.cleanup) gameModule.cleanup(room);
        }
        broadcastPlayerList(room);
      }
    }
    clients.delete(playerId);
  });
});

function broadcastToRoom(room, msg) {
  const data = JSON.stringify(msg);
  room.players.forEach(p => {
    const c = clients.get(p.id);
    if (c && c.ws.readyState === 1) c.ws.send(data);
  });
}

function broadcastPlayerList(room) {
  const players = room.players.map(p => p.name);
  broadcastToRoom(room, { type: "player-list", players });
}

// старт согласованной игры: инициализация + room-ready обоим
function startProposedGame(room, game) {
  room.game = game;
  room.proposedGame = null;
  room.proposedBy = null;
  const gameModule = gameModules[game];
  if (gameModule && gameModule.init) room.state = gameModule.init(room);
  room.players.forEach(p => {
    const c = clients.get(p.id);
    if (c && c.ws.readyState === 1) {
      const opponent = room.players.find(op => op.id !== p.id);
      c.ws.send(JSON.stringify({
        type: "room-ready",
        roomId: room.id,
        game,
        opponent: opponent ? opponent.name : null
      }));
    }
  });
}

setInterval(() => roomManager.cleanup(), 60000);

server.listen(PORT, () => {
  console.log(`Game Hub running on http://localhost:${PORT}`);
});
