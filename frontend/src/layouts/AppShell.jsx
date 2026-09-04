import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';

const resourceNavigation = [
  { to: '/clients', label: 'Clientes', end: false },
  { to: '/bikes', label: 'Motocicletas', end: false },
];

export const AppShell = () => {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
    <aside className="sidebar">
      <NavLink className="brand" to="/orders" aria-label="PAVAS Taller, inicio">
        <span className="brand__mark" aria-hidden="true">P</span>
        <span>
          <strong>PAVAS</strong>
          <small>Taller de motos</small>
        </span>
      </NavLink>

      <nav className="primary-nav" aria-label="Navegación principal">
        <NavLink to="/orders" end className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}><span className="nav-link__dot" aria-hidden="true" />{user.role === 'ADMIN' ? 'Órdenes' : 'Mis órdenes'}</NavLink>
        {resourceNavigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            <span className="nav-link__dot" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
        {user.role === 'ADMIN' ? (
          <>
            <NavLink to="/orders/new" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}><span className="nav-link__dot" aria-hidden="true" />Nueva orden</NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}><span className="nav-link__dot" aria-hidden="true" />Usuarios</NavLink>
          </>
        ) : null}
      </nav>

      <div className="sidebar-session">
        <p className="sidebar__phase">Sesión actual</p>
        <span><strong>{user.name}</strong><small>{user.role === 'ADMIN' ? 'Administrador' : 'Mecánico'}</small></span>
        <button className="button sidebar-session__logout" type="button" onClick={logout}>Cerrar sesión</button>
      </div>
    </aside>

    <div className="app-content">
      <header className="topbar">
        <div>
          <p className="topbar__eyebrow">Centro de servicio</p>
          <p className="topbar__title">Gestión del taller</p>
        </div>
        <span className="topbar__environment">PAVAS Moto Workshop</span>
      </header>
      <main id="main-content" className="main-content" tabIndex="-1">
        <Outlet />
      </main>
    </div>
    </div>
  );
};
