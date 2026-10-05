'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const redirectTo = window.location.origin + '/auth/callback?next=/reset-password';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) {
      setError('No se pudo enviar el correo. Intenta de nuevo.');
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="flex justify-center mb-6">
          <div className="bg-brand-700 rounded-2xl px-4 py-3">
            <img src="/brand/blueground-logo-white.png" alt="Blueground" className="h-5 w-auto" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-center mb-1">Recuperar acceso</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Blueground México</p>

        {sent ? (
          <p className="text-sm text-gray-600 text-center">
            Si el correo pertenece a un usuario dado de alta, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo</label>
              <input
                type="email"
                required
                autoComplete="username"
                className="input"
                placeholder="nombre@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center mt-5">
          <a href="/login" className="underline">Volver a iniciar sesión</a>
        </p>
      </div>
    </div>
  );
}
