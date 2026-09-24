# Puesta en marcha — Cuentas por Pagar (Blueground México)

Esta guía asume que ya creaste las 3 cuentas (GitHub, Supabase, Vercel) bajo tu correo
de trabajo. Sigue los pasos en orden — no se necesita saber programar, solo copiar y pegar.

## 1. Supabase — base de datos, storage y auth

1. Entra a tu proyecto en [supabase.com](https://supabase.com) → **Project Settings → Database**.
   - Copia la cadena de conexión **"Connection pooling" (Transaction mode, puerto 6543)** → esa es `DATABASE_URL`.
   - Copia la cadena **"Direct connection" (puerto 5432)** → esa es `DIRECT_URL`.
2. **Project Settings → API**: copia `Project URL`, `anon public key` y `service_role key` (esta última nunca se comparte fuera de Vercel — da acceso total).
3. **Authentication → Providers → Email**: dejar activado "Email OTP" / magic link (viene activado por defecto). En **Authentication → URL Configuration**, agrega como Redirect URL:
   `https://<tu-dominio-de-vercel>.vercel.app/auth/callback` (lo tendrás después del paso 3 de Vercel; puedes regresar a completarlo).
4. **Storage → Create bucket** (créalos como **privados**, NO públicos — guardan CLABEs, identificaciones y documentos fiscales):
   - `vendor-documents`
   - `invoice-files`
5. Corre las migraciones y la carga inicial de catálogos (edificios, categorías, checklist AML). Esto se hace una sola vez, desde tu computadora o pidiéndomelo a mí en el chat cuando ya tengas las variables de entorno — yo puedo ejecutar `npx prisma migrate deploy && npm run seed` por ti si me compartes las variables (o puedes hacerlo tú con Node instalado).

## 2. Anthropic API key (para la extracción automática de datos de facturas)

1. Entra a [console.anthropic.com](https://console.anthropic.com) con tu correo de trabajo → **API Keys → Create key**.
2. Copia la key (empieza con `sk-ant-...`) → esa es `ANTHROPIC_API_KEY`.

## 3. GitHub — subir el código

1. En tu repositorio nuevo y vacío, usa **Add file → Upload files** y arrastra **todo el contenido** de la carpeta que te compartí (no la carpeta misma, su contenido: `app/`, `lib/`, `prisma/`, `package.json`, etc.).
2. Commit directamente a `main`.
3. Cada vez que te comparta una actualización, repites este mismo paso (sube los archivos que cambiaron, GitHub los reemplaza automáticamente).

## 4. Vercel — desplegar

1. **Add New → Project → Import** tu repositorio de GitHub.
2. Framework detectado: Next.js (automático, no cambies nada).
3. Antes de darle "Deploy", abre **Environment Variables** y agrega:

   | Nombre | Valor |
   |---|---|
   | `DATABASE_URL` | (paso 1) |
   | `DIRECT_URL` | (paso 1) |
   | `NEXT_PUBLIC_SUPABASE_URL` | (paso 1) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (paso 1) |
   | `SUPABASE_SERVICE_ROLE_KEY` | (paso 1) |
   | `SUPABASE_DOCS_BUCKET` | `vendor-documents` |
   | `SUPABASE_INVOICES_BUCKET` | `invoice-files` |
   | `ALLOWED_EMAIL_DOMAIN` | `theblueground.com` |
   | `ANTHROPIC_API_KEY` | (paso 2) |

4. Dale **Deploy**. Al terminar, Vercel te da una URL tipo `https://ap-blueground-mx.vercel.app` — regresa al paso 1.3 de Supabase y confirma que esa URL + `/auth/callback` esté en la lista de Redirect URLs.
5. Entra a la URL, escribe tu correo @theblueground.com — te llega un link mágico por correo, lo abres y ya estás dentro. El primer usuario que entra queda automáticamente como Administrador.

## Notas de seguridad

- Los buckets de Storage son **privados**: los documentos (identificaciones, actas, CLABEs, facturas) nunca tienen una URL pública fija — la app genera un link temporal (10 minutos) cada vez que alguien los abre.
- Solo se permite iniciar sesión con correos `@theblueground.com` — cualquier otro dominio es rechazado automáticamente.
- La `service_role key` de Supabase nunca debe compartirse fuera de la configuración de variables de entorno en Vercel.
- Recomendado: en cuanto TI/Seguridad revise el proyecto, que confirmen la política de retención de documentos AML/KYC y, si aplica, transfieran la propiedad de las cuentas de GitHub/Supabase/Vercel a una cuenta de organización en vez de la cuenta personal de trabajo.
- El checklist documental (LFPIORPI) incluido es un punto de partida razonable, no asesoría legal — debe validarlo el equipo legal/compliance antes de depender de él operativamente para bloquear pagos.
