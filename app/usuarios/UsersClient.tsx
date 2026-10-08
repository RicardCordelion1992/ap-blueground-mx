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

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function UsersClient({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', name: '', role: 'FINANCE' as Role, password: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [rowNotice, setRowNotice] = useState<{ id: string; message: string } | null>(null);
  const [resetRowId, setResetRowId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreated(null);
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
    setCreated({ email: form.email, password: form.password });
    setForm({ email: '', name: '', role: 'FINANCE', password: '' });
    router.refresh();
  }

  async function updateUser(id: string, data: Partial<{ role: Role; active: boolean; password: string }>) {
    setRowBusy(id);
    setRowError(null);
    setRowNotice(null);
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
    if (typeof data.password === 'string') {
      setRowNotice({ id, message: 'Contraseña actualizada.' });
      setResetRowId(null);
      setResetPassword('');
    }
    router.refresh();
  }

  // Hard delete — only succeeds server-side if the user has no associated
  // history (facturas, documentos, actividad). Otherwise the API returns a
  // clear error telling the admin to use "Desactivar" instead.
  async function deleteUser(id: string, email: string) {
    if (!window.confirm(`¿Eliminar a ${email}? Esta acción no se puede deshacer.`)) return;
    setRowBusy(id);
    setRowError(null);
    setRowNotice(null);
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    setRowBusy(null);
    if (!res.ok) {
      const body = await res.json();
      setRowError({ id, message: typeof body.error === 'string' ? body.error : 'No se pudo eliminar.' });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createUser} className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Correo</label>
          <input
            type="email"
            required
            className="input"
            placeholder="nombre@correo.com"
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
        <div className="flex-1 min-w-[220px]">
          <label className="label">Contraseña inicial</label>
          <div className="flex gap-2">
            <input
              required
              minLength={8}
              className="input"
              placeholder="Mínimo 8 caracteres"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <button
              type="button"
              className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
              onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
            >
              Generar
            </button>
          </div>
        </div>
        <button type="submit" disabled={creating} className="btn-primary">
          {creating ? 'Creando…' : '+ Dar de alta'}
        </button>
        {createError && <p className="text-sm text-red-600 w-full">{createError}</p>}
        {created && !createError && (
          <p className="text-sm text-green-700 w-full">
            Usuario {created.email} creado con la contraseña <strong>{created.password}</strong>. Cópiala y
            compártela con esa persona — no queda guardada en ningún otro lugar.
          </p>
        )}
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
              <th className="px-4 py-2 font-medium">Contraseña</th>
              <th className="px-4 py-2 font-medium">Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.id === currentUserId;
              const busy = rowBusy === u.id;
              const resetting = resetRowId === u.id;
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
                  <td className="px-4 py-2">
                    {isMe ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : resetting ? (
                      <div className="flex gap-1 items-center">
                        <input
                          autoFocus
                          className="input py-1 text-xs"
                          placeholder="Nueva contraseña"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                        />
                        <button
                          disabled={busy || resetPassword.trim().length < 8}
                          onClick={() => updateUser(u.id, { password: resetPassword.trim() })}
                          className="text-xs text-brand-600 hover:underline whitespace-nowrap"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => {
                            setResetRowId(null);
                            setResetPassword('');
                          }}
                          className="text-xs text-gray-400 hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => {
                          setResetRowId(u.id);
                          setResetPassword('');
                        }}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Restablecer
                      </button>
                    )}
                    {rowNotice?.id === u.id && <p className="text-xs text-green-700 mt-1">{rowNotice.message}</p>}
                  </td>
                  <td className="px-4 py-2">
                    {isMe ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => deleteUser(u.id, u.email)}
                        className="text-xs text-red-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {busy ? '…' : 'Eliminar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        Solo las personas dadas de alta aquí pueden entrar, con cualquier correo — lo que controla el acceso
        es que tú las hayas dado de alta, no el dominio del correo. Tú defines su contraseña inicial al
        crearlas y puedes restablecerla cuando quieras; cada persona también puede cambiarla desde su cuenta
        o recuperarla ella misma si la olvida. Desactivar a alguien bloquea su entrada de inmediato
        conservando su historial (facturas, documentos). Eliminar borra al usuario por completo y solo es
        posible si no tiene historial asociado (facturas, documentos o actividad registrada) — si lo tiene,
        usa Desactivar en su lugar.
      </p>
    </div>
  );
}
