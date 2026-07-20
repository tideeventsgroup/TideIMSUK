import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { LogOut, Radio as RadioIcon, ClipboardList, FileBarChart2, Settings } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { OfflineQueueBadge } from './components/OfflineQueueBadge';
import { ThemeToggle } from './components/ThemeToggle';
import { Logo } from './components/Logo';
import { RoleGate } from './components/RoleGate';
import { LiveBoard } from './pages/LiveBoard';
import { NewIncident } from './pages/NewIncident';
import { IncidentDetail } from './pages/IncidentDetail';
import { Reports } from './pages/Reports';
import { EventSetup } from './pages/EventSetup';

function NavLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof ClipboardList }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-sm)',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        background: 'transparent',
        borderBottom: active ? '2px solid var(--color-brand)' : '2px solid transparent',
        textDecoration: 'none',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
      }}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

export default function App() {
  const { signOut } = useAuthenticator((ctx) => [ctx.user]);
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh' }}>
      <OfflineQueueBadge />
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} aria-label="Tide IMS home">
            <Logo />
          </Link>
          <nav style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <NavLink to="/" label="Live board" icon={RadioIcon} />
            <NavLink to="/reports" label="Reports" icon={FileBarChart2} />
            <RoleGate allow={['Admin']}>
              <NavLink to="/setup" label="Setup" icon={Settings} />
            </RoleGate>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            {user?.name} <span className="mono">· {user?.role}</span>
          </span>
          <ThemeToggle />
          <button type="button" className="icon-button" onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<LiveBoard />} />
        <Route path="/incidents/new" element={<NewIncident />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/setup" element={<EventSetup />} />
      </Routes>
    </div>
  );
}
