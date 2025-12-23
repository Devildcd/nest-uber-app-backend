import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsIanaTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsIanaTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string' || !value.trim()) return false;
          try {
            Intl.DateTimeFormat('en-US', { timeZone: value }).format(
              new Date(),
            );
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid IANA timezone`;
        },
      },
    });
  };
}
