import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Gamepad2,
  Globe,
  Settings as SettingsIcon,
  Trophy,
  User,
  Volume2,
  VolumeX,
  Play,
  Plus,
  RefreshCw,
  LogOut,
  Shield,
  Users,
  Copy,
  Check,
  Swords,
} from 'lucide-react';
import { BlockStrikeEngine } from './game/engine';
import {
  GameMode,
  GameScreen,
  GameSettings,
  HudState,
  MapId,
  PlayerProfile,
  RoomInfo,
  WeaponId,
} from './game/types';
import { WEAPON_LIST, WEAPONS } from './game/weapons';
import { MAP_META } from './game/maps';
import { soundEngine } from './game/audio';

type MenuTab = 'play' | 'multiplayer' | 'friends' | 'weapons' | 'settings' | 'profile' | 'leaderboard';

const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1.0,
  fov: 80,
  graphics: 'medium',
  volume: 0.6,
  muted: false,
  showFps: true,
};

const DEFAULT_HUD: HudState = {
  hp: 200,
  ammo: 30,
  reserve: 120,
  reloading: false,
  reloadProgress: 0,
  weaponName: 'Assault Rifle',
  weaponId: 'assault',
  kills: 0,
  deaths: 0,
  score: 0,
  redScore: 0,
  blueScore: 0,
  timeLeft: 300,
  fps: 60,
  hitMarker: 'none',
  killFeed: [],
  scoreboard: [],
  alive: true,
  respawnIn: 0,
  damageFlash: 0,
  aiming: false,
  scopeType: 'red_dot',
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BlockStrikeEngine | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [screen, setScreen] = useState<GameScreen>('menu');
  const [menuTab, setMenuTab] = useState<MenuTab>('play');
  const [selectedMap, setSelectedMap] = useState<MapId>('desert');
  const [selectedMode, setSelectedMode] = useState<GameMode>('practice');
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>('assault');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<PlayerProfile>({
    name: 'Striker_' + Math.floor(100 + Math.random() * 899),
    totalKills: 0,
    totalDeaths: 0,
    gamesPlayed: 0,
    highScore: 0,
  });

  const [hud, setHud] = useState<HudState>(DEFAULT_HUD);
  const [showScoreboard, setShowScoreboard] = useState(false);

  // Multiplayer & Leaderboard state
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [newRoomName, setNewRoomName] = useState('Arena Room');
  const [newRoomMode, setNewRoomMode] = useState<'ffa' | 'tdm' | 'ctf' | '1v1'>('ffa');
  const [newRoomMap, setNewRoomMap] = useState<MapId>('desert');
  const [leaderboard, setLeaderboard] = useState<
    { name: string; kills: number; score: number; date: string }[]
  >([]);
  const [friends, setFriends] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('bs_friends') || '["Vortex_99","BlockSniper"]');
    } catch {
      return ['Vortex_99', 'BlockSniper'];
    }
  });
  const [friendInput, setFriendInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  useEffect(() => {
    if (!canvasMountRef.current) return;
    const engine = new BlockStrikeEngine(
      canvasMountRef.current,
      settings,
      (nextHud) => setHud(nextHud),
      () => setScreen((prev) => (prev === 'playing' ? 'paused' : prev))
    );
    engineRef.current = engine;
    soundEngine.startMenuMusic();

    const params = new URLSearchParams(window.location.search);
    const joinRoomId = params.get('join');
    if (joinRoomId) {
      connectAndJoinRoom(joinRoomId);
    }

    return () => {
      soundEngine.stopMenuMusic();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.applySettings(settings);
  }, [settings]);

  useEffect(() => {
    if (screen === 'menu') {
      engineRef.current?.loadMap(selectedMap);
      soundEngine.startMenuMusic();
    } else {
      soundEngine.stopMenuMusic();
    }
  }, [selectedMap, screen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screen === 'playing' && e.code === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
      }
      if (screen === 'menu' && menuTab === 'play' && (e.code === 'Enter' || e.code === 'Space')) {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          startPracticeMatch();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        setShowScoreboard(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [screen, menuTab, selectedMap, selectedMode, selectedWeapon, profile.name]);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) setRooms(await res.json());
    } catch {
      // Ignore
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) setLeaderboard(await res.json());
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (menuTab === 'multiplayer') fetchRooms();
    if (menuTab === 'leaderboard') fetchLeaderboard();
  }, [menuTab]);

  const startPracticeMatch = () => {
    setScreen('playing');
    engineRef.current?.startMatch(
      selectedMode === '1v1' ? '1v1' : 'practice',
      selectedMap,
      selectedWeapon,
      profile.name
    );
  };

  const connectAndJoinRoom = (roomId: string) => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'joinRoom',
          roomId,
          playerName: profile.name,
          weapon: selectedWeapon,
        })
      );
    };

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'joinedRoom') {
        setScreen('playing');
        engineRef.current?.startMatch(
          msg.room.mode,
          msg.room.mapId,
          selectedWeapon,
          profile.name,
          ws,
          msg.playerId,
          msg.team
        );
        for (const p of msg.players) {
          if (p.id !== msg.playerId) {
            engineRef.current?.handleNetworkMessage({ type: 'playerJoined', player: p });
          }
        }
      } else {
        engineRef.current?.handleNetworkMessage(msg);
      }
    };
  };

  const createAndJoinRoom = () => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'createRoom',
          name: newRoomName,
          mode: newRoomMode,
          mapId: newRoomMap,
        })
      );
    };

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'roomCreated') {
        ws.send(
          JSON.stringify({
            type: 'joinRoom',
            roomId: msg.roomId,
            playerName: profile.name,
            weapon: selectedWeapon,
          })
        );
      } else if (msg.type === 'joinedRoom') {
        setScreen('playing');
        engineRef.current?.startMatch(
          msg.room.mode,
          msg.room.mapId,
          selectedWeapon,
          profile.name,
          ws,
          msg.playerId,
          msg.team
        );
      } else {
        engineRef.current?.handleNetworkMessage(msg);
      }
    };
  };

  const leaveMatch = () => {
    setProfile((prev) => ({
      ...prev,
      totalKills: prev.totalKills + hud.kills,
      totalDeaths: prev.totalDeaths + hud.deaths,
      gamesPlayed: prev.gamesPlayed + 1,
      highScore: Math.max(prev.highScore, hud.score),
    }));
    if (hud.score > 0) {
      fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, kills: hud.kills, score: hud.score }),
      }).catch(() => {});
    }
    wsRef.current?.close();
    wsRef.current = null;
    engineRef.current?.stopMatch();
    setScreen('menu');
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 select-none font-sans">
      {/* Isolated 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* TITLE SCREEN / MAIN MENU */}
      {screen === 'menu' && (
        <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-10 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/60">
          {/* Top Bar: Bespoke SVG Title Lockup + Audio Toggle */}
          <div className="flex items-start justify-between">
            <div>
              <svg
                width="340"
                height="64"
                viewBox="0 0 340 64"
                className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                aria-label="BLOCK STRIKE FPS"
              >
                <polygon points="0,8 14,8 8,56 0,56" fill="#f59e0b" />
                <text
                  x="22"
                  y="38"
                  fill="#ffffff"
                  fontSize="32"
                  fontWeight="900"
                  letterSpacing="2"
                  fontFamily="system-ui, sans-serif"
                >
                  BLOCK STRIKE
                </text>
                <rect x="22" y="45" width="48" height="14" rx="2" fill="#f59e0b" />
                <text
                  x="28"
                  y="56"
                  fill="#0f172a"
                  fontSize="11"
                  fontWeight="900"
                  letterSpacing="1.5"
                  fontFamily="system-ui, sans-serif"
                >
                  FPS
                </text>
                <text
                  x="80"
                  y="56"
                  fill="#cbd5e1"
                  fontSize="11"
                  fontWeight="600"
                  letterSpacing="2"
                  fontFamily="system-ui, sans-serif"
                >
                  LOW-POLY ARENA SHOOTER
                </text>
              </svg>
            </div>

            <button
              onClick={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
              className="flex items-center gap-2 px-3 py-2 rounded bg-slate-900/90 border border-slate-700 hover:border-amber-400 text-xs font-semibold tracking-wider uppercase transition"
            >
              {settings.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
              {settings.muted ? 'Muted' : 'Audio On'}
            </button>
          </div>

          {/* Center-Left Navigation + Active Panel */}
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end my-auto max-w-5xl">
            {/* Menu Navigation */}
            <div className="flex flex-row md:flex-col flex-wrap gap-2 w-full md:w-52">
              {(
                [
                  { id: 'play', label: 'Play', icon: Play },
                  { id: 'multiplayer', label: 'Multiplayer', icon: Globe },
                  { id: 'friends', label: 'Friends', icon: Users },
                  { id: 'weapons', label: 'Weapons', icon: Crosshair },
                  { id: 'settings', label: 'Settings', icon: SettingsIcon },
                  { id: 'profile', label: 'Profile', icon: User },
                  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = menuTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setMenuTab(item.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded font-bold text-sm uppercase tracking-wider transition ${
                      active
                        ? 'bg-amber-500 text-slate-950 shadow-lg'
                        : 'bg-slate-900/90 text-slate-200 border border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Active Menu Content */}
            <div className="flex-1 w-full bg-slate-900/95 border border-slate-800 rounded-lg p-6 shadow-2xl">
              {menuTab === 'play' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
                      Quick Deploy
                    </h2>
                    <span className="text-xs font-semibold text-slate-400 uppercase">
                      Loadout: {WEAPONS[selectedWeapon].name}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Select Map
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(Object.keys(MAP_META) as MapId[]).map((mId) => (
                        <button
                          key={mId}
                          onClick={() => setSelectedMap(mId)}
                          className={`p-3 rounded border text-left transition ${
                            selectedMap === mId
                              ? 'bg-amber-500/20 border-amber-400 text-white'
                              : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="font-bold text-xs uppercase">{MAP_META[mId].name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Game Mode
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {(
                        [
                          { id: 'practice', label: 'Practice (Bots)' },
                          { id: '1v1', label: '1 vs 1 Duel' },
                          { id: 'ffa', label: 'Free For All' },
                          { id: 'tdm', label: 'Team Deathmatch' },
                          { id: 'ctf', label: 'Capture The Flag' },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMode(m.id)}
                          className={`p-2.5 rounded border text-xs font-bold uppercase transition ${
                            selectedMode === m.id
                              ? 'bg-amber-500/20 border-amber-400 text-white'
                              : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={startPracticeMatch}
                    className="w-full py-4 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base uppercase tracking-widest flex items-center justify-center gap-2 transition shadow-lg"
                  >
                    <Gamepad2 className="w-5 h-5" />
                    Start Match
                  </button>
                </div>
              )}

              {menuTab === 'multiplayer' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
                      Multiplayer Rooms
                    </h2>
                    <button
                      onClick={fetchRooms}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                    {rooms.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-3 rounded bg-slate-950/80 border border-slate-800"
                      >
                        <div>
                          <div className="font-bold text-sm">{r.name}</div>
                          <div className="text-xs text-slate-400 uppercase">
                            {r.mode} · {MAP_META[r.mapId]?.name || r.mapId} · {r.playerCount}/{r.maxPlayers} Players
                          </div>
                        </div>
                        <button
                          onClick={() => connectAndJoinRoom(r.id)}
                          className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase"
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="Room Name"
                      className="px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-semibold"
                    />
                    <select
                      value={newRoomMode}
                      onChange={(e) => setNewRoomMode(e.target.value as 'ffa' | 'tdm' | 'ctf' | '1v1')}
                      className="px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-semibold uppercase"
                    >
                      <option value="ffa">Free For All</option>
                      <option value="tdm">Team Deathmatch</option>
                      <option value="ctf">Capture The Flag</option>
                      <option value="1v1">1 vs 1 Custom</option>
                    </select>
                    <select
                      value={newRoomMap}
                      onChange={(e) => setNewRoomMap(e.target.value as MapId)}
                      className="px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-semibold uppercase"
                    >
                      {(Object.keys(MAP_META) as MapId[]).map((mId) => (
                        <option key={mId} value={mId}>
                          {MAP_META[mId].name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={createAndJoinRoom}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase"
                    >
                      <Plus className="w-4 h-4" /> Create
                    </button>
                  </div>
                </div>
              )}

              {menuTab === 'friends' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
                      Friends & 1v1 Duels
                    </h2>
                    <button
                      onClick={() => {
                        setNewRoomMode('1v1');
                        setNewRoomName(`${profile.name} 1v1`);
                        createAndJoinRoom();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase"
                    >
                      <Swords className="w-3.5 h-3.5" /> Host 1v1 Room
                    </button>
                  </div>

                  {/* Add Friend */}
                  <div className="flex gap-2">
                    <input
                      value={friendInput}
                      onChange={(e) => setFriendInput(e.target.value)}
                      placeholder="Enter friend's callsign..."
                      maxLength={18}
                      className="flex-1 px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-semibold"
                    />
                    <button
                      onClick={() => {
                        const name = friendInput.trim();
                        if (name && !friends.includes(name)) {
                          const next = [...friends, name];
                          setFriends(next);
                          localStorage.setItem('bs_friends', JSON.stringify(next));
                          setFriendInput('');
                        }
                      }}
                      className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase"
                    >
                      Add Friend
                    </button>
                  </div>

                  {/* Friends List */}
                  <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                    {friends.map((f) => (
                      <div
                        key={f}
                        className="flex items-center justify-between p-2.5 rounded bg-slate-950/80 border border-slate-800"
                      >
                        <span className="font-bold text-sm">{f}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setNewRoomMode('1v1');
                              setNewRoomName(`${profile.name} vs ${f}`);
                              createAndJoinRoom();
                            }}
                            className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase flex items-center gap-1"
                          >
                            <Swords className="w-3 h-3" /> 1v1
                          </button>
                          <button
                            onClick={() => {
                              const next = friends.filter((x) => x !== f);
                              setFriends(next);
                              localStorage.setItem('bs_friends', JSON.stringify(next));
                            }}
                            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-rose-600 text-xs font-bold uppercase"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Join by Room Code */}
                  <div className="pt-3 border-t border-slate-800 flex gap-2">
                    <input
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      placeholder="Paste Room ID (e.g. room-abc123)..."
                      className="flex-1 px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-mono"
                    />
                    <button
                      onClick={() => {
                        const code = joinCodeInput.trim();
                        if (code) connectAndJoinRoom(code);
                      }}
                      className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs uppercase"
                    >
                      Join 1v1
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(window.location.href);
                        setCopiedInvite(true);
                        setTimeout(() => setCopiedInvite(false), 2000);
                      }}
                      className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase flex items-center gap-1"
                    >
                      {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedInvite ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              )}

              {menuTab === 'weapons' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
                    Weapon Loadout
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                    {WEAPON_LIST.map((w) => {
                      const active = selectedWeapon === w.id;
                      return (
                        <button
                          key={w.id}
                          onClick={() => setSelectedWeapon(w.id)}
                          className={`p-3.5 rounded border text-left transition ${
                            active
                              ? 'bg-amber-500/20 border-amber-400'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm">{w.name}</span>
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">
                              {w.shortName}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mb-2 line-clamp-2">{w.description}</p>
                          <div className="flex gap-3 text-[11px] font-mono text-slate-300">
                            <span>DMG: {w.damage}</span>
                            <span>MAG: {w.magSize}</span>
                            <span>RPM: {Math.round(60000 / w.fireRateMs)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {menuTab === 'settings' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
                    Settings
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="flex justify-between text-xs font-bold uppercase text-slate-400 mb-1">
                        <span>Mouse Sensitivity</span>
                        <span className="tabular-nums">{settings.sensitivity.toFixed(1)}</span>
                      </label>
                      <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        value={settings.sensitivity}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, sensitivity: parseFloat(e.target.value) }))
                        }
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <label className="flex justify-between text-xs font-bold uppercase text-slate-400 mb-1">
                        <span>Field of View (FOV)</span>
                        <span className="tabular-nums">{settings.fov}°</span>
                      </label>
                      <input
                        type="range"
                        min="65"
                        max="110"
                        step="1"
                        value={settings.fov}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, fov: parseInt(e.target.value, 10) }))
                        }
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <label className="flex justify-between text-xs font-bold uppercase text-slate-400 mb-1">
                        <span>Master Volume</span>
                        <span className="tabular-nums">{Math.round(settings.volume * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.volume}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, volume: parseFloat(e.target.value) }))
                        }
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                        Graphics Quality
                      </label>
                      <div className="flex gap-2">
                        {(['low', 'medium', 'high'] as const).map((q) => (
                          <button
                            key={q}
                            onClick={() => setSettings((s) => ({ ...s, graphics: q }))}
                            className={`flex-1 py-1.5 rounded border text-xs font-bold uppercase ${
                              settings.graphics === q
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-950 border-slate-700 text-slate-300'
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {menuTab === 'profile' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
                    Player Profile
                  </h2>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                      Callsign
                    </label>
                    <input
                      value={profile.name}
                      maxLength={18}
                      onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                      className="w-full sm:w-72 px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded bg-slate-950 border border-slate-800">
                      <div className="text-xs text-slate-400 uppercase">Total Kills</div>
                      <div className="text-2xl font-black tabular-nums text-amber-400">
                        {profile.totalKills}
                      </div>
                    </div>
                    <div className="p-3 rounded bg-slate-950 border border-slate-800">
                      <div className="text-xs text-slate-400 uppercase">Total Deaths</div>
                      <div className="text-2xl font-black tabular-nums">{profile.totalDeaths}</div>
                    </div>
                    <div className="p-3 rounded bg-slate-950 border border-slate-800">
                      <div className="text-xs text-slate-400 uppercase">Matches</div>
                      <div className="text-2xl font-black tabular-nums">{profile.gamesPlayed}</div>
                    </div>
                    <div className="p-3 rounded bg-slate-950 border border-slate-800">
                      <div className="text-xs text-slate-400 uppercase">High Score</div>
                      <div className="text-2xl font-black tabular-nums text-emerald-400">
                        {profile.highScore}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {menuTab === 'leaderboard' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
                    Global Leaderboard
                  </h2>
                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {leaderboard.map((entry, idx) => (
                      <div
                        key={entry.name + idx}
                        className="flex items-center justify-between px-3 py-2 rounded bg-slate-950/80 border border-slate-800 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-amber-400 w-6">#{idx + 1}</span>
                          <span className="font-bold">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-6 font-mono text-xs tabular-nums">
                          <span className="text-slate-400">{entry.kills} KILLS</span>
                          <span className="font-bold text-emerald-400">{entry.score} PTS</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Single Flat Control-Hint Line */}
          <div className="text-center text-xs font-mono tracking-wider text-slate-400 uppercase">
            WASD Move · Space Jump · Shift Sprint · Ctrl Crouch · Right-Click Aim · R Reload · Tab Scoreboard · Esc Pause
          </div>
        </div>
      )}

      {/* IN-GAME HUD (Low-occlusion, pointer-events: none) */}
      {screen === 'playing' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Damage Vignette */}
          {hud.damageFlash > 0 && (
            <div
              className="absolute inset-0 border-[18px] border-rose-600/60"
              style={{ opacity: hud.damageFlash }}
            />
          )}

          {/* Top-Left: Kill Feed */}
          <div className="absolute top-4 left-4 space-y-1.5">
            {hud.killFeed.map((kf) => (
              <div
                key={kf.id}
                className="px-3 py-1 rounded bg-slate-950/75 border border-slate-800 text-xs font-semibold flex items-center gap-2"
              >
                <span className="text-amber-400">{kf.killer}</span>
                <span className="text-slate-400">[{kf.weapon}]</span>
                {kf.headshot && <span className="text-rose-400 font-black">HS</span>}
                <span className="text-slate-200">{kf.victim}</span>
              </div>
            ))}
          </div>

          {/* Top-Center: Match Timer & Score */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-1.5 rounded bg-slate-950/80 border border-slate-800 font-mono text-sm font-bold tabular-nums">
            <span className="text-amber-400">{formatTime(hud.timeLeft)}</span>
            <span className="text-slate-400">|</span>
            <span>SCORE {hud.score}</span>
            {settings.showFps && (
              <>
                <span className="text-slate-400">|</span>
                <span className="text-emerald-400">{hud.fps} FPS</span>
              </>
            )}
          </div>

          {/* Realistic Scope Overlays (ADS) */}
          {hud.alive && hud.aiming && hud.scopeType === 'sniper' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-[460px] h-[460px] rounded-full border-[14px] border-slate-950 shadow-[0_0_0_9999px_rgba(2,6,23,0.96),inset_0_0_40px_rgba(0,0,0,0.85)] relative flex items-center justify-center overflow-hidden"
                style={{
                  background:
                    'radial-gradient(circle, rgba(56,189,248,0.03) 0%, rgba(15,23,42,0.12) 72%, rgba(2,6,23,0.65) 100%)',
                }}
              >
                <svg width="460" height="460" viewBox="0 0 460 460" className="w-full h-full">
                  {/* Thin inner crosshairs */}
                  <line x1="0" y1="230" x2="460" y2="230" stroke="rgba(15,23,42,0.85)" strokeWidth="1" />
                  <line x1="230" y1="0" x2="230" y2="460" stroke="rgba(15,23,42,0.85)" strokeWidth="1" />
                  {/* Thick outer duplex posts */}
                  <line x1="0" y1="230" x2="110" y2="230" stroke="#020617" strokeWidth="4" />
                  <line x1="350" y1="230" x2="460" y2="230" stroke="#020617" strokeWidth="4" />
                  <line x1="230" y1="0" x2="230" y2="110" stroke="#020617" strokeWidth="4" />
                  <line x1="230" y1="350" x2="230" y2="460" stroke="#020617" strokeWidth="4" />
                  {/* Mil-dot ticks */}
                  {[-80, -60, -40, -20, 20, 40, 60, 80].map((offset) => (
                    <g key={offset}>
                      <line
                        x1={230 + offset}
                        y1="226"
                        x2={230 + offset}
                        y2="234"
                        stroke="#020617"
                        strokeWidth="1.5"
                      />
                      <line
                        x1="226"
                        y1={230 + offset}
                        x2="234"
                        y2={230 + offset}
                        stroke="#020617"
                        strokeWidth="1.5"
                      />
                    </g>
                  ))}
                  {/* Illuminated center dot */}
                  <circle cx="230" cy="230" r="2.5" fill="#ef4444" />
                </svg>
              </div>
            </div>
          )}

          {hud.alive && hud.aiming && hud.scopeType === 'acog' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-[240px] h-[240px] rounded-full border-[10px] border-slate-900 shadow-[0_0_0_9999px_rgba(2,6,23,0.45),inset_0_0_24px_rgba(0,0,0,0.75)] relative flex items-center justify-center"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,255,255,0.02) 0%, rgba(15,23,42,0.22) 100%)',
                }}
              >
                <svg width="240" height="240" viewBox="0 0 240 240">
                  <line x1="20" y1="120" x2="96" y2="120" stroke="rgba(15,23,42,0.9)" strokeWidth="2" />
                  <line x1="144" y1="120" x2="220" y2="120" stroke="rgba(15,23,42,0.9)" strokeWidth="2" />
                  <line x1="120" y1="126" x2="120" y2="210" stroke="rgba(15,23,42,0.9)" strokeWidth="2" />
                  {/* BDC drop ticks */}
                  <line x1="114" y1="142" x2="126" y2="142" stroke="rgba(15,23,42,0.9)" strokeWidth="1.5" />
                  <line x1="115" y1="162" x2="125" y2="162" stroke="rgba(15,23,42,0.9)" strokeWidth="1.5" />
                  <line x1="116" y1="182" x2="124" y2="182" stroke="rgba(15,23,42,0.9)" strokeWidth="1.5" />
                  {/* Illuminated chevron */}
                  <polyline points="113,125 120,117 127,125" fill="none" stroke="#ef4444" strokeWidth="2.5" />
                </svg>
              </div>
            </div>
          )}

          {hud.alive && hud.aiming && hud.scopeType === 'red_dot' && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div
                className="w-28 h-24 rounded-lg border-4 border-slate-900/90 shadow-[inset_0_0_16px_rgba(0,0,0,0.6)] flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle, rgba(239,68,68,0.04) 0%, rgba(15,23,42,0.18) 100%)',
                }}
              >
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="20" fill="none" stroke="rgba(239,68,68,0.65)" strokeWidth="1.5" />
                  <line x1="32" y1="8" x2="32" y2="15" stroke="rgba(239,68,68,0.8)" strokeWidth="1.5" />
                  <line x1="32" y1="49" x2="32" y2="56" stroke="rgba(239,68,68,0.8)" strokeWidth="1.5" />
                  <line x1="8" y1="32" x2="15" y2="32" stroke="rgba(239,68,68,0.8)" strokeWidth="1.5" />
                  <line x1="49" y1="32" x2="56" y2="32" stroke="rgba(239,68,68,0.8)" strokeWidth="1.5" />
                  <circle cx="32" cy="32" r="2.2" fill="#ef4444" />
                </svg>
              </div>
            </div>
          )}

          {/* Center Crosshair & Hitmarker */}
          {hud.alive && (!hud.aiming || hud.scopeType === 'iron') && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative w-5 h-5 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white shadow" />
                {!hud.aiming && (
                  <>
                    <div className="absolute top-0 w-0.5 h-1.5 bg-white/80" />
                    <div className="absolute bottom-0 w-0.5 h-1.5 bg-white/80" />
                    <div className="absolute left-0 h-0.5 w-1.5 bg-white/80" />
                    <div className="absolute right-0 h-0.5 w-1.5 bg-white/80" />
                  </>
                )}
              </div>
            </div>
          )}

          {hud.alive && hud.hitMarker !== 'none' && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <line
                  x1="4"
                  y1="4"
                  x2="9"
                  y2="9"
                  stroke={hud.hitMarker === 'head' ? '#facc15' : '#ffffff'}
                  strokeWidth="2.5"
                />
                <line
                  x1="20"
                  y1="4"
                  x2="15"
                  y2="9"
                  stroke={hud.hitMarker === 'head' ? '#facc15' : '#ffffff'}
                  strokeWidth="2.5"
                />
                <line
                  x1="4"
                  y1="20"
                  x2="9"
                  y2="15"
                  stroke={hud.hitMarker === 'head' ? '#facc15' : '#ffffff'}
                  strokeWidth="2.5"
                />
                <line
                  x1="20"
                  y1="20"
                  x2="15"
                  y2="15"
                  stroke={hud.hitMarker === 'head' ? '#facc15' : '#ffffff'}
                  strokeWidth="2.5"
                />
              </svg>
            </div>
          )}

          {/* Respawn Overlay */}
          {!hud.alive && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55">
              <div className="text-center">
                <div className="text-3xl font-black uppercase text-rose-500 tracking-widest">
                  Eliminated
                </div>
                <div className="text-sm font-mono text-slate-300 mt-1">
                  Respawning in {Math.max(1, hud.respawnIn)}s...
                </div>
              </div>
            </div>
          )}

          {/* Bottom-Left: Health Bar */}
          <div className="absolute bottom-5 left-5 w-56 bg-slate-950/85 border border-slate-800 rounded p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> Health
              </span>
              <span className="font-mono font-black text-lg tabular-nums text-white">
                {hud.hp}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.hp > 100 ? 'bg-emerald-500' : hud.hp > 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (hud.hp / 200) * 100))}%` }}
              />
            </div>
          </div>

          {/* Bottom-Right: Weapon & Ammo */}
          <div className="absolute bottom-5 right-5 w-56 bg-slate-950/85 border border-slate-800 rounded p-3 text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              {hud.weaponName}
            </div>
            {hud.reloading ? (
              <div className="mt-2">
                <div className="text-xs font-mono text-slate-300 mb-1">RELOADING...</div>
                <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${hud.reloadProgress * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="font-mono font-black text-2xl tabular-nums mt-0.5">
                {hud.ammo} <span className="text-sm text-slate-400">/ {hud.reserve}</span>
              </div>
            )}
          </div>

          {/* Tab Scoreboard */}
          {showScoreboard && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
              <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-lg p-5">
                <div className="text-lg font-black uppercase tracking-wider text-amber-400 mb-3">
                  Scoreboard
                </div>
                <div className="space-y-1.5">
                  {hud.scoreboard.map((row) => (
                    <div
                      key={row.id}
                      className={`flex items-center justify-between px-3 py-2 rounded text-sm font-mono ${
                        row.isLocal
                          ? 'bg-amber-500/20 border border-amber-400/50 text-white'
                          : 'bg-slate-950/80 text-slate-300'
                      }`}
                    >
                      <span className="font-sans font-bold">{row.name}</span>
                      <div className="flex gap-5 tabular-nums text-xs">
                        <span>K: {row.kills}</span>
                        <span>D: {row.deaths}</span>
                        <span className="text-amber-400 font-bold">{row.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAUSE MODAL */}
      {screen === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4 text-center">
            <h2 className="text-2xl font-black uppercase tracking-wider text-amber-400">
              Game Paused
            </h2>
            <button
              onClick={() => {
                setScreen('playing');
                engineRef.current?.requestPointerLock();
              }}
              className="w-full py-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-wider"
            >
              Resume Match
            </button>
            <button
              onClick={leaveMatch}
              className="w-full py-3 rounded bg-slate-800 hover:bg-rose-600 text-white font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4" /> Leave Match
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
