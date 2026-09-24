import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import UnitsClient from './UnitsClient';

export const dynamic = 'force-dynamic';

export default async function BuildingDetailPage({ params }: { params: { id: string } }) {
  const building = await prisma.building.findUnique({
    where: { id: params.id },
    include: { landlord: true, units: { orderBy: { unitNumber: 'asc' } } },
  });
  if (!building) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{building.name}</h1>
        <p className="text-sm text-gray-500">Landlord: {building.landlord?.name || 'Sin asignar'}</p>
      </div>
      <UnitsClient buildingId={building.id} units={building.units} />
    </div>
  );
}
