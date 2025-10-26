const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

const cards = [
  {
    id: 'knight',
    name: 'Arena Knight',
    rarity: 'Common',
    cost: 3,
    damage: 250,
    description: 'Reliable melee troop that charges directly at the King tower.',
  },
  {
    id: 'archers',
    name: 'Twin Archers',
    rarity: 'Common',
    cost: 3,
    damage: 180,
    description: 'Two ranged attackers that volley arrows from afar.',
  },
  {
    id: 'giant',
    name: 'Stone Giant',
    rarity: 'Rare',
    cost: 5,
    damage: 600,
    description: 'Massive brute that focuses on enemy towers.',
  },
  {
    id: 'mini_pekka',
    name: 'Mini Mecha',
    rarity: 'Rare',
    cost: 4,
    damage: 700,
    description: 'Single-target robot with devastating swings.',
  },
  {
    id: 'baby_dragon',
    name: 'Baby Dragon',
    rarity: 'Epic',
    cost: 4,
    damage: 350,
    description: 'Flying splash damage attacker that excels against swarms.',
  },
  {
    id: 'fireball',
    name: 'Fireburst',
    rarity: 'Rare',
    cost: 4,
    damage: 430,
    description: 'Area spell that scorches enemy towers for heavy damage.',
  },
  {
    id: 'goblins',
    name: 'Sneaky Goblins',
    rarity: 'Common',
    cost: 2,
    damage: 150,
    description: 'Fast melee trio that swarms towers for chip damage.',
  },
  {
    id: 'musketeer',
    name: 'Musketeer',
    rarity: 'Rare',
    cost: 4,
    damage: 320,
    description: 'Long-ranged troop with consistent DPS.',
  },
  {
    id: 'hog_rider',
    name: 'Hog Rider',
    rarity: 'Epic',
    cost: 4,
    damage: 520,
    description: 'Jumps river and heads straight for the tower.',
  },
  {
    id: 'zap',
    name: 'Zap Bolt',
    rarity: 'Common',
    cost: 2,
    damage: 240,
    description: 'Instant spell that zaps a tower, resetting its charge.',
  },
];

const users = new Map();
const sessions = new Map();
const decks = new Map();

app.post('/users', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  if (users.has(username)) {
    return res.status(409).json({ message: 'Username already exists.' });
  }
  const user = { id: uuidv4(), username, password };
  users.set(username, user);
  decks.set(user.id, cards.slice(0, 5).map((card) => card.id));
  return res.status(201).json({ message: 'User registered successfully.' });
});

app.post('/sessions', (req, res) => {
  const { username, password } = req.body;
  const user = users.get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }
  const token = uuidv4();
  sessions.set(token, user);
  return res.json({ token, user: { id: user.id, username: user.username } });
});

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Missing authorization header.' });
  }
  const token = authHeader.replace('Bearer ', '');
  const user = sessions.get(token);
  if (!user) {
    return res.status(401).json({ message: 'Invalid session.' });
  }
  req.user = user;
  req.token = token;
  next();
}

app.get('/cards', authenticate, (req, res) => {
  res.json({ cards });
});

app.get('/profile', authenticate, (req, res) => {
  const deck = decks.get(req.user.id) || [];
  res.json({ user: { id: req.user.id, username: req.user.username }, deck });
});

app.post('/deck', authenticate, (req, res) => {
  const { deck } = req.body;
  if (!Array.isArray(deck) || deck.length !== 8) {
    return res.status(400).json({ message: 'Deck must contain exactly 8 cards.' });
  }
  const invalid = deck.some((cardId) => !cards.find((card) => card.id === cardId));
  if (invalid) {
    return res.status(400).json({ message: 'Deck contains unknown cards.' });
  }
  decks.set(req.user.id, deck);
  res.json({ message: 'Deck saved successfully.' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const matchQueue = [];
const matches = new Map();
const socketToMatch = new Map();

function createInitialMatchState(playerA, playerB) {
  return {
    id: uuidv4(),
    players: {
      [playerA.user.id]: {
        user: playerA.user,
        elixir: 5,
        crowns: 0,
      },
      [playerB.user.id]: {
        user: playerB.user,
        elixir: 5,
        crowns: 0,
      },
    },
    towers: {
      [playerA.user.id]: 4000,
      [playerB.user.id]: 4000,
    },
    sockets: {
      [playerA.user.id]: playerA.socket,
      [playerB.user.id]: playerB.socket,
    },
    interval: null,
  };
}

function emitMatchState(match) {
  const state = {
    id: match.id,
    towers: match.towers,
    players: Object.fromEntries(
      Object.entries(match.players).map(([id, data]) => [id, { elixir: data.elixir, crowns: data.crowns }])
    ),
  };
  Object.values(match.sockets).forEach((socket) => socket.emit('match:state', state));
}

function startMatch(playerA, playerB) {
  const match = createInitialMatchState(playerA, playerB);
  matches.set(match.id, match);
  socketToMatch.set(playerA.socket.id, match.id);
  socketToMatch.set(playerB.socket.id, match.id);

  match.interval = setInterval(() => {
    Object.values(match.players).forEach((player) => {
      player.elixir = Math.min(player.elixir + 1, 10);
    });
    emitMatchState(match);
  }, 2000);

  emitMatchState(match);
  Object.values(match.sockets).forEach((socket) => socket.emit('match:start', { id: match.id }));
}

function completeMatch(match, winnerId) {
  clearInterval(match.interval);
  Object.values(match.sockets).forEach((socket) => socket.emit('match:ended', { winnerId }));
  matches.delete(match.id);
  Object.values(match.sockets).forEach((socket) => socketToMatch.delete(socket.id));
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Missing token'));
  }
  const user = sessions.get(token);
  if (!user) {
    return next(new Error('Invalid token'));
  }
  socket.user = user;
  return next();
});

io.on('connection', (socket) => {
  socket.on('queue:join', () => {
    if (matchQueue.find((queued) => queued.socket.id === socket.id)) {
      return;
    }
    matchQueue.push({ socket, user: socket.user });
    if (matchQueue.length >= 2) {
      const [playerA, playerB] = matchQueue.splice(0, 2);
      startMatch(playerA, playerB);
    } else {
      socket.emit('queue:waiting');
    }
  });

  socket.on('queue:leave', () => {
    const index = matchQueue.findIndex((queued) => queued.socket.id === socket.id);
    if (index >= 0) {
      matchQueue.splice(index, 1);
      socket.emit('queue:left');
    }
  });

  socket.on('match:playCard', (cardId) => {
    const matchId = socketToMatch.get(socket.id);
    if (!matchId) {
      return;
    }
    const match = matches.get(matchId);
    if (!match) {
      return;
    }
    const player = match.players[socket.user.id];
    const opponentId = Object.keys(match.players).find((id) => id !== socket.user.id);
    if (!player) {
      return;
    }
    const deck = decks.get(socket.user.id) || [];
    if (!deck.includes(cardId)) {
      socket.emit('match:error', { message: 'Card not in deck.' });
      return;
    }
    const card = cards.find((item) => item.id === cardId);
    if (!card) {
      socket.emit('match:error', { message: 'Unknown card.' });
      return;
    }
    if (player.elixir < card.cost) {
      socket.emit('match:error', { message: 'Not enough elixir.' });
      return;
    }
    player.elixir -= card.cost;
    match.towers[opponentId] -= card.damage;
    if (match.towers[opponentId] <= 0) {
      player.crowns += 3;
      completeMatch(match, socket.user.id);
    } else {
      emitMatchState(match);
    }
  });

  socket.on('disconnect', () => {
    const queueIndex = matchQueue.findIndex((queued) => queued.socket.id === socket.id);
    if (queueIndex >= 0) {
      matchQueue.splice(queueIndex, 1);
    }
    const matchId = socketToMatch.get(socket.id);
    if (matchId) {
      const match = matches.get(matchId);
      if (match) {
        const opponentId = Object.keys(match.players).find((id) => id !== socket.user.id);
        completeMatch(match, opponentId);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`MiniCR server listening on port ${PORT}`);
});
