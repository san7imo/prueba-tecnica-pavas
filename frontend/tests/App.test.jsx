import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App.jsx';
import { authApi } from '../src/api/authApi.js';
import { usersApi } from '../src/api/usersApi.js';
import { adminUser, mechanicUser } from './testUtils.jsx';

vi.mock('../src/api/authApi.js', () => ({
  authApi: { login: vi.fn(), refresh: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

vi.mock('../src/api/usersApi.js', () => ({
  usersApi: { list: vi.fn(), create: vi.fn(), changeRole: vi.fn(), changeActive: vi.fn() },
}));

vi.mock('../src/api/workOrdersApi.js', () => ({
  workOrdersApi: {
    list: vi.fn().mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    }),
    getById: vi.fn(),
  },
}));

const sessionFor = (user) => ({ user, accessToken: `${user.role.toLowerCase()}-token` });

describe('App routing and session gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.refresh.mockResolvedValue(sessionFor(adminUser));
    authApi.logout.mockResolvedValue({ loggedOut: true });
    usersApi.list.mockResolvedValue([]);
  });

  it('restores an authenticated session before rendering the protected application shell', async () => {
    render(<MemoryRouter initialEntries={['/orders']}><App /></MemoryRouter>);

    expect(screen.getByText(/restaurando sesión/i)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /pavas taller/i })).toBeInTheDocument();
    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /usuarios/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^clientes$/i })).toHaveAttribute('href', '/clients');
    expect(screen.getByRole('link', { name: /^motocicletas$/i })).toHaveAttribute('href', '/bikes');
    expect(await screen.findByText(/aún no hay órdenes/i)).toBeInTheDocument();
  });

  it('redirects an anonymous visitor to login and authenticates with a generic form', async () => {
    authApi.refresh.mockRejectedValue({ response: { status: 401 } });
    authApi.login.mockResolvedValue(sessionFor(mechanicUser));
    render(<MemoryRouter initialEntries={['/orders']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/correo/i)).toBeRequired();
    expect(screen.getByLabelText(/contraseña/i)).toBeRequired();
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));
    expect(screen.getByText(/ingresa tu correo y contraseña/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'mauro@pavas.test' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith({ email: 'mauro@pavas.test', password: 'secret123' }));
    expect(await screen.findByText('Mauro Mecánico')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /usuarios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nueva orden/i })).not.toBeInTheDocument();
  });

  it('never exposes backend credential-discovery details on login failure', async () => {
    authApi.refresh.mockRejectedValue({ response: { status: 401 } });
    authApi.login.mockRejectedValue({ response: { status: 401, data: { error: { message: 'Email exists but password is wrong.' } } } });
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
    await screen.findByRole('heading', { name: /iniciar sesión/i });

    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'someone@example.test' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText('Correo o contraseña inválidos.')).toBeInTheDocument();
    expect(screen.queryByText(/email exists/i)).not.toBeInTheDocument();
  });

  it('redirects an authenticated visitor away from login', async () => {
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /órdenes de trabajo/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });

  it('redirects a mechanic away from the ADMIN-only user route', async () => {
    authApi.refresh.mockResolvedValue(sessionFor(mechanicUser));
    render(<MemoryRouter initialEntries={['/admin/users']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /órdenes de trabajo/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^usuarios$/i })).not.toBeInTheDocument();
    expect(usersApi.list).not.toHaveBeenCalled();
  });

  it('redirects a mechanic away from master-data mutation routes', async () => {
    authApi.refresh.mockResolvedValue(sessionFor(mechanicUser));
    render(<MemoryRouter initialEntries={['/clients/new']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /órdenes de trabajo/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /nuevo cliente/i })).not.toBeInTheDocument();
  });

  it('redirects a mechanic away from the new work-order flow', async () => {
    authApi.refresh.mockResolvedValue(sessionFor(mechanicUser));
    render(<MemoryRouter initialEntries={['/orders/new']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /órdenes de trabajo/i }))
      .toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /nueva orden de trabajo/i }))
      .not.toBeInTheDocument();
  });

  it('allows an administrator into user management', async () => {
    render(<MemoryRouter initialEntries={['/admin/users']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /^usuarios$/i })).toBeInTheDocument();
    await waitFor(() => expect(usersApi.list).toHaveBeenCalledTimes(1));
  });

  it('renders a friendly not-found page inside authenticated routes', async () => {
    render(<MemoryRouter initialEntries={['/ruta-inexistente']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /página no encontrada/i })).toBeInTheDocument();
  });
});
