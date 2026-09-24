'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type DocType = { id: string; name: string; required: boolean; expires: boolean };
type VendorDoc = { id: string; docTypeId: string; status: string; fileUrl: string | null; fileName: string | null; expiresDate: string | null };
type Vendor = {
  id: string;
  name: string;
  rfc: string;
  personType: 'FISICA' | 'MORAL';
  readiness: 'READY' | 'INCOMPLETE';
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

export default function VendorDetailClient({ vendor: initial, buildings }: { vendor: Vendor; buildings: { id: string; name: string }[] }) {
  const router = useRouter();
  const [vendor, setVendor] = useState(initial);
  const [uploading, setUploading] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/vendors/${vendor.id}`);
    setVendor(await res.json());
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

  const docByType = new Map(vendor.documents.map((d) => [d.docTypeId, d]));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{vendor.name}</h1>
          <p className="text-sm text-gray-500">
            {vendor.rfc} · {vendor.personType === 'MORAL' ? 'Persona moral' : 'Persona física'}
          </p>
        </div>
        {vendor.readiness === 'READY' ? <span className="badge-ready text-sm">Ready · Pagable</span> : <span className="badge-incomplete text-sm">Incompleto · No pagable</span>}
      </div>

      {vendor.readiness === 'INCOMPLETE' && (
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
