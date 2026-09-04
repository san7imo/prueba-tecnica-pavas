import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bikesApi } from '../src/api/bikesApi.js';
import { clientsApi } from '../src/api/clientsApi.js';
import { ClientDetailPage } from '../src/pages/ClientDetailPage.jsx';
import { ClientFormPage } from '../src/pages/ClientFormPage.jsx';
import { ClientsPage } from '../src/pages/ClientsPage.jsx';
import { mechanicUser, renderWithAuth } from './testUtils.jsx';

vi.mock('../src/api/clientsApi.js', () => ({ clientsApi: { list: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), restore: vi.fn() } }));
vi.mock('../src/api/bikesApi.js', () => ({ bikesApi: { list: vi.fn() } }));

const client = { id: 1, name: 'Ana Torres', phone: '3001234567', email: 'ana@example.com', lifecycle: 'active', deletedAt: null, deleteReason: null };
const meta = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };

describe('Client master screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientsApi.list.mockResolvedValue({ data: [client], meta });
    clientsApi.getById.mockResolvedValue(client);
    bikesApi.list.mockResolvedValue({ data: [], meta: { ...meta, pageSize: 10, totalItems: 0, totalPages: 0 } });
  });

  it('lists and filters lifecycle for ADMIN, with paginated API parameters', async () => {
    renderWithAuth(<MemoryRouter><ClientsPage /></MemoryRouter>);
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nuevo cliente/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/nombre, teléfono o correo/i), { target: { value: '  Ana  ' } });
    fireEvent.change(screen.getByLabelText(/estado del registro/i), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    await waitFor(() => expect(clientsApi.list).toHaveBeenLastCalledWith({ search: 'Ana', lifecycle: 'all', page: 1, pageSize: 20 }));
  });

  it('keeps mechanic client views read-only and active-only', async () => {
    renderWithAuth(<MemoryRouter><ClientsPage /></MemoryRouter>, { auth: { user: mechanicUser, accessToken: 'token', isAuthenticated: true, isLoading: false, sessionMessage: '', login: vi.fn(), logout: vi.fn() } });
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nuevo cliente/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/estado del registro/i)).not.toBeInTheDocument();
    expect(clientsApi.list).toHaveBeenCalledWith(expect.objectContaining({ lifecycle: 'active' }));
  });

  it('resolves duplicate risk explicitly before creating a client', async () => {
    clientsApi.create
      .mockRejectedValueOnce({ response: { status: 409, data: { error: { code: 'CLIENT_DUPLICATE_RISK', message: 'Contacto duplicado.', details: { candidateIds: ['1'], matchedFields: ['phone'] } } } } })
      .mockResolvedValueOnce({ ...client, id: 2, name: 'Beatriz Torres' });
    renderWithAuth(<MemoryRouter initialEntries={['/clients/new']}><Routes><Route path="/clients/new" element={<ClientFormPage />} /><Route path="/clients/:id" element={<h1>Cliente guardado</h1>} /></Routes></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Beatriz Torres' } });
    fireEvent.change(screen.getByLabelText(/^teléfono/i), { target: { value: '3001234567' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cliente/i }));

    expect(await screen.findByText(/posibles duplicados/i)).toBeInTheDocument();
    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/justificación para conservar/i), { target: { value: 'Familiares que comparten teléfono.' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar duplicado/i }));

    await waitFor(() => expect(clientsApi.create).toHaveBeenLastCalledWith(expect.objectContaining({ confirmDuplicate: true, duplicateReason: 'Familiares que comparten teléfono.' })));
    expect(await screen.findByRole('heading', { name: /cliente guardado/i })).toBeInTheDocument();
  });

  it('requires a reason and surfaces business conflicts when deleting', async () => {
    clientsApi.remove.mockRejectedValue({ response: { status: 409, data: { error: { code: 'CLIENT_HAS_ACTIVE_BIKES', message: 'El cliente tiene motocicletas activas.' } } } });
    renderWithAuth(<MemoryRouter initialEntries={['/clients/1']}><Routes><Route path="/clients/:id" element={<ClientDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Ana Torres' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /eliminar cliente/i }));
    const confirm = screen.getByRole('button', { name: /^confirmar$/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^motivo/i), { target: { value: 'Solicitud de archivo.' } });
    fireEvent.click(confirm);
    expect(await screen.findByText('El cliente tiene motocicletas activas.')).toBeInTheDocument();
    expect(clientsApi.remove).toHaveBeenCalledWith('1', 'Solicitud de archivo.');
  });

  it('edits allowed fields and restores a deleted client with justification', async () => {
    clientsApi.update.mockResolvedValue({ ...client, name: 'Ana María Torres' });
    const { unmount } = renderWithAuth(<MemoryRouter initialEntries={['/clients/1/edit']}><Routes><Route path="/clients/:id/edit" element={<ClientFormPage />} /><Route path="/clients/:id" element={<h1>Cliente actualizado</h1>} /></Routes></MemoryRouter>);
    expect(await screen.findByDisplayValue('Ana Torres')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: ' Ana María Torres ' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
    await waitFor(() => expect(clientsApi.update).toHaveBeenCalledWith('1', { name: 'Ana María Torres', phone: '3001234567', email: 'ana@example.com' }));
    expect(await screen.findByRole('heading', { name: /cliente actualizado/i })).toBeInTheDocument();
    unmount();

    const deleted = { ...client, lifecycle: 'deleted', deletedAt: '2026-09-01T12:00:00.000Z', deleteReason: 'Archivo previo.' };
    clientsApi.getById.mockResolvedValue(deleted);
    clientsApi.restore.mockResolvedValue(client);
    renderWithAuth(<MemoryRouter initialEntries={['/clients/1']}><Routes><Route path="/clients/:id" element={<ClientDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Archivo previo.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /restaurar cliente/i }));
    fireEvent.change(screen.getByLabelText(/^motivo/i), { target: { value: 'Cliente regresa al taller.' } });
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));
    await waitFor(() => expect(clientsApi.restore).toHaveBeenCalledWith('1', { reason: 'Cliente regresa al taller.' }));
  });

  it('retries a failed client edit load without abandoning the operation', async () => {
    clientsApi.getById
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce(client);
    renderWithAuth(
      <MemoryRouter initialEntries={['/clients/1/edit']}>
        <Routes><Route path="/clients/:id/edit" element={<ClientFormPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/no fue posible cargar el cliente/i))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByRole('heading', { name: /editar cliente/i }))
      .toBeInTheDocument();
    expect(clientsApi.getById).toHaveBeenCalledTimes(2);
  });
});
