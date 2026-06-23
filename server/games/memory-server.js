const EMOJIS = ["🎮","🎯","🎨","🎵","🌟","🔥","💎","🦋","🌈","🍕","🚀","🎸","🏀","🎲","🐶","🐱","🦊","🐸","🌻","🍄","🎪","🎭","🏆","💎"];

function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

function initMem(room) {
  const pairs = 8; const emojis = shuffle([...EMOJIS]).slice(0, pairs);
  const cards = shuffle([...emojis, ...emojis]);
  room.state = {
    mode: "memory", cards: cards.map((e, i) => ({ id: i, emoji: e, flipped: false, matched: false })),
    currentTurn: 0, players: [room.players[0]?.id, room.players[1]?.id],
    firstPick: null, secondPick: null, locked: false,
    scores: { [room.players[0]?.id]: 0, [room.players[1]?.id]: 0 },
    pairsFound: 0, totalPairs: pairs, gameOver: false
  };
  return room.state;
}

function handleMem(room, pid, action, data) {
  if (!room.state || room.state.gameOver || room.state.players[room.state.currentTurn] !== pid || action !== "flip") return null;
  const idx = data?.idx; if (idx < 0 || idx >= room.state.cards.length) return null;
  const card = room.state.cards[idx];
  if (card.flipped || card.matched || room.state.locked) return null;
  card.flipped = true;
  if (!room.state.firstPick) { room.state.firstPick = idx; return null; }
  room.state.secondPick = idx; room.state.locked = true;
  const first = room.state.cards[room.state.firstPick], second = room.state.cards[room.state.secondPick];
  if (first.emoji === second.emoji) {
    first.matched = true; second.matched = true;
    room.state.scores[pid]++; room.state.pairsFound++;
    room.state.firstPick = null; room.state.secondPick = null; room.state.locked = false;
    if (room.state.pairsFound >= room.state.totalPairs) {
      room.state.gameOver = true;
      const s0 = room.state.scores[room.players[0]?.id] || 0, s1 = room.state.scores[room.players[1]?.id] || 0;
      return { type: "game-over", winner: s0 !== s1 ? (s0 > s1 ? room.players[0]?.name : room.players[1]?.name) : null, reason: s0 > s1 ? `${room.players[0]?.name} победил!` : s1 > s0 ? `${room.players[1]?.name} победил!` : "Ничья!" };
    }
    return null;
  }
  setTimeout(() => { if (room.state) { first.flipped = false; second.flipped = false; room.state.firstPick = null; room.state.secondPick = null; room.state.locked = false; room.state.currentTurn = (room.state.currentTurn + 1) % 2; broadcastState(room); } }, 800);
  return null;
}

function init(room) { return null; }
function handleAction(room, pid, action, data) {
  if (action === "start") { initMem(room); broadcastState(room); return null; }
  const r = handleMem(room, pid, action, data); broadcastState(room); return r;
}
function broadcastState(room) {
  if (!room.state) return;
  room.players.forEach(p => {
    if (p._ws && p._ws.readyState === 1) p._ws.send(JSON.stringify({
      type: "game-state", state: {
        mode: "memory", cards: room.state.cards.map(c => ({ id: c.id, emoji: (c.flipped || c.matched) ? c.emoji : null, matched: c.matched })),
        isMyTurn: room.state.players[room.state.currentTurn] === p.id && !room.state.gameOver,
        myScore: room.state.scores[p.id] || 0, opponentScore: room.state.scores[room.state.players.find(op => op.id !== p.id)] || 0,
        gameOver: room.state.gameOver, myName: p.name, opponentName: room.players.find(op => op.id !== p.id)?.name
      }
    }));
  });
}
function cleanup() {}
module.exports = { init, handleAction, cleanup };
