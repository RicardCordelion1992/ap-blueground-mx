'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Reached only after clicking the recovery-email link (middleware requires
// a session for this route, and the /auth/callback exchange just created
// one). Sets a brand-new password for whoever is in that session.
export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError('No se pudo actualizar la contraseña. Pide un nuevo enlace e intenta de nuevo.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="flex justify-center mb-6">
          <div className="bg-brand-700 rounded-2xl px-4 py-3">
            <img src="/brand/blueground-logo-white.png" alt="Blueground" className="h-5 w-auto" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-center mb-1">Nueva contraseña</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Blueground México</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nueva contraseña</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Confirmar contraseña</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
