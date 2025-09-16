import { ValueTransformer } from 'typeorm';

export const DecimalTransformer: ValueTransformer = {
  to: (value?: number | null) =>
    value === null || value === undefined ? null : value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : parseFloat(value),
};

export function _roundTo2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
