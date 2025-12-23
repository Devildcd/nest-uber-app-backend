import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

function isNumber(x: any) {
  return typeof x === 'number' && Number.isFinite(x);
}

function isLngLatPair(pair: any): boolean {
  return (
    Array.isArray(pair) &&
    pair.length >= 2 &&
    isNumber(pair[0]) &&
    isNumber(pair[1])
  );
}

// MultiPolygon: coordinates = [ [ [ [lng,lat], ... ] ] , ... ]
function isMultiPolygonCoords(coords: any): boolean {
  if (!Array.isArray(coords)) return false;
  return coords.every(
    (poly) =>
      Array.isArray(poly) &&
      poly.every(
        (ring) => Array.isArray(ring) && ring.every((pt) => isLngLatPair(pt)),
      ),
  );
}

export function IsGeoJsonMultiPolygon(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsGeoJsonMultiPolygon',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (value == null) return true; // opcional
          if (typeof value !== 'object') return false;
          if (value.type !== 'MultiPolygon') return false;
          return isMultiPolygonCoords(value.coordinates);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be GeoJSON MultiPolygon`;
        },
      },
    });
  };
}
