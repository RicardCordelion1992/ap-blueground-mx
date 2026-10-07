// Pequeño helper para generar archivos CSV descargables desde las rutas /api/exports/*.
// Usamos coma como separador y comillas donde haga falta (estándar CSV), con un BOM UTF-8
// al inicio para que Excel detecte el acentuado/ñ correctamente al abrir el archivo.

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | boolean | null | undefined };

function escapeCsvField(raw: string): string {
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.header)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = c.value(row);
        if (v === null || v === undefined) return '';
        return escapeCsvField(String(v));
      })
      .join(',')
  );
  return '﻿' + [header, ...lines].join('\r\n') + '\r\n';
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
