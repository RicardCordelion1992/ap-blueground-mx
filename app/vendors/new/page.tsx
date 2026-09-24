'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const initial = {
  personType: 'MORAL' as 'MORAL' | 'FISICA',
  name: '',
  rfc: '',
  curp: '',
  legalRepName: '',
  legalRepRfc: '',
  fiscalAddress: '',
  taxRegime: '',
  email: '',
  phone: '',
  bankName: '',
  clabe: '',
  accountNumber: '',
  currency: 'MXN',
  paymentTerms: '',
  notes: '',
};

export default function NewVendorPage() {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof initial>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch('/api/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === 'string' ? body.error : 'No se pudo guardar. Revisa los campos.');
      return;
    }
    const vendor = await res.json();
    router.push(`/vendors/${vendor.id}`);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Nuevo proveedor / landlord</h1>

      <form onSubmit={submit} className="card p-6 space-y-4">
        <div>
          <label className="label">Tipo de persona</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.personType === 'MORAL'} onChange={() => set('personType', 'MORAL')} /> Persona moral
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.personType === 'FISICA'} onChange={() => set('personType', 'FISICA')} /> Persona física
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nombre / Razón social *</label>
            <input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label">RFC *</label>
            <input required className="input" value={form.rfc} onChange={(e) => set('rfc', e.target.value.toUpperCase())} />
          </div>
        </div>

        {form.personType === 'FISICA' && (
          <div>
            <label className="label">CURP</label>
            <input className="input" value={form.curp} onChange={(e) => set('curp', e.target.value.toUpperCase())} />
          </div>
        )}

        {form.personType === 'MORAL' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Representante legal</label>
              <input className="input" value={form.legalRepName} onChange={(e) => set('legalRepName', e.target.value)} />
            </div>
            <div>
              <label className="label">RFC del representante</label>
              <input className="input" value={form.legalRepRfc} onChange={(e) => set('legalRepRfc', e.target.value.toUpperCase())} />
            </div>
          </div>
        )}

        <div>
          <label className="label">Domicilio fiscal</label>
          <input className="input" value={form.fiscalAddress} onChange={(e) => set('fiscalAddress', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Régimen fiscal</label>
            <input className="input" value={form.taxRegime} onChange={(e) => set('taxRegime', e.target.value)} />
          </div>
          <div>
            <label className="label">Correo de contacto</label>
            <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Banco</label>
            <input className="input" value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
          </div>
          <div>
            <label className="label">CLABE</label>
            <input className="input" maxLength={18} value={form.clabe} onChange={(e) => set('clabe', e.target.value)} />
          </div>
          <div>
            <label className="label">Moneda</label>
            <select className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Notas</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando…' : 'Crear proveedor'}
          </button>
        </div>
      </form>
      <p className="text-xs text-gray-500">
        Después de crearlo podrás subir su expediente documental (AML/KYC) — el proveedor pasa a estatus "Ready" solo cuando todos los campos y documentos requeridos estén completos.
      </p>
    </div>
  );
}
