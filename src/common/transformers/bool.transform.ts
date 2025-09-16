export function toBool(value: any) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    // 1 => true, 0 => false, otros: se devuelven tal cual
    if (value === 1) return true;
    if (value === 0) return false;
    return value;
  }

  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
    // deja pasar otros valores (p.ej. '' o 'null') para que otros @Transform/@ValidateIf actúen
    return value;
  }

  return value;
}
