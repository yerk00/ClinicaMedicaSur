export type DomainErrorCode = 'FORBIDDEN' | 'VALIDATION' | 'NETWORK' | 'UNSUPPORTED' | 'UNKNOWN';

export class DomainError extends Error {
  code: DomainErrorCode;
  details?: any;

  constructor(code: DomainErrorCode, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function toUserMessage(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  if (typeof err === 'object' && err && 'message' in err) {
    return String((err as any).message ?? 'Ha ocurrido un error');
  }
  return 'Ha ocurrido un error';
}
