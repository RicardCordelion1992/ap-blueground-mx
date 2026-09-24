import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function VendorsPage({ searchParams }: { searchParams: { readiness?: string; q?: string } }) {
  const vendors = await prisma.vendor.findMany({
    where: {
      readiness: searchParams.readiness as any,
      OR: searchParams.q
        ? [{ name: { contains: searchParams.q, mode: 'insensitive' } }, { rfc: { contains: searchParams.q, mode: 'insensitive' } }]
        : undefined,
    },
    include: { _count: { select: { documents: true, invoices: true, ownedBuildings: true } } },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Proveedores / Landlords</h1>
          <p className="text-sm text-gray-500">Expediente, documentación AML/KYC y estatus de pago</p>
        </div>
        <Link href="/vendors/new" className="btn-primary">
          + Nuevo proveedor
        </Link>
      </div>

      <form className="flex gap-2" method="get">
        <input name="q" defaultValue={searchParams.q} placeholder="Buscar por nombre o RFC…" className="input max-w-xs" />
        <select name="readiness" defaultValue={searchParams.readiness || ''} className="input max-w-xs">
          <option value="">Todos los estatus</option>
          <option value="READY">Ready</option>
          <option value="INCOMPLETE">Incompleto</option>
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">RFC</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Edificios</th>
              <th className="px-4 py-2 font-medium">Documentos</th>
              <th className="px-4 py-2 font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link href={`/vendors/${v.id}`} className="text-brand-600 hover:underline font-medium">
                    {v.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{v.rfc}</td>
                <td className="px-4 py-2 text-gray-600">{v.personType === 'MORAL' ? 'Persona moral' : 'Persona física'}</td>
                <td className="px-4 py-2 text-gray-600">{v._count.ownedBuildings || '—'}</td>
                <td className="px-4 py-2 text-gray-600">{v._count.documents}</td>
                <td className="px-4 py-2">
                  {v.readiness === 'READY' ? <span className="badge-ready">Ready</span> : <span className="badge-incomplete">Incompleto</span>}
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
