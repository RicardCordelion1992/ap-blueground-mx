import { PrismaClient } from '@prisma/client';
import { DOCUMENT_TYPE_SEED } from '../lib/documentTypes';

const prisma = new PrismaClient();

// Lista corregida de edificios (centros de costo) según lo pedido:
// se quitaron 9 edificios y JVM 421 + JVM 429 se unificaron en "JVM".
const BUILDINGS = [
  'Chapultepec 546',
  'Inés',
  'Magda',
  'Presa Las Pilas 12',
  'Amalia',
  'Cuadra 134 Torre B',
  'Josefa',
  'JVM',
  'Homero 1433',
  'Benjamin Franklin 175',
  'Ava Rio Rhin 9',
  'Edgar Allan Poe 362',
];

const CATEGORIES = [
  'Renta',
  'Mantenimiento',
  'Limpieza',
  'Servicios (luz, agua, gas)',
  'Internet / telecom',
  'Seguridad',
  'Amenidades',
  'Administración / HOA',
  'Reparaciones',
  'Mobiliario',
  'Otros',
];

async function main() {
  for (const name of BUILDINGS) {
    await prisma.building.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const [i, name] of CATEGORIES.entries()) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: i },
    });
  }

  for (const dt of DOCUMENT_TYPE_SEED) {
    await prisma.documentType.upsert({
      where: { name: dt.name },
      update: {
        appliesTo: dt.appliesTo as any,
        required: dt.required,
        expires: dt.expires,
        sortOrder: dt.sortOrder,
      },
      create: {
        name: dt.name,
        appliesTo: dt.appliesTo as any,
        required: dt.required,
        expires: dt.expires,
        sortOrder: dt.sortOrder,
      },
    });
  }

  // Asegura que el admin original de la plataforma nunca se quede sin acceso,
  // incluso si ya existen otros usuarios en la tabla (evita el candado que
  // dejó fuera a ricardo.carrasco@theblueground.com tras quitar el
  // auto-registro para cualquier correo @theblueground.com).
  await prisma.user.upsert({
    where: { email: 'ricardo.carrasco@theblueground.com' },
    update: { role: 'ADMIN', active: true },
    create: {
      email: 'ricardo.carrasco@theblueground.com',
      name: 'Ricardo Carrasco',
      role: 'ADMIN',
      active: true,
    },
  });

  console.log(`Seed listo: ${BUILDINGS.length} edificios, ${CATEGORIES.length} categorías, ${DOCUMENT_TYPE_SEED.length} tipos de documento.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
