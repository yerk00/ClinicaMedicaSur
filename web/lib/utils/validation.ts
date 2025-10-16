import { DomainError } from './errors';
import { getCurrentUserRole } from '@/lib/permissions';

export function normalizeCi(ci: string): string {
  return (ci || '').replace(/[.\s-]/g, '').trim();
}

export function isValidCi(ci: string): boolean {
  const v = normalizeCi(ci);
  // Regla simple: 5–20 caracteres alfanuméricos (ajusta a tu país)
  return /^[A-Za-z0-9]{5,20}$/.test(v);
}

export function isValidSexo(
  sexo: string | null | undefined
): sexo is 'masculino'|'femenino'|'otro'|'prefiere_no_decir' {
  if (!sexo) return false;
  return ['masculino','femenino','otro','prefiere_no_decir'].includes(sexo);
}

export async function assertAdmin(): Promise<void> {
  const role = await getCurrentUserRole();
  const name = typeof role === 'string' ? role : (role?.name ?? '');
  if (name !== 'Administrador') {
    throw new DomainError('FORBIDDEN', 'Acceso denegado: se requiere rol Administrador.');
  }
}
