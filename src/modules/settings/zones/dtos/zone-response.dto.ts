export class ZoneResponseDto {
  id!: string;
  cityId!: string;
  name!: string;
  kind!: string | null;
  priority!: number;
  active!: boolean;
  geom!: any; // GeoJSON MultiPolygon
  createdAt!: string;
  updatedAt!: string;
}

export class ZoneListItemDto {
  id!: string;
  cityId!: string;
  cityName?: string | null; // si haces join en list
  name!: string;
  kind!: string | null;
  priority!: number;
  active!: boolean;
  createdAt!: string;
  updatedAt!: string;
}

const toISO = (d?: Date | null) => (d instanceof Date ? d.toISOString() : null);

export function toZoneListItemDto(z: any): ZoneListItemDto {
  return {
    id: z.id,
    cityId: z.city?.id ?? z.cityId,
    cityName: z.city?.name ?? null,
    name: z.name,
    kind: z.kind ?? null,
    priority: z.priority,
    active: z.active,
    createdAt: toISO(z.createdAt)!,
    updatedAt: toISO(z.updatedAt)!,
  };
}

export function toZoneResponseDto(z: any): ZoneResponseDto {
  return {
    ...toZoneListItemDto(z),
    geom: z.geom, // MultiPolygon (GeoJSON) ya viene así desde TypeORM/PostGIS
  };
}
