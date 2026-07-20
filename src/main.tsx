import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './styles/amplify-theme.css';
import './amplify-config';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { EventProvider } from './context/EventContext';
import { AuthHeader } from './components/AuthHeader';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Authenticator hideSignUp components={{ Header: AuthHeader }}>
        <AuthProvider>
          <EventProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </EventProvider>
        </AuthProvider>
      </Authenticator>
    </ThemeProvider>
  </StrictMode>,
);
