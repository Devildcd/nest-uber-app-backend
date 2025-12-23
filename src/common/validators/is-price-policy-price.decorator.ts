import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

function isFiniteNonNeg(n: any) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function validatePrice(value: any): boolean {
  if (value == null || typeof value !== 'object') return false;

  const keys = [
    'base_fare',
    'per_km',
    'per_minute',
    'minimum_fare',
    'booking_fee',
    'night_surcharge',
    'cap',
  ] as const;

  for (const k of keys) {
    if (value[k] !== undefined && !isFiniteNonNeg(value[k])) return false;
  }

  const driver =
    (value.base_fare ?? 0) > 0 ||
    (value.per_km ?? 0) > 0 ||
    (value.per_minute ?? 0) > 0;

  return driver;
}

export function IsPricePolicyPrice(opts?: ValidationOptions) {
  return (obj: object, prop: string) =>
    registerDecorator({
      name: 'IsPricePolicyPrice',
      target: obj.constructor,
      propertyName: prop,
      options: opts,
      validator: {
        validate: (v) => validatePrice(v),
        defaultMessage: (a: ValidationArguments) =>
          `${a.property} must be valid price (non-negative numbers; at least one of base_fare/per_km/per_minute > 0)`,
      },
    });
}
