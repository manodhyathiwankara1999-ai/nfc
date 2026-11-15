import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

interface ValidationSchema {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: unknown }
    | { success: false; error: { issues: Array<{ message: string }> } };
}

@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown> {
  constructor(private readonly schema: ValidationSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException('Request validation failed.');
    }
    return result.data;
  }
}
