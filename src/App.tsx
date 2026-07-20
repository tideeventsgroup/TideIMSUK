import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { LogOut, Radio as RadioIcon, ClipboardList, FileBarChart2, Settings, ShieldAlert, ListChecks, MessageSquare, Users } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { roleLabel } from './constants/escalation';
import { OfflineQueueBadge } from './components/OfflineQueueBadge';
import { AlarmListener } from './components/AlarmListener';
import { ThemeToggle } from './components/ThemeToggle';
import { Logo } from './components/Logo';
import { RoleGate } from './components/RoleGate';
import { MyZoneSelector } from './components/MyZoneSelector';
import { MyStatusToggle } from './components/MyStatusToggle';
import { PushSubscribeToggle } from './components/PushSubscribeToggle';
import { LiveBoard } from './pages/LiveBoard';
import { StaffHome } from './pages/StaffHome';
import { NewIncident } from './pages/NewIncident';
import { IncidentDetail } from './pages/IncidentDetail';
import { Reports } from './pages/Reports';
import { EventSetup } from './pages/EventSetup';
import { RiskRegister } from './pages/RiskRegister';
import { Checklists } from './pages/Checklists';
import { ChecklistDetail } from './pages/ChecklistDetail';
import { Messages } from './pages/Messages';
import { FMICGround } from './pages/FMICGround';

function NavLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof ClipboardList }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
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
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Icon size={16} />
      <span className="nav-label">{label}</span>
    </Link>
  );
}

export default function App() {
  const { signOut } = useAuthenticator((ctx) => [ctx.user]);
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh' }}>
      <OfflineQueueBadge />
      <AlarmListener />
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          gap: 'var(--space-2) var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: 0, flex: '1 1 auto' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-label="Tide IMS home">
            <Logo />
          </Link>
          <nav className="nav-scroll" style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'nowrap', minWidth: 0 }}>
            {/* Staff PWA is deliberately minimal — two tabs only, no dashboard/map/reports clutter. */}
            <RoleGate allow={['staff']}>
              <NavLink to="/" label="Incidents" icon={RadioIcon} />
              <NavLink to="/messages" label="Messages" icon={MessageSquare} />
            </RoleGate>
            <RoleGate allow={['event-control', 'fmic', 'view-only']}>
              <NavLink to="/" label="Live board" icon={RadioIcon} />
            </RoleGate>
            <RoleGate allow={['event-control', 'fmic']}>
              <NavLink to="/ground" label="Ground ops" icon={Users} />
              <NavLink to="/checklists" label="Checklists" icon={ListChecks} />
            </RoleGate>
            <RoleGate allow={['event-control']}>
              <NavLink to="/risk-register" label="Risk register" icon={ShieldAlert} />
            </RoleGate>
            <RoleGate allow={['event-control', 'fmic']}>
              <NavLink to="/reports" label="Reports" icon={FileBarChart2} />
              <NavLink to="/messages" label="Messages" icon={MessageSquare} />
            </RoleGate>
            <RoleGate allow={['event-control']}>
              <NavLink to="/setup" label="Setup" icon={Settings} />
            </RoleGate>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
          <RoleGate allow={['staff']}>
            <MyZoneSelector />
            <MyStatusToggle />
          </RoleGate>
          <span className="header-user-label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            {user?.name} <span className="mono">· {user && roleLabel(user.role)}</span>
          </span>
          <PushSubscribeToggle />
          <ThemeToggle />
          <button type="button" className="icon-button" onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <Routes>
        <Route path="/" element={user?.role === 'staff' ? <StaffHome /> : <LiveBoard />} />
        <Route path="/incidents/new" element={<NewIncident />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/setup" element={<EventSetup />} />
        <Route path="/risk-register" element={<RiskRegister />} />
        <Route path="/checklists" element={<Checklists />} />
        <Route path="/checklists/:id" element={<ChecklistDetail />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/ground" element={<FMICGround />} />
      </Routes>
    </div>
  );
}
