import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchAuthSession, fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth';
import { client } from '../data/client';
import type { Role } from '../constants/escalation';
import type { ZoneKey } from '../constants/zones';

interface AuthState {
  userId: string;
  name: string;
  email: string;
  role: Role;
  groups: string[];
  assignedZone: ZoneKey | null;
}

const ROLE_PRIORITY: Role[] = ['Admin', 'Controller', 'Loggist', 'Steward', 'Medical'];

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

      let assignedZone: ZoneKey | null = null;
      try {
        const { data: profiles } = await client.models.UserProfile.list({
          filter: { cognitoSub: { eq: current.userId } },
        });
        assignedZone = (profiles[0]?.assignedZone as ZoneKey | undefined) ?? null;
      } catch {
        // Non-fatal — zone-scoping just falls back to unfiltered.
      }

      setUser({
        userId: current.userId,
        name: attrs.name ?? current.username,
        email: attrs.email ?? '',
        role: primaryRole(groups),
        groups,
        assignedZone,
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
