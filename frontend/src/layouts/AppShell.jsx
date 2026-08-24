import { NavLink, Outlet } from 'react-router-dom';

const navigation = [
  { to: '/orders', label: 'Órdenes', end: true },
  { to: '/orders/new', label: 'Nueva orden', end: false },
];

export const AppShell = () => (
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
        {navigation.map((item) => (
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
      </nav>

      <p className="sidebar__phase">Operación · Fase 1</p>
    </aside>

    <div className="app-content">
      <header className="topbar">
        <div>
          <p className="topbar__eyebrow">Centro de servicio</p>
          <p className="topbar__title">Control de órdenes</p>
        </div>
        <span className="topbar__environment">Operación local</span>
      </header>
      <main id="main-content" className="main-content" tabIndex="-1">
        <Outlet />
      </main>
    </div>
  </div>
);
