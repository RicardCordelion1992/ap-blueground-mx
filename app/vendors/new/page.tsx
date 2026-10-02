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

// Catálogo oficial del SAT de régimen fiscal (c_RegimenFiscal, CFDI 4.0).
// appliesTo filtra las opciones según el tipo de persona del formulario;
// null = aplica tanto a persona física como a persona moral.
const REGIMEN_FISCAL_OPTIONS: { code: string; label: string; appliesTo: 'FISICA' | 'MORAL' | null }[] = [
  { code: '601', label: 'General de Ley Personas Morales', appliesTo: 'MORAL' },
  { code: '603', label: 'Personas Morales con Fines no Lucrativos', appliesTo: 'MORAL' },
  { code: '605', label: 'Sueldos y Salarios e Ingresos Asimilados a Salarios', appliesTo: 'FISICA' },
  { code: '606', label: 'Arrendamiento', appliesTo: 'FISICA' },
  { code: '607', label: 'Régimen de Enajenación o Adquisición de Bienes', appliesTo: 'FISICA' },
  { code: '608', label: 'Demás ingresos', appliesTo: 'FISICA' },
  { code: '610', label: 'Residentes en el Extranjero sin Establecimiento Permanente en México', appliesTo: null },
  { code: '611', label: 'Ingresos por Dividendos (socios y accionistas)', appliesTo: 'FISICA' },
  { code: '612', label: 'Personas Físicas con Actividades Empresariales y Profesionales', appliesTo: 'FISICA' },
  { code: '614', label: 'Ingresos por intereses', appliesTo: 'FISICA' },
  { code: '615', label: 'Régimen de los ingresos por obtención de premios', appliesTo: 'FISICA' },
  { code: '616', label: 'Sin obligaciones fiscales', appliesTo: 'FISICA' },
  { code: '620', label: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos', appliesTo: 'MORAL' },
  { code: '621', label: 'Incorporación Fiscal', appliesTo: 'FISICA' },
  { code: '622', label: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras', appliesTo: 'MORAL' },
  { code: '623', label: 'Opcional para Grupos de Sociedades', appliesTo: 'MORAL' },
  { code: '624', label: 'Coordinados', appliesTo: 'MORAL' },
  { code: '625', label: 'Actividades Empresariales con ingresos a través de Plataformas Tecnológicas', appliesTo: 'FISICA' },
  { code: '626', label: 'Régimen Simplificado de Confianza (RESICO)', appliesTo: null },
  { code: '628', label: 'Hidrocarburos', appliesTo: 'MORAL' },
  { code: '629', label: 'De los Regímenes Fiscales Preferentes y de las Empresas Multinacionales', appliesTo: null },
  { code: '630', label: 'Enajenación de acciones en bolsa de valores', appliesTo: null },
];

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
            <select className="input" value={form.taxRegime} onChange={(e) => set('taxRegime', e.target.value)}>
              <option value="">Selecciona…</option>
              {REGIMEN_FISCAL_OPTIONS.filter((r) => r.appliesTo === null || r.appliesTo === form.personType).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} – {r.label}
                </option>
              ))}
            </select>
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
