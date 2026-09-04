import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import { getApiError } from '../utils/apiError.js';

export const LoginPage = () => {
  const { isAuthenticated, login, sessionMessage } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    if (!form.email.trim() || !form.password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await login({ email: form.email.trim(), password: form.password });
      const from = location.state?.from;
      const destination = from?.pathname && from.pathname !== '/login'
        ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
        : '/dashboard';
      navigate(destination, { replace: true });
    } catch (requestError) {
      const apiError = getApiError(requestError, 'No fue posible iniciar sesión. Intenta nuevamente.');
      setError(apiError.status === 401 ? 'Correo o contraseña inválidos.' : apiError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand" aria-hidden="true">P</div>
        <p className="eyebrow">PAVAS · Taller de motos</p>
        <h1 id="login-title">Iniciar sesión</h1>
        <p>Accede al control operativo de órdenes de trabajo.</p>

        {sessionMessage ? <p className="inline-alert" role="status">{sessionMessage}</p> : null}
        {error ? <p className="inline-alert inline-alert--error" role="alert">{error}</p> : null}

        <form className="login-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="login-email">Correo<span className="required-mark" aria-hidden="true"> *</span></label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              disabled={loading}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Contraseña<span className="required-mark" aria-hidden="true"> *</span></label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              disabled={loading}
            />
          </div>
          <button className="button button--primary button--prominent" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
};
