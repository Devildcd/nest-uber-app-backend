import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'Match' })
export class MatchConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints as [string];
    const obj = args.object as Record<string, unknown>;
    const relatedValue =
      obj && typeof relatedPropertyName === 'string'
        ? obj[relatedPropertyName]
        : undefined;
    return value === relatedValue;
  }
  defaultMessage(args: ValidationArguments) {
    const relatedPropertyName =
      Array.isArray(args.constraints) && typeof args.constraints[0] === 'string'
        ? args.constraints[0]
        : '';
    return `${args.property} must match ${relatedPropertyName}`;
  }
}

export function Match(property: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor as new (...args: any[]) => any,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: MatchConstraint,
    });
  };
}
