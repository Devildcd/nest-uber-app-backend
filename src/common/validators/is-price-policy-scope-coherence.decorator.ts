import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { PricePolicyScopeType } from 'src/modules/settings/price-policies/entities/price-policy.entity';

export function IsPricePolicyScopeCoherent(opts?: ValidationOptions) {
  return (obj: object, prop: string) =>
    registerDecorator({
      name: 'IsPricePolicyScopeCoherent',
      target: obj.constructor,
      propertyName: prop,
      options: opts,
      validator: {
        validate(_: any, args: ValidationArguments) {
          const dto: any = args.object;
          const scope: PricePolicyScopeType = dto.scopeType;
          const cityId = dto.cityId ?? null;
          const zoneId = dto.zoneId ?? null;

          if (scope === PricePolicyScopeType.GLOBAL)
            return cityId == null && zoneId == null;
          if (scope === PricePolicyScopeType.CITY)
            return cityId != null && zoneId == null;
          if (scope === PricePolicyScopeType.ZONE)
            return zoneId != null && cityId == null;
          return false;
        },
        defaultMessage() {
          return `scopeType coherence violated: GLOBAL requires cityId/zoneId null; CITY requires cityId and zoneId null; ZONE requires zoneId and cityId null`;
        },
      },
    });
}
