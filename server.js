const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const RoomManager = require("./server/room-manager");

const PORT = 3000;
const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, "public", req.url === "/" ? "index.html" : req.url.split("?")[0]);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const roomManager = new RoomManager();
const clients = new Map();

const gameModules = {};
try { gameModules.tetris = require("./server/games/tetris-server"); } catch(e) {}
try { gameModules.pong = require("./server/games/pong-server"); } catch(e) {}
try { gameModules.tictactoe = require("./server/games/tictactoe-server"); } catch(e) {}
try { gameModules.connect4 = require("./server/games/connect4-server"); } catch(e) {}
try { gameModules.memory = require("./server/games/memory-server"); } catch(e) {}
try { gameModules.seabattle = require("./server/games/seabattle-server"); } catch(e) {}
try { gameModules.checkers = require("./server/games/checkers-server"); } catch(e) {}

wss.on("connection", (ws) => {
  const playerId = Math.random().toString(36).substring(2, 10);
  clients.set(playerId, { ws, name: null, roomId: null });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case "create-room": {
        const room = roomManager.createRoom(null);
        room.hostId = playerId;
        const result = roomManager.joinRoom(room.id, { id: playerId, name: msg.name, _ws: ws });
        clients.get(playerId).roomId = room.id;
        clients.get(playerId).name = msg.name;
        ws.send(JSON.stringify({ type: "room-created", roomId: room.id }));
        ws.send(JSON.stringify({ type: "scoreboard", score: room.score }));
        break;
      }

      case "join-room": {
        const roomId = msg.roomId.toUpperCase();
        const room = roomManager.getRoomById(roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Комната не найдена" }));
          return;
        }
        if (room.players.length >= 2) {
          ws.send(JSON.stringify({ type: "error", message: "Комната заполнена" }));
          return;
        }
        const result = roomManager.joinRoom(roomId, { id: playerId, name: msg.name, _ws: ws });
        if (result.error) {
          ws.send(JSON.stringify({ type: "error", message: result.error }));
          return;
        }
        clients.get(playerId).roomId = roomId;
        clients.get(playerId).name = msg.name;
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
          room.proposedGame = game;
          broadcastToRoom(room, { type: "game-proposed", game, proposer: clients.get(playerId).name });
          return;
        }

        if (msg.action === "confirm-game") {
          const game = msg.data?.game || room.proposedGame;
          if (!game || !gameModules[game]) return;
          room.game = game;
          room.proposedGame = null;
          const gameModule = gameModules[game];
          if (gameModule && gameModule.init) {
            room.state = gameModule.init(room);
          }
          room.players.forEach(p => {
            const c = clients.get(p.id);
            if (c && c.ws.readyState === 1) {
              const opponent = room.players.find(op => op.id !== p.id);
              c.ws.send(JSON.stringify({
                type: "room-ready",
                roomId: room.id,
                game: room.game,
                opponent: opponent ? opponent.name : null
              }));
            }
          });
          return;
        }

        if (msg.action === "decline-game") {
          room.proposedGame = null;
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
        const room = roomManager.getRoom(playerId);
        if (!room) return;
        const name = clients.get(playerId)?.name || "Unknown";
        broadcastToRoom(room, { type: "chat", name, text: msg.text.substring(0, 200) });
        break;
      }
    }
  });

  ws.on("close", () => {
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

setInterval(() => roomManager.cleanup(), 60000);

server.listen(PORT, () => {
  console.log(`Game Hub running on http://localhost:${PORT}`);
});
