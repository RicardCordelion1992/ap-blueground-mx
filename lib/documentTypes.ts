// Checklist documental AML/KYC de referencia (LFPIORPI + práctica fiscal MX).
// Esto alimenta el seed inicial de DocumentType. IMPORTANTE: esta lista es un
// punto de partida razonable, no asesoría legal — debe validarla el equipo
// legal/compliance de Blueground antes de depender de ella operativamente.
export const DOCUMENT_TYPE_SEED = [
  // Aplica a ambos tipos de persona
  { name: 'Constancia de Situación Fiscal (CSF) vigente', appliesTo: null, required: true, expires: true, sortOrder: 10 },
  { name: 'Comprobante de domicilio fiscal (< 3 meses)', appliesTo: null, required: true, expires: true, sortOrder: 20 },
  { name: 'Estado de cuenta bancario (CLABE) para dispersión', appliesTo: null, required: true, expires: false, sortOrder: 30 },
  { name: 'Opinión de cumplimiento SAT (32-D) positiva', appliesTo: null, required: true, expires: true, sortOrder: 40 },
  { name: 'Cuestionario / formato de identificación AML (LFPIORPI)', appliesTo: null, required: true, expires: false, sortOrder: 50 },
  { name: 'Contrato de arrendamiento o prestación de servicios firmado', appliesTo: null, required: true, expires: false, sortOrder: 60 },

  // Persona física
  { name: 'Identificación oficial vigente (INE/pasaporte)', appliesTo: 'FISICA', required: true, expires: true, sortOrder: 100 },
  { name: 'CURP', appliesTo: 'FISICA', required: true, expires: false, sortOrder: 110 },

  // Persona moral
  { name: 'Acta constitutiva', appliesTo: 'MORAL', required: true, expires: false, sortOrder: 200 },
  { name: 'Poder notarial del representante legal', appliesTo: 'MORAL', required: true, expires: false, sortOrder: 210 },
  { name: 'Identificación oficial del representante legal', appliesTo: 'MORAL', required: true, expires: true, sortOrder: 220 },
  { name: 'Constancia de situación fiscal del representante legal', appliesTo: 'MORAL', required: false, expires: true, sortOrder: 230 },

  // Landlord-specific (solo si aplica al proveedor)
  { name: 'Escritura o título de propiedad del inmueble', appliesTo: null, required: false, expires: false, sortOrder: 300 },
] as const;
