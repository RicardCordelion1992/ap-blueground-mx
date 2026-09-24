'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();
  const domainError = params.get('error') === 'dominio_no_permitido';
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.toLowerCase().endsWith('@theblueground.com')) {
      setError('Usa tu correo de trabajo (@theblueground.com).');
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });

    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="text-lg font-semibold text-center mb-1">Cuentas por Pagar</h1>
      <p className="text-sm text-gray-500 text-center mb-6">Blueground México</p>

      {domainError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2 mb-4">
          Solo se permite el acceso con correo @theblueground.com.
        </p>
      )}

      {sent ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
          Te enviamos un enlace de acceso a <strong>{email}</strong>. Ábrelo desde este mismo navegador.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Correo de trabajo</label>
            <input
              type="email"
              required
              className="input"
              placeholder="nombre@theblueground.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full">
            Enviar enlace de acceso
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
