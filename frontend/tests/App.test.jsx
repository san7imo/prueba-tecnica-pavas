import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { App } from '../src/App.jsx';

describe('App', () => {
  it('renders the HITO 0 technical foundation', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: /moto workshop/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/foundation initialized/i)).toBeInTheDocument();
  });
});

