import { useEffect, useMemo, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || '';

const MATCH_STATES = {
  IDLE: 'IDLE',
  QUEUE: 'QUEUE',
  ACTIVE: 'ACTIVE',
  FINISHED: 'FINISHED',
};

function AuthPanel({ onAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'register') {
        await axios.post(`${API_BASE}/users`, { username, password });
      }
      const response = await axios.post(`${API_BASE}/sessions`, { username, password });
      const { token, user } = response.data;
      onAuthenticated({ token, user });
      setUsername('');
      setPassword('');
    } catch (err) {
      const message = err.response?.data?.message || 'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <h2>{mode === 'login' ? 'Enter the Arena' : 'Sign Up for MiniCR'}</h2>
      <p className="hero-subtitle">
        MiniCR is an unofficial, non-commercial fan project inspired by Clash Royale. Create a profile and battle with a simplified roster of cards.
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          required
        />
        <div className="button-group">
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Register & Login'}
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setMode((prev) => (prev === 'login' ? 'register' : 'login'));
              setError(null);
            }}
          >
            {mode === 'login' ? 'Need an account?' : 'Have an account?'}
          </button>
        </div>
        {error ? <div className="error-banner">{error}</div> : null}
      </form>
    </section>
  );
}

function DeckBuilder({ cards, deck, onDeckChange, onSave, saving }) {
  const toggleCard = (cardId) => {
    if (deck.includes(cardId)) {
      onDeckChange(deck.filter((id) => id !== cardId));
    } else if (deck.length < 8) {
      onDeckChange([...deck, cardId]);
    }
  };

  return (
    <section className="panel">
      <h2>Your Battle Deck</h2>
      <p className="hero-subtitle">
        Choose 8 cards out of the 10 available. Each card mirrors the feel of its Clash Royale counterpart while staying within fair-use limits.
      </p>
      <div className="deck-counter">Selected {deck.length} / 8</div>
      <div className="deck-grid">
        {cards.map((card) => {
          const selected = deck.includes(card.id);
          return (
            <article
              key={card.id}
              className={`card ${selected ? 'selected' : ''}`}
              onClick={() => toggleCard(card.id)}
            >
              <span className="badge">{card.rarity}</span>
              <h3>{card.name}</h3>
              <p><strong>Elixir:</strong> {card.cost}</p>
              <p><strong>Damage:</strong> {card.damage}</p>
              <p>{card.description}</p>
            </article>
          );
        })}
      </div>
      <div className="button-group" style={{ marginTop: '2rem' }}>
        <button className="button" type="button" disabled={deck.length !== 8 || saving} onClick={onSave}>
          {saving ? 'Saving...' : 'Save Deck'}
        </button>
      </div>
    </section>
  );
}

function MatchInterface({ user, cards, deck, token }) {
  const [matchState, setMatchState] = useState(MATCH_STATES.IDLE);
  const [socket, setSocket] = useState(null);
  const [battleState, setBattleState] = useState(null);
  const [error, setError] = useState(null);
  const [winner, setWinner] = useState(null);

  const cardLookup = useMemo(() => Object.fromEntries(cards.map((card) => [card.id, card])), [cards]);

  useEffect(() => {
    const newSocket = io('/', {
      transports: ['websocket'],
      auth: { token },
    });

    newSocket.on('connect_error', (err) => {
      setError(err.message);
    });

    newSocket.on('queue:waiting', () => {
      setMatchState(MATCH_STATES.QUEUE);
    });

    newSocket.on('match:start', () => {
      setMatchState(MATCH_STATES.ACTIVE);
      setWinner(null);
    });

    newSocket.on('match:state', (state) => {
      setBattleState(state);
    });

    newSocket.on('match:error', ({ message }) => {
      setError(message);
    });

    newSocket.on('match:ended', ({ winnerId }) => {
      setWinner(winnerId);
      setMatchState(MATCH_STATES.FINISHED);
    });

    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  const joinQueue = () => {
    setError(null);
    setWinner(null);
    socket?.emit('queue:join');
    setMatchState(MATCH_STATES.QUEUE);
  };

  const leaveQueue = () => {
    socket?.emit('queue:leave');
    setMatchState(MATCH_STATES.IDLE);
  };

  const playCard = (cardId) => {
    if (matchState !== MATCH_STATES.ACTIVE) {
      return;
    }
    setError(null);
    socket?.emit('match:playCard', cardId);
  };

  const renderBattlefield = () => {
    if (!battleState) {
      return <p>Waiting for battle state...</p>;
    }
    const you = battleState.players[user.id];
    const opponentId = Object.keys(battleState.players).find((id) => id !== user.id);
    const opponent = battleState.players[opponentId];

    return (
      <div className="match-container">
        <div className="tower-card">
          <h3>Your King Tower</h3>
          <div className="tower-health">{Math.max(battleState.towers[user.id], 0)} HP</div>
          <p>Crowns: {you?.crowns ?? 0}</p>
          <div className="elixir-bar">
            <div className="elixir-fill" style={{ width: `${(Math.min(you?.elixir ?? 0, 10) / 10) * 100}%` }} />
          </div>
        </div>
        <div className="tower-card">
          <h3>Opponent Tower</h3>
          <div className="tower-health">{Math.max(battleState.towers[opponentId] ?? 0, 0)} HP</div>
          <p>Crowns: {opponent?.crowns ?? 0}</p>
          <div className="elixir-bar">
            <div className="elixir-fill" style={{ width: `${(Math.min(opponent?.elixir ?? 0, 10) / 10) * 100}%` }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="panel">
      <h2>Arena</h2>
      <p className="hero-subtitle">
        Queue to face another online player. Matches resolve in real-time using our lightweight Socket.IO server.
      </p>
      <div className="button-group" style={{ marginBottom: '1rem' }}>
        {matchState !== MATCH_STATES.QUEUE && matchState !== MATCH_STATES.ACTIVE ? (
          <button className="button" type="button" onClick={joinQueue} disabled={!socket}>
            {socket ? 'Enter Queue' : 'Connecting...'}
          </button>
        ) : (
          <button className="button danger" type="button" onClick={leaveQueue}>
            Leave Queue
          </button>
        )}
      </div>
      {matchState === MATCH_STATES.QUEUE ? <p>Waiting for an opponent...</p> : null}
      {matchState === MATCH_STATES.ACTIVE ? renderBattlefield() : null}
      {matchState === MATCH_STATES.FINISHED ? (
        <div>
          <h3>{winner === user.id ? 'Victory! 🎉' : 'Defeat 💀'}</h3>
          <button className="button" type="button" onClick={() => setMatchState(MATCH_STATES.IDLE)}>
            Queue Again
          </button>
        </div>
      ) : null}
      <div style={{ marginTop: '2rem' }}>
        <h3>Your Cards</h3>
        <div className="deck-grid">
          {deck.map((cardId) => {
            const card = cardLookup[cardId];
            if (!card) {
              return null;
            }
            return (
              <article key={cardId} className="card" onClick={() => playCard(cardId)}>
                <span className="badge">{card.rarity}</span>
                <h3>{card.name}</h3>
                <p><strong>Elixir:</strong> {card.cost}</p>
                <p><strong>Damage:</strong> {card.damage}</p>
                <p>{card.description}</p>
              </article>
            );
          })}
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
    </section>
  );
}

function Dashboard({ auth, onLogout }) {
  const [cards, setCards] = useState([]);
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tokenHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${auth.token}` } }), [auth.token]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [cardsRes, profileRes] = await Promise.all([
          axios.get(`${API_BASE}/cards`, tokenHeader),
          axios.get(`${API_BASE}/profile`, tokenHeader),
        ]);
        if (!cancelled) {
          setCards(cardsRes.data.cards);
          setDeck(profileRes.data.deck);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [tokenHeader]);

  const saveDeck = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/deck`, { deck }, tokenHeader);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="panel">
        <h2>Loading Arena Data...</h2>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <h2>Welcome, {auth.user.username}!</h2>
        <p className="hero-subtitle">
          Build your deck, then jump into online matches. MiniCR is a community-made tribute with brand-new tech under the hood.
        </p>
        <div className="button-group">
          <button className="button secondary" type="button" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </section>
      <DeckBuilder cards={cards} deck={deck} onDeckChange={setDeck} onSave={saveDeck} saving={saving} />
      <MatchInterface user={auth.user} cards={cards} deck={deck} token={auth.token} />
    </>
  );
}

function App() {
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem('minicr-session');
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored);
    } catch (error) {
      return null;
    }
  });

  const handleAuthenticated = (session) => {
    localStorage.setItem('minicr-session', JSON.stringify(session));
    setAuth(session);
  };

  const handleLogout = () => {
    localStorage.removeItem('minicr-session');
    setAuth(null);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="hero-title">MiniCR Fan Arena</h1>
        <p className="hero-subtitle">A nonprofit fan-made homage to Clash Royale with simplified mechanics.</p>
      </header>
      {auth ? <Dashboard auth={auth} onLogout={handleLogout} /> : <AuthPanel onAuthenticated={handleAuthenticated} />}
      <footer>
        MiniCR is a passion project for educational purposes. Clash Royale and related assets are properties of Supercell.
      </footer>
    </div>
  );
}

export default App;
