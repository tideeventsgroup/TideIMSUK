import { useEffect, useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import { roleLabel, type Role } from '../constants/escalation';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { AppUser } from '../types/appUser';

const ROLES: Role[] = ['event-control', 'fmic', 'staff', 'view-only'];

const emptyForm = { email: '', name: '', role: 'staff' as Role };

export function ManageUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AppUser | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.queries.listAppUsers();
      setUsers(((data ?? []).filter(Boolean) as AppUser[]).sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (user && user.role !== 'event-control') {
    return (
      <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
        Only Event Control can manage users.
      </p>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { errors } = await client.mutations.createAppUser(form);
      if (errors?.length) throw new Error(errors[0].message);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (sub: string, role: string) => {
    setBusy(true);
    setError(null);
    try {
      const { errors } = await client.mutations.updateAppUserRole({ sub, role });
      if (errors?.length) throw new Error(errors[0].message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setError(null);
    try {
      const { errors } = await client.mutations.deleteAppUser({ sub: pendingDelete.sub });
      if (errors?.length) throw new Error(errors[0].message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ fontSize: 'var(--text-lg)' }}>Manage users</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
        Add or remove control room accounts and set their role. New users are emailed a temporary password by
        Cognito and set their own on first sign-in.
      </p>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Users</h2>
      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {users.map((u) => (
          <div
            key={u.sub}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--space-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              background: 'var(--color-surface-raised)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <strong>{u.name || u.email}</strong>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                {u.email} {!u.enabled && <span style={{ color: 'var(--color-danger)' }}>· disabled</span>}
                {u.status === 'FORCE_CHANGE_PASSWORD' && <span> · invite pending</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <select
                value={u.role ?? ''}
                disabled={busy || u.sub === user?.userId}
                onChange={(e) => handleRoleChange(u.sub, e.target.value)}
                aria-label={`Role for ${u.name || u.email}`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-button"
                disabled={busy || u.sub === user?.userId}
                onClick={() => setPendingDelete(u)}
                aria-label={`Remove ${u.name || u.email}`}
                title={u.sub === user?.userId ? "You can't remove your own account" : 'Remove user'}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!loading && users.length === 0 && <p style={{ color: 'var(--color-text-tertiary)' }}>No users yet.</p>}
      </div>

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Add user</h2>
      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div className="field-row">
          <label>
            Name
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
          </label>
          <label>
            Email
            <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
          </label>
        </div>
        <label>
          Role
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button type="submit" disabled={busy}>
            <UserPlus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            {busy ? 'Adding…' : 'Add user'}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Remove ${pendingDelete?.name || pendingDelete?.email}?`}
        description="They'll lose access immediately. This doesn't delete anything they've already logged — incidents and messages stay attributed to their name."
        confirmLabel="Remove user"
        danger
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
