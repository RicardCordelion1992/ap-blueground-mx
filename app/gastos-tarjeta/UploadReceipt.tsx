'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { id: string; name: string };

export default function UploadReceipt({ buildings, categories }: { buildings: Option[]; categories: Option[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState<'BREX' | 'JEEVES'>('BREX');
  const [buildingId, setBuildingId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ amount: number | null; expenseDate: string | null; description: string | null } | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Elige el archivo de tu comprobante.');
      return;
    }
    if (!buildingId) {
      setError('Elige a qué edificio corresponde el gasto.');
      return;
    }

    setUploading(true);
    setError(null);
    setConfirm(null);

    const form = new FormData();
    form.append('file', file);
    form.append('provider', provider);
    form.append('buildingId', buildingId);
    if (categoryId) form.append('categoryId', categoryId);

    const res = await fetch('/api/card-receipts', { method: 'POST', body: form });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error || 'Ocurrió un error al subir el comprobante.');
      return;
    }

    setConfirm({
      amount: data.amount !== null ? Number(data.amount) : null,
      expenseDate: data.expenseDate ? new Date(data.expenseDate).toLocaleDateString('es-MX') : null,
      description: data.description,
    });
    if (inputRef.current) inputRef.current.value = '';
    setBuildingId('');
    setCategoryId('');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <p className="label">Subir un comprobante de gasto</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <label className="label">Tarjeta</label>
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value as 'BREX' | 'JEEVES')}>
            <option value="BREX">Brex</option>
            <option value="JEEVES">Jeeves</option>
          </select>
        </div>
        <div className="min-w-[200px]">
          <label className="label">Edificio</label>
          <select className="input" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            <option value="">Elige un edificio…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="label">Categoría (opcional)</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="label">Comprobante (PDF o imagen)</label>
          <input ref={inputRef} type="file" accept="application/pdf,image/*" className="block text-sm" />
        </div>
        <button type="submit" disabled={uploading} className="btn-primary disabled:opacity-40">
          {uploading ? 'Subiendo…' : 'Subir'}
        </button>
      </div>
      {uploading && <p className="text-sm text-gray-500">Procesando el comprobante…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {confirm && (
        <p className="text-sm text-green-700">
          Comprobante guardado. Se detectó: {confirm.amount !== null ? `$${confirm.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'monto no detectado'}
          {confirm.expenseDate ? `, ${confirm.expenseDate}` : ''}
          {confirm.description ? ` — ${confirm.description}` : ''}. Si algo está mal, corrígelo abajo en la tabla.
        </p>
      )}
    </form>
  );
}
