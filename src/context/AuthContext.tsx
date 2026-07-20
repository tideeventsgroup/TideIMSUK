import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchAuthSession, fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth';
import type { Role } from '../constants/escalation';

interface AuthState {
  userId: string;
  name: string;
  email: string;
  role: Role;
  groups: string[];
}

const ROLE_PRIORITY: Role[] = ['Admin', 'Controller', 'Loggist', 'Steward'];

const AuthCtx = createContext<{ user: AuthState | null; loading: boolean; refresh: () => Promise<void> }>({
  user: null,
  loading: true,
  refresh: async () => {},
});

function primaryRole(groups: string[]): Role {
  return ROLE_PRIORITY.find((r) => groups.includes(r)) ?? 'Steward';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [current, attrs, session] = await Promise.all([
        getCurrentUser(),
        fetchUserAttributes(),
        fetchAuthSession(),
      ]);
      const groups = (session.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined) ?? [];
      setUser({
        userId: current.userId,
        name: attrs.name ?? current.username,
        email: attrs.email ?? '',
        role: primaryRole(groups),
        groups,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return <AuthCtx.Provider value={{ user, loading, refresh }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
