import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import NewBuildingForm from './NewBuildingForm';

export const dynamic = 'force-dynamic';

export default async function BuildingsPage() {
  const buildings = await prisma.building.findMany({
    include: { landlord: { select: { name: true, readiness: true } }, _count: { select: { units: true } } },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Edificios</h1>
          <p className="text-sm text-gray-500">Centros de costo y sus unidades ("depas")</p>
        </div>
        <NewBuildingForm />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Edificio</th>
              <th className="px-4 py-2 font-medium">Landlord</th>
              <th className="px-4 py-2 font-medium">Unidades</th>
            </tr>
          </thead>
          <tbody>
            {buildings.map((b) => (
              <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link href={`/buildings/${b.id}`} className="text-brand-600 hover:underline font-medium">
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{b.landlord?.name || '—'}</td>
                <td className="px-4 py-2 text-gray-600">{b._count.units}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
