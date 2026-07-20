import { Routes, Route, Link } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useAuth } from './context/AuthContext';
import { OfflineQueueBadge } from './components/OfflineQueueBadge';
import { LiveBoard } from './pages/LiveBoard';
import { NewIncident } from './pages/NewIncident';
import { IncidentDetail } from './pages/IncidentDetail';
import { Reports } from './pages/Reports';
import { THEME } from './constants/theme';

export default function App() {
  const { signOut } = useAuthenticator((ctx) => [ctx.user]);
  const { user } = useAuth();

  return (
    <div style={{ fontFamily: THEME.fontFamily, color: THEME.colorPrimary, minHeight: '100vh' }}>
      <OfflineQueueBadge />
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          borderBottom: `2px solid ${THEME.colorPrimary}`,
        }}
      >
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <strong>Tide IMS</strong>
          <Link to="/">Live board</Link>
          <Link to="/reports">Reports</Link>
        </nav>
        <div style={{ fontSize: '0.85rem' }}>
          {user?.name} ({user?.role}){' '}
          <button onClick={signOut} style={{ marginLeft: '0.5rem' }}>
            Sign out
          </button>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<LiveBoard />} />
        <Route path="/incidents/new" element={<NewIncident />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </div>
  );
}
