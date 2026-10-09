// Etiqueta legible del periodo de facturación (billingStart/billingEnd) de una factura, usada
// en las listas de Facturas, Aprobar y Pagar para que se vea a qué mes/periodo corresponde el
// gasto sin tener que abrir el detalle. Si ambas fechas caen en el mismo mes (el caso típico de
// servicios como CFE), muestra "Septiembre 2026"; si no, muestra el rango de fechas.
export function periodLabel(billingStart: Date | string | null, billingEnd: Date | string | null): string {
  const start = billingStart ? new Date(billingStart) : null;
  const end = billingEnd ? new Date(billingEnd) : null;

  if (!start && !end) return '—';

  if (start && end) {
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return capitalize(start.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }));
    }
    return `${start.toLocaleDateString('es-MX')} – ${end.toLocaleDateString('es-MX')}`;
  }

  const only = (start || end) as Date;
  return capitalize(only.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
