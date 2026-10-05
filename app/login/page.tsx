'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError('Correo o contraseña incorrectos.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <div className="flex justify-center mb-6">
        <div className="bg-brand-700 rounded-2xl px-4 py-3">
          <img src="/brand/blueground-logo-white.png" alt="Blueground" className="h-5 w-auto" />
        </div>
      </div>
      <h1 className="text-lg font-semibold text-center mb-1">Cuentas por Pagar</h1>
      <p className="text-sm text-gray-500 text-center mb-6">Blueground México</p>

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
        <div>
          <label className="label">Contraseña</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="text-xs text-center mt-3">
        <a href="/forgot-password" className="underline text-gray-500">¿Olvidaste tu contraseña?</a>
      </p>
      <p className="text-xs text-gray-400 text-center mt-5">
        El acceso es solo por invitación. Si no tienes cuenta, pide a un administrador que te dé de alta.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
