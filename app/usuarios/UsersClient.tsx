'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'ADMIN' | 'FINANCE' | 'VIEWER';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  FINANCE: 'Finanzas',
  VIEWER: 'Solo lectura',
};

export default function UsersClient({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', name: '', role: 'FINANCE' as Role });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setCreating(false);
    if (!res.ok) {
      const body = await res.json();
      setCreateError(typeof body.error === 'string' ? body.error : 'No se pudo crear el usuario.');
      return;
    }
    setForm({ email: '', name: '', role: 'FINANCE' });
    router.refresh();
  }

  async function updateUser(id: string, data: Partial<{ role: Role; active: boolean }>) {
    setRowBusy(id);
    setRowError(null);
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setRowBusy(null);
    if (!res.ok) {
      const body = await res.json();
      setRowError({ id, message: typeof body.error === 'string' ? body.error : 'No se pudo actualizar.' });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createUser} className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Correo (@theblueground.com)</label>
          <input
            type="email"
            required
            className="input"
            placeholder="nombre@theblueground.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Nombre</label>
          <input
            required
            className="input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="min-w-[160px]">
          <label className="label">Rol</label>
          <select
            className="input"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
          >
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={creating} className="btn-primary">
          {creating ? 'Creando…' : '+ Dar de alta'}
        </button>
        {createError && <p className="text-sm text-red-600 w-full">{createError}</p>}
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Correo</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Acceso</th>
              <th className="px-4 py-2 font-medium">Desde</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.id === currentUserId;
              const busy = rowBusy === u.id;
              return (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 align-top">
                  <td className="px-4 py-2">
                    {u.name} {isMe && <span className="text-xs text-gray-400">(tú)</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{u.email}</td>
                  <td className="px-4 py-2">
                    <select
                      className="input py-1"
                      value={u.role}
                      disabled={isMe || busy}
                      onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}
                    >
                      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    {isMe ? (
                      <span className="badge-ready">Activo</span>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => updateUser(u.id, { active: !u.active })}
                        className={u.active ? 'badge-ready' : 'badge-incomplete'}
                      >
                        {u.active ? 'Activo' : 'Desactivado'}
                      </button>
                    )}
                    {rowError?.id === u.id && <p className="text-xs text-red-600 mt-1">{rowError.message}</p>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString('es-MX')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        Solo las personas dadas de alta aquí pueden entrar (con su correo @theblueground.com). Al desactivar a
        alguien, se le cierra el acceso de inmediato pero su historial (facturas, documentos) se conserva.
      </p>
    </div>
  );
}
