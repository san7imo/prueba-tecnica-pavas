import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usersApi } from '../src/api/usersApi.js';
import { UsersPage } from '../src/pages/UsersPage.jsx';
import { adminUser, authValue, mechanicUser, renderWithAuth } from './testUtils.jsx';

vi.mock('../src/api/usersApi.js', () => ({
  usersApi: { list: vi.fn(), create: vi.fn(), changeRole: vi.fn(), changeActive: vi.fn() },
}));

const managedAdmin = { ...adminUser, createdAt: '2026-08-20T12:00:00.000Z', updatedAt: '2026-08-20T12:00:00.000Z' };
const managedMechanic = { ...mechanicUser, createdAt: '2026-08-21T12:00:00.000Z', updatedAt: '2026-08-21T12:00:00.000Z' };

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usersApi.list.mockResolvedValue([managedAdmin, managedMechanic]);
  });

  it('lists users and creates a user without exposing delete operations', async () => {
    const created = { id: 3, name: 'Nora Técnica', email: 'nora@pavas.test', role: 'MECANICO', active: true, createdAt: '2026-08-24T12:00:00.000Z', updatedAt: '2026-08-24T12:00:00.000Z' };
    usersApi.create.mockResolvedValue(created);
    renderWithAuth(<UsersPage />);

    expect(await screen.findByText('Mauro Mecánico')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /^nombre$/i }), { target: { value: 'Nora Técnica' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^correo$/i }), { target: { value: 'nora@pavas.test' } });
    fireEvent.change(screen.getByLabelText(/contraseña inicial/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(usersApi.create).toHaveBeenCalledWith({ name: 'Nora Técnica', email: 'nora@pavas.test', password: 'secret123', role: 'MECANICO' }));
    expect(await screen.findByText(/usuario nora técnica creado/i)).toBeInTheDocument();
  });

  it('changes roles and confirms deactivation before applying it', async () => {
    usersApi.changeRole.mockResolvedValue({ ...managedMechanic, role: 'ADMIN' });
    usersApi.changeActive.mockResolvedValue({ ...managedMechanic, active: false });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithAuth(<UsersPage />, { auth: authValue(adminUser) });
    await screen.findByText('Mauro Mecánico');

    fireEvent.change(screen.getByRole('combobox', { name: /rol de mauro/i }), { target: { value: 'ADMIN' } });
    expect(usersApi.changeRole).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /guardar rol de mauro/i }));
    await waitFor(() => expect(usersApi.changeRole).toHaveBeenCalledWith(2, 'ADMIN'));
    fireEvent.click(screen.getByRole('button', { name: /desactivar a mauro/i }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/desactivar a mauro/i));
    await waitFor(() => expect(usersApi.changeActive).toHaveBeenCalledWith(2, false));
  });

  it('exposes the user table as a keyboard-focusable labeled region', async () => {
    renderWithAuth(<UsersPage />);

    await screen.findByText('Mauro Mecánico');
    expect(screen.getByRole('region', { name: /tabla de usuarios/i })).toHaveAttribute('tabindex', '0');
  });

  it('shows loading, reports a list error and retries to an empty state', async () => {
    usersApi.list
      .mockRejectedValueOnce({ response: { data: { error: { message: 'Usuarios temporalmente no disponibles.' } } } })
      .mockResolvedValueOnce([]);
    renderWithAuth(<UsersPage />);

    expect(screen.getByText(/cargando usuarios/i)).toBeInTheDocument();
    expect(await screen.findByText('Usuarios temporalmente no disponibles.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByRole('heading', { name: /sin usuarios/i })).toBeInTheDocument();
    expect(usersApi.list).toHaveBeenCalledTimes(2);
  });

  it('disables duplicate creation and shows the safe API error', async () => {
    let rejectCreation;
    usersApi.create.mockReturnValue(new Promise((_resolve, reject) => {
      rejectCreation = reject;
    }));
    renderWithAuth(<UsersPage />);
    await screen.findByText('Mauro Mecánico');

    fireEvent.change(screen.getByRole('textbox', { name: /^nombre$/i }), { target: { value: 'Nora Técnica' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^correo$/i }), { target: { value: 'nora@pavas.test' } });
    fireEvent.change(screen.getByLabelText(/contraseña inicial/i), { target: { value: 'secret123' } });
    const submit = screen.getByRole('button', { name: /crear usuario/i });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(usersApi.create).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /creando/i })).toBeDisabled();
    rejectCreation({ response: { data: { error: { message: 'El correo ya está registrado.' } } } });
    expect(await screen.findByText('El correo ya está registrado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear usuario/i })).toBeEnabled();
  });

  it('reactivates an inactive user without destructive confirmation', async () => {
    const inactiveMechanic = { ...managedMechanic, active: false };
    usersApi.list.mockResolvedValue([managedAdmin, inactiveMechanic]);
    usersApi.changeActive.mockResolvedValue({ ...inactiveMechanic, active: true });
    const confirm = vi.spyOn(window, 'confirm');
    renderWithAuth(<UsersPage />);
    await screen.findByText('Mauro Mecánico');

    fireEvent.click(screen.getByRole('button', { name: /activar a mauro/i }));

    await waitFor(() => expect(usersApi.changeActive).toHaveBeenCalledWith(2, true));
    expect(await screen.findByText(/mauro mecánico fue activado/i)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });
});
