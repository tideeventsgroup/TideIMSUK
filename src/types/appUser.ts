export interface AppUser {
  sub: string;
  email: string;
  name?: string | null;
  role?: string | null;
  enabled: boolean;
  status: string;
}
