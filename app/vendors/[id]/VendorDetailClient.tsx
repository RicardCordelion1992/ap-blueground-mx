'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type DocType = { id: string; name: string; required: boolean; expires: boolean };
type VendorDoc = { id: string; docTypeId: string; status: string; fileUrl: string | null; fileName: string | null; expiresDate: string | null };
type Category = { id: string; name: string };
type Vendor = {
  id: string;
  name: string;
  rfc: string | null;
  personType: 'FISICA' | 'MORAL';
  readiness: 'READY' | 'INCOMPLETE';
  readinessOverride: boolean;
  curp: string | null;
  legalRepName: string | null;
  legalRepRfc: string | null;
  fiscalAddress: string | null;
  taxRegime: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  bankName: string | null;
  clabe: string | null;
  accountNumber: string | null;
  swiftCode: string | null;
  currency: string;
  paymentDueDay: number | null;
  defaultCategoryId: string | null;
  defaultCategory: Category | null;
  notes: string | null;
  documents: VendorDoc[];
  missingFields: string[];
  requiredDocTypes: DocType[];
  ownedBuildings: { id: string; name: string }[];
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  rfc: 'RFC',
  fiscalAddress: 'Domicilio fiscal',
  taxRegime: 'Régimen fiscal',
  email: 'Correo',
  bankName: 'Banco',
  clabe: 'CLABE',
  legalRepName: 'Representante legal',
  legalRepRfc: 'RFC del representante',
  curp: 'CURP',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  RECEIVED: 'Recibido',
  VALID: 'Validado',
  EXPIRED: 'Vencido',
  REJECTED: 'Rechazado',
};

// Campos editables de "Datos del proveedor" — mismos que el formulario de alta
// (app/vendors/new), para que lo que se precargó por CSV o se capturó al dar de
// alta sea visible y corregible aquí sin tener que recrear el proveedor.
type InfoForm = {
  rfc: string;
  curp: string;
  legalRepName: string;
  legalRepRfc: string;
  fiscalAddress: string;
  taxRegime: string;
  email: string;
  phone: string;
  contactName: string;
  bankName: string;
  clabe: string;
  accountNumber: string;
  swiftCode: string;
  currency: string;
  paymentDueDay: string;
  defaultCategoryId: string;
  notes: string;
};

function toForm(v: Vendor): InfoForm {
  return {
    rfc: v.rfc || '',
    curp: v.curp || '',
    legalRepName: v.legalRepName || '',
    legalRepRfc: v.legalRepRfc || '',
    fiscalAddress: v.fiscalAddress || '',
    taxRegime: v.taxRegime || '',
    email: v.email || '',
    phone: v.phone || '',
    contactName: v.contactName || '',
    bankName: v.bankName || '',
    clabe: v.clabe || '',
    accountNumber: v.accountNumber || '',
    swiftCode: v.swiftCode || '',
    currency: v.currency || 'MXN',
    paymentDueDay: v.paymentDueDay != null ? String(v.paymentDueDay) : '',
    defaultCategoryId: v.defaultCategoryId || '',
    notes: v.notes || '',
  };
}

export default function VendorDetailClient({
  vendor: initial,
  buildings,
  categories,
  isAdmin,
}: {
  vendor: Vendor;
  buildings: { id: string; name: string }[];
  categories: Category[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [vendor, setVendor] = useState(initial);
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState<InfoForm>(toForm(initial));
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [togglingOverride, setTogglingOverride] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/vendors/${vendor.id}`);
    const fresh = await res.json();
    setVendor(fresh);
    setInfoForm(toForm(fresh));
    router.refresh();
  }

  async function uploadDoc(docTypeId: string, file: File) {
    setUploading(docTypeId);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('docTypeId', docTypeId);
    await fetch(`/api/vendors/${vendor.id}/documents`, { method: 'POST', body: fd });
    setUploading(null);
    await refresh();
  }

  async function markValid(docId: string) {
    await fetch(`/api/vendors/${vendor.id}/documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VALID' }),
    });
    await refresh();
  }

  async function toggleBuilding(buildingId: string, checked: boolean) {
    const ids = new Set(vendor.ownedBuildings.map((b) => b.id));
    if (checked) ids.add(buildingId);
    else ids.delete(buildingId);
    await fetch(`/api/vendors/${vendor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownedBuildingIds: [...ids] }),
    });
    await refresh();
  }

  async function toggleOverride() {
    setTogglingOverride(true);
    await fetch(`/api/vendors/${vendor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readinessOverride: !vendor.readinessOverride }),
    });
    setTogglingOverride(false);
    await refresh();
  }

  function setField<K extends keyof InfoForm>(key: K, value: string) {
    setInfoForm((f) => ({ ...f, [key]: value }));
  }

  function startEditInfo() {
    setInfoForm(toForm(vendor));
    setInfoError(null);
    setEditingInfo(true);
  }

  async function saveInfo() {
    setSavingInfo(true);
    setInfoError(null);
    const res = await fetch(`/api/vendors/${vendor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfc: infoForm.rfc || null,
        curp: infoForm.curp || null,
        legalRepName: infoForm.legalRepName || null,
        legalRepRfc: infoForm.legalRepRfc || null,
        fiscalAddress: infoForm.fiscalAddress || null,
        taxRegime: infoForm.taxRegime || null,
        email: infoForm.email || null,
        phone: infoForm.phone || null,
        contactName: infoForm.contactName || null,
        bankName: infoForm.bankName || null,
        clabe: infoForm.clabe || null,
        accountNumber: infoForm.accountNumber || null,
        swiftCode: infoForm.swiftCode || null,
        currency: infoForm.currency || 'MXN',
        paymentDueDay: infoForm.paymentDueDay ? Number(infoForm.paymentDueDay) : null,
        defaultCategoryId: infoForm.defaultCategoryId || null,
        notes: infoForm.notes || null,
      }),
    });
    setSavingInfo(false);
    if (!res.ok) {
      const body = await res.json();
      setInfoError(typeof body.error === 'string' ? body.error : 'No se pudo guardar.');
      return;
    }
    setEditingInfo(false);
    await refresh();
  }

  async function deleteVendor() {
    if (!confirm(`¿Eliminar a "${vendor.name}"? Esto no se puede deshacer.`)) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/vendors/${vendor.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json();
      setDeleteError(typeof body.error === 'string' ? body.error : 'No se pudo eliminar.');
      setDeleting(false);
      return;
    }
    router.push('/vendors');
    router.refresh();
  }

  const docByType = new Map(vendor.documents.map((d) => [d.docTypeId, d]));

  const infoRows: { label: string; value: string | null; show: boolean }[] = [
    { label: 'Domicilio fiscal', value: vendor.fiscalAddress, show: true },
    { label: 'Régimen fiscal', value: vendor.taxRegime, show: true },
    { label: 'Correo', value: vendor.email, show: true },
    { label: 'Teléfono', value: vendor.phone, show: true },
    { label: 'Contacto (nombre)', value: vendor.contactName, show: true },
    { label: 'Banco', value: vendor.bankName, show: true },
    { label: 'CLABE', value: vendor.clabe, show: true },
    { label: 'Cuenta', value: vendor.accountNumber, show: true },
    { label: 'SWIFT', value: vendor.swiftCode, show: true },
    { label: 'Moneda', value: vendor.currency, show: true },
    { label: 'Día de pago', value: vendor.paymentDueDay != null ? String(vendor.paymentDueDay) : null, show: true },
    { label: 'Categoría de gasto por default', value: vendor.defaultCategory?.name || null, show: true },
    { label: 'Representante legal', value: vendor.legalRepName, show: vendor.personType === 'MORAL' },
    { label: 'RFC del representante', value: vendor.legalRepRfc, show: vendor.personType === 'MORAL' },
    { label: 'CURP', value: vendor.curp, show: vendor.personType === 'FISICA' },
    { label: 'Notas', value: vendor.notes, show: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{vendor.name}</h1>
          <p className="text-sm text-gray-500">
            {vendor.rfc || 'Sin RFC'} · {vendor.personType === 'MORAL' ? 'Persona moral' : 'Persona física'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {vendor.readiness === 'READY' ? (
            <span className="badge-ready text-sm">
              Ready · Pagable{vendor.readinessOverride ? ' (marcado manualmente)' : ''}
            </span>
          ) : (
            <span className="badge-incomplete text-sm">Incompleto · No pagable</span>
          )}
          {isAdmin && (
            <button
              onClick={toggleOverride}
              disabled={togglingOverride}
              className="text-xs text-brand-600 hover:underline whitespace-nowrap"
              title={
                vendor.readinessOverride
                  ? 'Quitar el Ready manual — volverá a depender de campos y documentos'
                  : 'Marcar este proveedor como Ready aunque falten campos o documentos'
              }
            >
              {togglingOverride ? 'Guardando…' : vendor.readinessOverride ? 'Quitar Ready manual' : 'Marcar como Ready (manual)'}
            </button>
          )}
          {isAdmin && (
            <button onClick={deleteVendor} disabled={deleting} className="text-xs text-red-600 hover:underline">
              {deleting ? 'Eliminando…' : 'Eliminar proveedor'}
            </button>
          )}
        </div>
      </div>

      {deleteError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{deleteError}</p>}

      {vendor.readinessOverride && (
        <div className="card p-4 border-brand-300 bg-brand-50 space-y-1">
          <p className="text-sm font-medium text-brand-700">
            Un administrador marcó a este proveedor como "Ready" manualmente — no necesita completar toda la documentación.
          </p>
          {(vendor.missingFields.length > 0) && (
            <p className="text-xs text-brand-700">
              Lo que seguiría faltando si se quita el Ready manual: {vendor.missingFields.map((f) => FIELD_LABELS[f] || f).join(', ')}
            </p>
          )}
        </div>
      )}

      {vendor.readiness === 'INCOMPLETE' && !vendor.readinessOverride && (
        <div className="card p-4 border-amber-300 bg-amber-50 space-y-2">
          <p className="text-sm font-medium text-amber-800">Falta para pasar a "Ready":</p>
          {vendor.missingFields.length > 0 && (
            <p className="text-sm text-amber-800">
              Campos: {vendor.missingFields.map((f) => FIELD_LABELS[f] || f).join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-sm">Datos del proveedor</h2>
          {!editingInfo && (
            <button onClick={startEditInfo} className="text-xs text-brand-600 hover:underline">
              Editar
            </button>
          )}
        </div>

        {!editingInfo ? (
          <div className="p-4 grid grid-cols-2 gap-4 text-sm">
            {infoRows.filter((r) => r.show).map((r) => (
              <div key={r.label}>
                <p className="text-gray-500">{r.label}</p>
                <p className="font-medium break-words">{r.value || '—'}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">RFC</label>
                <input className="input" value={infoForm.rfc} onChange={(e) => setField('rfc', e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="label">Categoría de gasto por default</label>
                <select className="input" value={infoForm.defaultCategoryId} onChange={(e) => setField('defaultCategoryId', e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Domicilio fiscal</label>
              <input className="input" value={infoForm.fiscalAddress} onChange={(e) => setField('fiscalAddress', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Régimen fiscal</label>
                <input className="input" value={infoForm.taxRegime} onChange={(e) => setField('taxRegime', e.target.value)} />
              </div>
              <div>
                <label className="label">Correo</label>
                <input type="email" className="input" value={infoForm.email} onChange={(e) => setField('email', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={infoForm.phone} onChange={(e) => setField('phone', e.target.value)} />
              </div>
              <div>
                <label className="label">Contacto (nombre)</label>
                <input className="input" value={infoForm.contactName} onChange={(e) => setField('contactName', e.target.value)} />
              </div>
            </div>

            {vendor.personType === 'MORAL' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Representante legal</label>
                  <input className="input" value={infoForm.legalRepName} onChange={(e) => setField('legalRepName', e.target.value)} />
                </div>
                <div>
                  <label className="label">RFC del representante</label>
                  <input className="input" value={infoForm.legalRepRfc} onChange={(e) => setField('legalRepRfc', e.target.value.toUpperCase())} />
                </div>
              </div>
            )}

            {vendor.personType === 'FISICA' && (
              <div>
                <label className="label">CURP</label>
                <input className="input" value={infoForm.curp} onChange={(e) => setField('curp', e.target.value.toUpperCase())} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Banco</label>
                <input className="input" value={infoForm.bankName} onChange={(e) => setField('bankName', e.target.value)} />
              </div>
              <div>
                <label className="label">Cuenta</label>
                <input className="input" value={infoForm.accountNumber} onChange={(e) => setField('accountNumber', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">CLABE</label>
                <input className="input" maxLength={18} value={infoForm.clabe} onChange={(e) => setField('clabe', e.target.value)} />
              </div>
              <div>
                <label className="label">SWIFT (si aplica)</label>
                <input className="input" value={infoForm.swiftCode} onChange={(e) => setField('swiftCode', e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="label">Día de pago</label>
                <input type="number" min={1} max={31} className="input" value={infoForm.paymentDueDay} onChange={(e) => setField('paymentDueDay', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label">Notas</label>
              <textarea className="input" rows={2} value={infoForm.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>

            {infoError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{infoError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingInfo(false);
                  setInfoForm(toForm(vendor));
                  setInfoError(null);
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button type="button" onClick={saveInfo} disabled={savingInfo} className="btn-primary">
                {savingInfo ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-sm">Expediente documental (AML/KYC)</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Documento</th>
              <th className="px-4 py-2 font-medium">Estatus</th>
              <th className="px-4 py-2 font-medium">Archivo</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {vendor.requiredDocTypes.map((dt) => {
              const doc = docByType.get(dt.id);
              return (
                <tr key={dt.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2">{dt.name}</td>
                  <td className="px-4 py-2">
                    {doc ? (
                      <span className={doc.status === 'VALID' || doc.status === 'RECEIVED' ? 'badge-ready' : 'badge-incomplete'}>
                        {STATUS_LABEL[doc.status] || doc.status}
                      </span>
                    ) : (
                      <span className="badge-incomplete">Falta</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {doc?.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" className="text-brand-600 hover:underline text-xs">
                        {doc.fileName || 'Ver archivo'}
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <label className="btn-secondary text-xs cursor-pointer">
                      {uploading === dt.id ? 'Subiendo…' : doc ? 'Reemplazar' : 'Subir'}
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/*"
                        onChange={(e) => e.target.files?.[0] && uploadDoc(dt.id, e.target.files[0])}
                      />
                    </label>
                    {doc && doc.status === 'RECEIVED' && (
                      <button onClick={() => markValid(doc.id)} className="ml-2 text-xs text-brand-600 hover:underline">
                        Marcar validado
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <h2 className="font-medium text-sm mb-3">Edificios a su cargo (landlord)</h2>
        <div className="grid grid-cols-3 gap-2">
          {buildings.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vendor.ownedBuildings.some((ob) => ob.id === b.id)}
                onChange={(e) => toggleBuilding(b.id, e.target.checked)}
              />
              {b.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
