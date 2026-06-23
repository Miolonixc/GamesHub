class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.playerRooms = new Map();
  }

  createRoom(game) {
    const id = this.generateId();
    const room = {
      id,
      game,
      players: [],
      maxPlayers: 2,
      state: null,
      createdAt: Date.now()
    };
    this.rooms.set(id, room);
    return room;
  }

  joinRoom(roomId, player) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: "Room not found" };
    if (room.players.length >= room.maxPlayers) return { error: "Room is full" };

    room.players.push(player);
    this.playerRooms.set(player.id, roomId);

    if (room.players.length === room.maxPlayers) {
      return { room, ready: true };
    }
    return { room, ready: false };
  }

  leaveRoom(playerId) {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.players = room.players.filter(p => p.id !== playerId);
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
      }
    }
    this.playerRooms.delete(playerId);
    return roomId;
  }

  getRoom(playerId) {
    const roomId = this.playerRooms.get(playerId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  getRoomById(roomId) {
    return this.rooms.get(roomId);
  }

  generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  cleanup() {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      if (room.players.length === 0 && now - room.createdAt > 60000) {
        this.rooms.delete(id);
      }
    }
  }
}

module.exports = RoomManager;
