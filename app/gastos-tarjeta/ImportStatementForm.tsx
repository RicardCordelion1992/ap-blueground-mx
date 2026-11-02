'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportStatementForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/card-charges/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo procesar el archivo');
      } else {
        setMessage(
          `Se importaron ${data.total} cargos (formato ${data.format}). ` +
            `${data.matched} se asignaron automáticamente a una persona, ${data.unmatched} quedaron sin asignar.`
        );
        setFile(null);
        router.refresh();
      }
    } catch (err) {
      setError('Error al subir el archivo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-md p-4 bg-gray-50">
      <h2 className="text-sm font-semibold mb-2">Importar estado de cuenta (Brex / Jeeves)</h2>
      <p className="text-xs text-gray-500 mb-3">
        Sube el CSV o Excel completo del banco con los cargos de todos los tarjetahabientes. El
        sistema reparte automáticamente cada línea a la persona correspondiente.
      </p>
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="px-3 py-1.5 bg-black text-white text-sm rounded disabled:opacity-50"
        >
          {loading ? 'Procesando...' : 'Importar'}
        </button>
      </form>
      {message && <p className="text-sm text-green-700 mt-2">{message}</p>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
