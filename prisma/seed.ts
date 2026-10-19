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
  // Utilities
  'Telco',
  'Water',
  'Power',
  'Cleaning expense',
  'Pest control fee',
  'Other Bills expenses',
  // OPEX
  'Maintenance New property - BG charges',
  'Maintenance New property - LL charges',
  'Maintenance Existing property - BG charges',
  'Maintenance Existing property - LL charges',
  'Maintenance Existing property - Client charges',
  'Real Estate agent fee (guests bookings)',
  'Consumables - Maintenance Spare Parts',
  'Consumables - Welcome Kit',
  'Consumables - Cleaning Supplies',
  'Consumables - Other',
  'Laundry (new inventory)',
  'Photography',
  'Transportation expenses (unit to unit)',
  // SG&A
  'Marketing Listing Site Fees',
  'Marketing - Landlords',
  'Medical Insurance',
  'Office rental expense',
  'Warehouse rental expense',
  'Common fees - office',
  'Office supplies',
  'Property insurance',
  'Software tools',
  'Accounting',
  'Legal',
  'Outsourcing - 3rd party charges',
  'Travel expenses (tickets & commuting)',
  'Team outings & entertainment',
  'Ad-hoc / other expenses',
  // Capex
  'Other Hardware',
  'Other Furniture',
  'Other Appliances',
  'Other Decorative Items',
  'Kitchen Accessories',
  'Living Room Accessories',
  'Bathroom Accessories',
  'Linen/Towels',
  'Other Fabrics',
  'Artwork',
  'TV',
  'Laptops',
  'Software',
  // Cleaning
  'Cleaning penalties - Charged to BG',
  // Usados pero no oficiales (nuevos, aprobados por ti)
  'Gas',
  'Gas JVM 429',
  'Gas JVM 421',
  'Security guards',
  'Drinkable water',
  'Trash collection fee',
  'Elevator Maintenance',
  'Other Accessories',
  'Condo Fee',
  'Other Security Deposits',
  'Furniture rental',
  'Amenities',
  'Staff',
  'Agency Commission',
  'Heat/AC',
  'Taxes & other government fees',
  'Other Penalties',
  'Furniture (Client Charge)',
  'Client Charge Transportation',
  // Genéricas que decidiste dejar separadas
  'Rental expense',
  'Interest',
];

async function main() {
  for (const name of BUILDINGS) {
    await prisma.building.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

    const OLD_GENERIC_CATEGORIES = [
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

 for (const name of CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: {},
      create: { name },
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
