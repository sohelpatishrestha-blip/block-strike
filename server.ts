import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

interface PlayerState {
  id: string;
  name: string;
  team: 'red' | 'blue' | 'ffa';
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  kills: number;
  deaths: number;
  score: number;
  weapon: string;
  crouching: boolean;
  alive: boolean;
}

interface Room {
  id: string;
  name: string;
  mode: 'ffa' | 'tdm' | 'ctf' | '1v1';
  mapId: string;
  maxPlayers: number;
  players: Map<string, { ws: WebSocket; state: PlayerState }>;
  redScore: number;
  blueScore: number;
  createdAt: number;
}

const rooms = new Map<string, Room>();
const leaderboard: { name: string; kills: number; score: number; date: string }[] = [
  { name: 'Vortex_99', kills: 42, score: 4850, date: '2026-11-10' },
  { name: 'BlockSniper', kills: 35, score: 4100, date: '2026-11-10' },
  { name: 'BhopKing', kills: 29, score: 3420, date: '2026-11-11' },
  { name: 'PixelStriker', kills: 24, score: 2790, date: '2026-11-11' },
  { name: 'ShadowCube', kills: 18, score: 2150, date: '2026-11-11' },
];

// Create a default public room so players can jump right in
function ensureDefaultRoom() {
  if (rooms.size === 0) {
    rooms.set('arena-1', {
      id: 'arena-1',
      name: 'Public Arena #1',
      mode: 'ffa',
      mapId: 'desert',
      maxPlayers: 12,
      players: new Map(),
      redScore: 0,
      blueScore: 0,
      createdAt: Date.now(),
    });
  }
}
ensureDefaultRoom();

function getRoomList() {
  ensureDefaultRoom();
  return Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    mode: r.mode,
    mapId: r.mapId,
    playerCount: r.players.size,
    maxPlayers: r.maxPlayers,
  }));
}

function broadcastToRoom(room: Room, data: unknown, excludeId?: string) {
  const msg = JSON.stringify(data);
  for (const [pid, client] of room.players.entries()) {
    if (pid !== excludeId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

function recordLeaderboard(name: string, kills: number, score: number) {
  if (score <= 0) return;
  const existing = leaderboard.find((e) => e.name === name);
  if (existing) {
    if (score > existing.score) {
      existing.score = score;
      existing.kills = kills;
      existing.date = new Date().toISOString().slice(0, 10);
    }
  } else {
    leaderboard.push({
      name,
      kills,
      score,
      date: new Date().toISOString().slice(0, 10),
    });
  }
  leaderboard.sort((a, b) => b.score - a.score);
  if (leaderboard.length > 20) leaderboard.length = 20;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/rooms', (_req, res) => {
    res.json(getRoomList());
  });

  app.get('/api/leaderboard', (_req, res) => {
    res.json(leaderboard);
  });

  app.post('/api/leaderboard', (req, res) => {
    const { name, kills, score } = req.body || {};
    if (typeof name === 'string' && typeof score === 'number') {
      recordLeaderboard(name.slice(0, 20), Number(kills) || 0, score);
    }
    res.json(leaderboard);
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentRoomId: string | null = null;
    let playerId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'listRooms') {
          ws.send(JSON.stringify({ type: 'roomList', rooms: getRoomList() }));
          return;
        }

        if (msg.type === 'createRoom') {
          const roomId = 'room-' + Math.random().toString(36).slice(2, 8);
          const room: Room = {
            id: roomId,
            name: String(msg.name || 'Custom Room').slice(0, 28),
            mode: ['ffa', 'tdm', 'ctf', '1v1'].includes(msg.mode) ? msg.mode : 'ffa',
            mapId: ['desert', 'warehouse', 'city', 'military'].includes(msg.mapId)
              ? msg.mapId
              : 'desert',
            maxPlayers: msg.mode === '1v1' ? 2 : 12,
            players: new Map(),
            redScore: 0,
            blueScore: 0,
            createdAt: Date.now(),
          };
          rooms.set(roomId, room);
          ws.send(JSON.stringify({ type: 'roomCreated', roomId }));
          return;
        }

        if (msg.type === 'joinRoom') {
          const room = rooms.get(msg.roomId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            return;
          }
          if (room.players.size >= room.maxPlayers) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
            return;
          }

          playerId = 'p-' + Math.random().toString(36).slice(2, 9);
          currentRoomId = room.id;

          let team: 'red' | 'blue' | 'ffa' = 'ffa';
          if (room.mode === 'tdm' || room.mode === 'ctf') {
            let redCount = 0;
            let blueCount = 0;
            for (const p of room.players.values()) {
              if (p.state.team === 'red') redCount++;
              else if (p.state.team === 'blue') blueCount++;
            }
            team = redCount <= blueCount ? 'red' : 'blue';
          }

          const state: PlayerState = {
            id: playerId,
            name: String(msg.playerName || 'Player').slice(0, 18),
            team,
            x: 0,
            y: 2,
            z: 0,
            yaw: 0,
            pitch: 0,
            hp: 200,
            kills: 0,
            deaths: 0,
            score: 0,
            weapon: msg.weapon || 'assault',
            crouching: false,
            alive: true,
          };

          room.players.set(playerId, { ws, state });

          const existingPlayers = Array.from(room.players.values()).map((p) => p.state);
          ws.send(
            JSON.stringify({
              type: 'joinedRoom',
              playerId,
              team,
              room: {
                id: room.id,
                name: room.name,
                mode: room.mode,
                mapId: room.mapId,
                redScore: room.redScore,
                blueScore: room.blueScore,
              },
              players: existingPlayers,
            })
          );

          broadcastToRoom(room, { type: 'playerJoined', player: state }, playerId);
          return;
        }

        if (!currentRoomId || !playerId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;
        const client = room.players.get(playerId);
        if (!client) return;

        if (msg.type === 'move') {
          const s = client.state;
          s.x = Number(msg.x) || 0;
          s.y = Number(msg.y) || 0;
          s.z = Number(msg.z) || 0;
          s.yaw = Number(msg.yaw) || 0;
          s.pitch = Number(msg.pitch) || 0;
          s.weapon = msg.weapon || s.weapon;
          s.crouching = Boolean(msg.crouching);
          broadcastToRoom(
            room,
            {
              type: 'playerMoved',
              id: playerId,
              x: s.x,
              y: s.y,
              z: s.z,
              yaw: s.yaw,
              pitch: s.pitch,
              weapon: s.weapon,
              crouching: s.crouching,
            },
            playerId
          );
        } else if (msg.type === 'shoot') {
          broadcastToRoom(
            room,
            {
              type: 'playerShot',
              id: playerId,
              weapon: msg.weapon,
              origin: msg.origin,
              dir: msg.dir,
            },
            playerId
          );
        } else if (msg.type === 'hit') {
          const target = room.players.get(msg.targetId);
          if (!target || !target.state.alive) return;
          const dmg = Math.min(150, Math.max(1, Number(msg.damage) || 20));
          target.state.hp -= dmg;

          if (target.state.hp <= 0) {
            target.state.hp = 0;
            target.state.alive = false;
            target.state.deaths += 1;
            client.state.kills += 1;
            client.state.score += msg.headshot ? 150 : 100;
            recordLeaderboard(client.state.name, client.state.kills, client.state.score);

            if (room.mode === 'tdm') {
              if (client.state.team === 'red') room.redScore += 1;
              else if (client.state.team === 'blue') room.blueScore += 1;
            }

            broadcastToRoom(room, {
              type: 'playerKilled',
              killerId: playerId,
              killerName: client.state.name,
              victimId: target.state.id,
              victimName: target.state.name,
              weapon: client.state.weapon,
              headshot: Boolean(msg.headshot),
              redScore: room.redScore,
              blueScore: room.blueScore,
            });

            setTimeout(() => {
              if (room.players.has(target.state.id)) {
                target.state.hp = 200;
                target.state.alive = true;
                broadcastToRoom(room, {
                  type: 'playerRespawned',
                  id: target.state.id,
                });
              }
            }, 3000);
          } else {
            if (target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(
                JSON.stringify({
                  type: 'damaged',
                  hp: target.state.hp,
                  attackerId: playerId,
                })
              );
            }
          }
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      if (currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.players.delete(playerId);
          broadcastToRoom(room, { type: 'playerLeft', id: playerId });
          if (room.players.size === 0 && room.id !== 'arena-1') {
            rooms.delete(room.id);
          }
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BLOCK STRIKE FPS server running on http://localhost:${PORT}`);
  });
}

startServer();
