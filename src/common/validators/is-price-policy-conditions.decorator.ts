import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YYYYMMDD = /^\d{4}-\d{2}-\d{2}$/;

function validateConditions(value: any): boolean {
  if (value == null) return true;
  if (typeof value !== 'object') return false;

  const d = value.days_of_week;
  if (d !== undefined) {
    if (
      !Array.isArray(d) ||
      d.some((x) => !Number.isInteger(x) || x < 1 || x > 7)
    )
      return false;
  }

  const tr = value.time_ranges;
  if (tr !== undefined) {
    if (!Array.isArray(tr)) return false;
    for (const r of tr) {
      if (!r || typeof r !== 'object') return false;
      if (!HHMM.test(r.start) || !HHMM.test(r.end)) return false;
      if (r.end <= r.start) return false;
    }
  }

  const dates = value.dates;
  if (dates !== undefined) {
    if (
      !Array.isArray(dates) ||
      dates.some((s) => typeof s !== 'string' || !YYYYMMDD.test(s))
    )
      return false;
  }

  const ex = value.exclude_dates;
  if (ex !== undefined) {
    if (
      !Array.isArray(ex) ||
      ex.some((s) => typeof s !== 'string' || !YYYYMMDD.test(s))
    )
      return false;
  }

  const dr = value.date_ranges;
  if (dr !== undefined) {
    if (!Array.isArray(dr)) return false;
    for (const r of dr) {
      if (!r || typeof r !== 'object') return false;
      if (!YYYYMMDD.test(r.from) || !YYYYMMDD.test(r.to)) return false;
      if (r.to < r.from) return false;
    }
  }

  return true;
}

export function IsPricePolicyConditions(opts?: ValidationOptions) {
  return (obj: object, prop: string) =>
    registerDecorator({
      name: 'IsPricePolicyConditions',
      target: obj.constructor,
      propertyName: prop,
      options: opts,
      validator: {
        validate: (v) => validateConditions(v),
        defaultMessage: (a: ValidationArguments) =>
          `${a.property} must be a valid conditions object (days_of_week 1..7, HH:MM ranges, YYYY-MM-DD dates)`,
      },
    });
}
