'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewBuildingForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await fetch('/api/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    setName('');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Nuevo edificio
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input autoFocus className="input" placeholder="Nombre del edificio" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn-primary" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
        Cancelar
      </button>
    </form>
  );
}
