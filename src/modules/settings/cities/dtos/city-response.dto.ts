export class CityResponseDto {
  id!: string;
  name!: string;
  countryCode!: string;
  timezone!: string;
  active!: boolean;
  geom!: any | null; // GeoJSON MultiPolygon o null

  createdAt!: string;
  updatedAt!: string;
}

export class CityListItemDto {
  id!: string;
  name!: string;
  countryCode!: string;
  timezone!: string;
  active!: boolean;

  createdAt!: string;
  updatedAt!: string;
}

const toISO = (d?: Date | null) => (d instanceof Date ? d.toISOString() : null);

export function toCityListItemDto(c: any): CityListItemDto {
  return {
    id: c.id,
    name: c.name,
    countryCode: c.countryCode,
    timezone: c.timezone,
    active: c.active,
    createdAt: toISO(c.createdAt)!,
    updatedAt: toISO(c.updatedAt)!,
  };
}

export function toCityResponseDto(c: any): CityResponseDto {
  return {
    ...toCityListItemDto(c),
    geom: c.geom ?? null,
  };
}
