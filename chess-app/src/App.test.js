import { render, screen } from '@testing-library/react';
import App from './App';

describe('MiniCR Fan Arena', () => {
  it('renders hero title', () => {
    render(<App />);
    expect(screen.getByText(/MiniCR Fan Arena/i)).toBeInTheDocument();
  });

  it('renders authentication panel when logged out', () => {
    render(<App />);
    expect(screen.getByText(/Enter the Arena/i)).toBeInTheDocument();
  });
});
