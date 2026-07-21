import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './styles/amplify-theme.css';
import './amplify-config';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { EventProvider } from './context/EventContext';
import { AuthHeader } from './components/AuthHeader';
import { AuthFooter } from './components/AuthFooter';
import { PublicStatus } from './pages/PublicStatus';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Unauthenticated, no Authenticator gate — see PublicStatus.tsx. */}
          <Route path="/status" element={<PublicStatus />} />
          <Route
            path="/*"
            element={
              <Authenticator hideSignUp components={{ Header: AuthHeader, Footer: AuthFooter }}>
                <AuthProvider>
                  <EventProvider>
                    <App />
                  </EventProvider>
                </AuthProvider>
              </Authenticator>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
