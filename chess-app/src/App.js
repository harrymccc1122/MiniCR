import { useState, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

function App() {
  const game = useRef(new Chess());
  const [fen, setFen] = useState(game.current.fen());
  const [message, setMessage] = useState('');

  function onDrop(sourceSquare, targetSquare) {
    try {
      const move = game.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // always promote to a queen for simplicity
      });

      // illegal move
      if (move === null) {
        return;
      }

      setFen(game.current.fen());
      updateStatus();
    } catch (error) {
      // invalid move
      return;
    }
  }

  function updateStatus() {
    if (game.current.isCheckmate()) {
      setMessage(`Checkmate! ${game.current.turn() === 'w' ? 'Black' : 'White'} wins.`);
    } else if (game.current.isStalemate()) {
      setMessage('Stalemate!');
    } else if (game.current.isDraw()) {
      setMessage('Draw!');
    } else if (game.current.in_check()) {
      setMessage('Check!');
    } else {
      setMessage('');
    }
  }

  function resetGame() {
    game.current.reset();
    setFen(game.current.fen());
    setMessage('');
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <Chessboard position={fen} onPieceDrop={onDrop} />
      {message && <p>{message}</p>}
      <button onClick={resetGame} style={{ marginTop: '20px' }}>Reset Game</button>
    </div>
  );
}

export default App;

