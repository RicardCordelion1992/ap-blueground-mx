# Cuentas por Pagar — Blueground México

Plataforma real (Next.js + Postgres/Supabase + Vercel) para captura de facturas,
gestión de proveedores/landlords con expediente documental AML/KYC, y reporteo
por edificio y unidad.

Ver **SETUP.md** para desplegarla paso a paso.

## Qué incluye esta primera versión

- **Autenticación** restringida a correos `@theblueground.com` (Supabase Auth, magic link).
- **Proveedores/landlords**: alta con persona física o moral, expediente documental AML/KYC
  (subida de archivos, estatus por documento), estatus automático **Ready / Incompleto**
  que bloquea que una factura se marque como pagable hasta que el expediente esté completo.
- **Edificios y unidades ("depas")**: catálogo de edificios (centros de costo) con sus
  unidades y su código PO (Property Onboarding), agregables sin salir del flujo de captura.
- **Facturas**: captura manual o por extracción automática con IA (PDF con texto o imagen),
  asignación a uno o varios edificios/unidades sin límite, con validación de que la suma
  coincida con el total.
- **Reportes**: desglose por edificio y por unidad, en $ y % (el % siempre se calcula al
  momento, nunca se guarda, para que no se desactualice).
- **Bitácora de auditoría** de creación/edición de proveedores, documentos y facturas.

## Qué falta / próximos pasos sugeridos

- Ingesta automática por correo (reenvío de facturas) — requiere configurar un webhook de
  correo entrante; no incluido en esta primera versión.
- Conexión con la plataforma interna de Blueground (para P&L / reporteo financiero).
- Exportación de lote de pago para el banco — pendiente de que el equipo comparta el
  formato/plantilla exacto que pide el portal del banco.
- Roles y permisos más finos (por ahora: ADMIN / FINANCE / VIEWER definidos en el modelo,
  pero el primer usuario que entra queda ADMIN y el resto FINANCE por defecto).
- Revisión legal/compliance del checklist documental AML/KYC (`lib/documentTypes.ts`).

## Estructura del proyecto

```
app/            páginas y rutas de API (Next.js App Router)
  api/          endpoints REST (vendors, buildings, invoices, reports, ...)
  vendors/      páginas de proveedores
  buildings/    páginas de edificios/unidades
  invoices/     páginas de facturas
  reports/      reportes por edificio/unidad
lib/            lógica compartida (Prisma, Supabase, readiness, extracción IA, auditoría)
prisma/         esquema de base de datos + seed de catálogos iniciales
```
