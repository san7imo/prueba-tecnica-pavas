import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';

const navClassName = ({ isActive }) =>
  `nav-link${isActive ? ' nav-link--active' : ''}`;

export const AppShell = () => {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
    <aside className="sidebar">
      <NavLink className="brand" to="/dashboard" aria-label="PAVAS Taller, inicio">
        <span className="brand__mark" aria-hidden="true">P</span>
        <span>
          <strong>PAVAS</strong>
          <small>Taller de motos</small>
        </span>
      </NavLink>

      <nav className="primary-nav" aria-label="Navegación principal">
        <NavLink to="/dashboard" className={navClassName}><span className="nav-link__dot" aria-hidden="true" />Dashboard</NavLink>
        <NavLink to="/orders" className={navClassName}><span className="nav-link__dot" aria-hidden="true" />{user.role === 'ADMIN' ? 'Órdenes' : 'Mis órdenes'}</NavLink>
        <NavLink to="/clients" className={navClassName}><span className="nav-link__dot" aria-hidden="true" />Clientes</NavLink>
        <NavLink to="/bikes" className={navClassName}><span className="nav-link__dot" aria-hidden="true" />Motocicletas</NavLink>
        {user.role === 'ADMIN' ? (
          <>
            <NavLink to="/admin/users" className={navClassName}><span className="nav-link__dot" aria-hidden="true" />Usuarios</NavLink>
            <NavLink to="/admin/audit" className={navClassName}><span className="nav-link__dot" aria-hidden="true" />Auditoría</NavLink>
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
