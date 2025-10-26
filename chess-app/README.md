# MiniCR Fan Arena

MiniCR is a nonprofit fan-made Clash Royale tribute built for educational purposes. The project demonstrates how to stitch together a lightweight Socket.IO backend with a React front end, simplified matchmaking, and a curated set of ten familiar-style cards.

## Features

- **Account creation and login.** Minimal username/password authentication with session tokens.
- **Deck building.** Choose eight cards from a roster of ten lovingly recreated units and spells.
- **Online arena.** Socket.IO server pairs queued players and synchronizes tower health, elixir flow, and match outcomes in real time.
- **Fair-use friendly.** All artwork and names are original while capturing the same strategic beats of the Clash Royale experience.

## Project structure

```
MiniCR/
├── chess-app/        # React front end (Create React App)
└── server/           # Express + Socket.IO backend
```

## Getting started

Install dependencies for both the server and client:

```bash
cd server
npm install
cd ../chess-app
npm install
```

### Running the development stack

Start the backend server (port `4000` by default):

```bash
cd server
npm start
```

In a new terminal, run the React development server:

```bash
cd chess-app
npm start
```

Open <http://localhost:3000> to experience the MiniCR arena.

### Environment variables

The client automatically proxies API calls to `http://localhost:4000` in development. To point at a different backend, set `REACT_APP_API_BASE` before running `npm start`.

### Production build

```bash
cd chess-app
npm run build
```

This produces a static build in `chess-app/build` that can be deployed alongside the Node.js server.

## Disclaimer

MiniCR is an unofficial fan project and is not affiliated with, endorsed, or sponsored by Supercell. All trademarks belong to their respective owners.
