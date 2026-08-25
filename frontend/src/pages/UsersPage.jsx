import { useCallback, useEffect, useState } from 'react';

import { usersApi } from '../api/usersApi.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { refreshAccessSession } from '../features/auth/authSession.js';
import { useAuth } from '../hooks/useAuth.js';
import { getApiError, getApiErrorMessage } from '../utils/apiError.js';
import { formatDateTime } from '../utils/formatters.js';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'MECANICO' };

export const UsersPage = () => {
  const { user: currentUser, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await usersApi.list());
    } catch (error) {
      setLoadError(getApiError(error, 'No fue posible consultar los usuarios.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The effect synchronizes the administration view with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
  }, [loadUsers]);

  const createUser = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      setFormError('Completa nombre y correo; la contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    setNotice('');
    try {
      const created = await usersApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      setUsers((current) => [...current, created]);
      setForm(EMPTY_FORM);
      setNotice(`Usuario ${created.name} creado correctamente.`);
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'No fue posible crear el usuario.'));
    } finally {
      setSubmitting(false);
    }
  };

  const updateRole = async (managedUser, role) => {
    if (role === managedUser.role || updatingId) return;
    if (managedUser.id === currentUser.id && role !== 'ADMIN'
      && !window.confirm('Al cambiar tu propio rol perderás acceso a esta pantalla. ¿Continuar?')) return;

    setUpdatingId(managedUser.id);
    setNotice('');
    setFormError('');
    try {
      const updated = await usersApi.changeRole(managedUser.id, role);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`Rol de ${updated.name} actualizado.`);
      if (updated.id === currentUser.id) await refreshAccessSession();
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'No fue posible actualizar el rol.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleActive = async (managedUser) => {
    const nextActive = !managedUser.active;
    if (!nextActive && !window.confirm(`¿Desactivar a ${managedUser.name}? No podrá iniciar ni renovar sesión.`)) return;

    setUpdatingId(managedUser.id);
    setNotice('');
    setFormError('');
    try {
      const updated = await usersApi.changeActive(managedUser.id, nextActive);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (updated.id === currentUser.id && !updated.active) {
        await logout();
        return;
      }
      setNotice(`${updated.name} fue ${updated.active ? 'activado' : 'desactivado'}.`);
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'No fue posible actualizar el usuario.'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section aria-labelledby="users-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h1 id="users-title">Usuarios</h1>
          <p>Crea cuentas y controla el rol y el acceso al taller.</p>
        </div>
      </div>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {formError ? <p className="inline-alert inline-alert--error" role="alert">{formError}</p> : null}

      <div className="users-layout">
        <section className="panel user-form-panel" aria-labelledby="create-user-title">
          <div className="section-heading section-heading--compact">
            <div><h2 id="create-user-title">Crear usuario</h2><p>La contraseña inicial debe tener mínimo 8 caracteres.</p></div>
          </div>
          <form className="user-form" onSubmit={createUser} noValidate>
            <div className="field"><label htmlFor="user-name">Nombre</label><input id="user-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} disabled={submitting} /></div>
            <div className="field"><label htmlFor="user-email">Correo</label><input id="user-email" type="email" autoComplete="off" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} disabled={submitting} /></div>
            <div className="field"><label htmlFor="user-password">Contraseña inicial</label><input id="user-password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} disabled={submitting} /></div>
            <div className="field"><label htmlFor="user-role">Rol</label><select id="user-role" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} disabled={submitting}><option value="MECANICO">Mecánico</option><option value="ADMIN">Administrador</option></select></div>
            <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Creando…' : 'Crear usuario'}</button>
          </form>
        </section>

        <section className="panel users-panel" aria-labelledby="user-list-title">
          <div className="section-heading section-heading--compact users-panel__heading">
            <div><h2 id="user-list-title">Equipo</h2><p>{users.length} {users.length === 1 ? 'usuario' : 'usuarios'}</p></div>
          </div>
          {loading ? <LoadingState message="Cargando usuarios…" /> : null}
          {!loading && loadError ? <ErrorState message={loadError.message} onRetry={loadUsers} /> : null}
          {!loading && !loadError && users.length === 0 ? <EmptyState title="Sin usuarios" message="Crea la primera cuenta del equipo." /> : null}
          {!loading && !loadError && users.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table">
                <caption className="visually-hidden">Usuarios del taller</caption>
                <thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Estado</th><th scope="col">Creado</th><th scope="col"><span className="visually-hidden">Acciones</span></th></tr></thead>
                <tbody>
                  {users.map((managedUser) => (
                    <tr key={managedUser.id}>
                      <td data-label="Usuario"><span className="cell-primary">{managedUser.name}{managedUser.id === currentUser.id ? ' (tú)' : ''}</span><span className="cell-secondary">{managedUser.email}</span></td>
                      <td data-label="Rol"><select aria-label={`Rol de ${managedUser.name}`} value={managedUser.role} onChange={(event) => updateRole(managedUser, event.target.value)} disabled={updatingId !== null}><option value="ADMIN">Administrador</option><option value="MECANICO">Mecánico</option></select></td>
                      <td data-label="Estado"><span className={`user-state ${managedUser.active ? 'user-state--active' : 'user-state--inactive'}`}>{managedUser.active ? 'Activo' : 'Inactivo'}</span></td>
                      <td data-label="Creado">{formatDateTime(managedUser.createdAt)}</td>
                      <td className="table-action"><button className={`button ${managedUser.active ? 'button--danger-ghost' : 'button--secondary'}`} type="button" onClick={() => toggleActive(managedUser)} disabled={updatingId !== null} aria-label={`${managedUser.active ? 'Desactivar' : 'Activar'} a ${managedUser.name}`}>{updatingId === managedUser.id ? 'Actualizando…' : managedUser.active ? 'Desactivar' : 'Activar'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
};
