export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 8;

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

// Mismas reglas que revisa el servidor; aquí solo sirven para avisar antes de enviar
export function validateRegister(v: RegisterInput): Partial<Record<keyof RegisterInput, string>> {
  const errors: Partial<Record<keyof RegisterInput, string>> = {};
  if (v.name.trim().length < 2) errors.name = 'Escribe tu nombre.';
  if (!EMAIL_RE.test(v.email.trim())) errors.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
  if (v.phone.replace(/\D/g, '').length !== 10) errors.phone = 'El teléfono debe tener 10 dígitos.';
  if (v.password.length < MIN_PASSWORD) errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  return errors;
}
