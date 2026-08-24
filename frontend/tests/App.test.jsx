import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../src/App.jsx';

vi.mock('../src/api/workOrdersApi.js', () => ({
  workOrdersApi: {
    list: vi.fn().mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    }),
    getById: vi.fn(),
  },
}));

describe('App', () => {
  it('renders the Phase 1 application shell and order route', async () => {
    render(
      <MemoryRouter initialEntries={['/orders']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /pavas taller/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /órdenes de trabajo/i })).toBeInTheDocument();
    expect(await screen.findByText(/aún no hay órdenes/i)).toBeInTheDocument();
  });

  it('renders a friendly not-found page for unknown frontend routes', () => {
    render(
      <MemoryRouter initialEntries={['/ruta-inexistente']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /página no encontrada/i })).toBeInTheDocument();
  });
});
