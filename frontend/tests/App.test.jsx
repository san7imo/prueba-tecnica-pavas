import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App.jsx';
import { auditApi } from '../src/api/auditApi.js';
import { authApi } from '../src/api/authApi.js';
import { usersApi } from '../src/api/usersApi.js';
import { adminUser, mechanicUser } from './testUtils.jsx';

vi.mock('../src/api/authApi.js', () => ({
  authApi: { login: vi.fn(), refresh: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

vi.mock('../src/api/auditApi.js', () => ({
  auditApi: { list: vi.fn(), getById: vi.fn() },
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
    auditApi.list.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
  });

  it('restores an authenticated session before rendering the protected application shell', async () => {
    render(<MemoryRouter initialEntries={['/orders']}><App /></MemoryRouter>);

    expect(screen.getByText(/restaurando sesión/i)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /pavas taller/i })).toBeInTheDocument();
    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /usuarios/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /auditoría/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^clientes$/i })).toHaveAttribute('href', '/clients');
    expect(screen.getByRole('link', { name: /^motocicletas$/i })).toHaveAttribute('href', '/bikes');
    expect(await screen.findByText(/aún no hay órdenes/i)).toBeInTheDocument();
    expect(document.getElementById('main-content')).toHaveFocus();
  });

  it('moves keyboard focus to main content after client-side navigation', async () => {
    render(<MemoryRouter initialEntries={['/orders']}><App /></MemoryRouter>);
    await screen.findByText(/aún no hay órdenes/i);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    dashboardLink.focus();
    fireEvent.click(dashboardLink);

    expect(await screen.findByRole('heading', { name: /dashboard/i }))
      .toBeInTheDocument();
    await waitFor(() => expect(document.getElementById('main-content')).toHaveFocus());
  });

  it('uses the operational dashboard as the authenticated home route', async () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /dashboard/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pavas taller/i }))
      .toHaveAttribute('href', '/dashboard');
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
    expect((await screen.findAllByText('Mauro Mecánico')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /usuarios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /auditoría/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nueva orden/i })).not.toBeInTheDocument();
  });

  it('returns to the complete requested route after authentication', async () => {
    authApi.refresh.mockRejectedValue({ response: { status: 401 } });
    authApi.login.mockResolvedValue(sessionFor(mechanicUser));
    render(
      <MemoryRouter initialEntries={['/orders?scope=mine&status=DIAGNOSTICO#queue']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: /iniciar sesión/i });

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: 'mauro@pavas.test' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByRole('heading', { name: /mis órdenes/i }))
      .toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toHaveValue('DIAGNOSTICO');
  });

  it('prevents duplicate logout submissions while the request is pending', async () => {
    let resolveLogout;
    authApi.logout.mockReturnValue(new Promise((resolve) => {
      resolveLogout = resolve;
    }));
    render(<MemoryRouter initialEntries={['/orders']}><App /></MemoryRouter>);
    await screen.findByText(/aún no hay órdenes/i);

    const logout = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(logout);
    fireEvent.click(logout);

    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /cerrando sesión/i })).toBeDisabled();
    resolveLogout({ loggedOut: true });
    expect(await screen.findByRole('heading', { name: /iniciar sesión/i }))
      .toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });

  it('redirects a mechanic away from the ADMIN-only user route', async () => {
    authApi.refresh.mockResolvedValue(sessionFor(mechanicUser));
    render(<MemoryRouter initialEntries={['/admin/users']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^usuarios$/i })).not.toBeInTheDocument();
    expect(usersApi.list).not.toHaveBeenCalled();
  });

  it('redirects a mechanic away from ADMIN audit routes', async () => {
    authApi.refresh.mockResolvedValue(sessionFor(mechanicUser));
    render(<MemoryRouter initialEntries={['/admin/audit/41']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(auditApi.getById).not.toHaveBeenCalled();
  });

  it('redirects a mechanic away from master-data mutation routes', async () => {
    authApi.refresh.mockResolvedValue(sessionFor(mechanicUser));
    render(<MemoryRouter initialEntries={['/clients/new']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /nuevo cliente/i })).not.toBeInTheDocument();
  });

  it('redirects a mechanic away from the new work-order flow', async () => {
    authApi.refresh.mockResolvedValue(sessionFor(mechanicUser));
    render(<MemoryRouter initialEntries={['/orders/new']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /dashboard/i }))
      .toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /nueva orden de trabajo/i }))
      .not.toBeInTheDocument();
  });

  it('allows an administrator into user management', async () => {
    render(<MemoryRouter initialEntries={['/admin/users']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /^usuarios$/i })).toBeInTheDocument();
    await waitFor(() => expect(usersApi.list).toHaveBeenCalledTimes(1));
  });

  it('allows only ADMIN to enter the audit views', async () => {
    render(<MemoryRouter initialEntries={['/admin/audit']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /^auditoría$/i }))
      .toBeInTheDocument();
    expect(auditApi.list).toHaveBeenCalledTimes(1);
  });

  it('renders a friendly not-found page inside authenticated routes', async () => {
    render(<MemoryRouter initialEntries={['/ruta-inexistente']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /página no encontrada/i })).toBeInTheDocument();
  });
});
