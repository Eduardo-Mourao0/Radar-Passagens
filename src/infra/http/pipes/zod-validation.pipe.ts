import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}

  transform(value: unknown) {
    const resultado = this.schema.safeParse(value);

    if (!resultado.success) {
      throw new BadRequestException({
        message: 'Dados de entrada inválidos.',
        errors: resultado.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      });
    }

    return resultado.data;
  }
}
