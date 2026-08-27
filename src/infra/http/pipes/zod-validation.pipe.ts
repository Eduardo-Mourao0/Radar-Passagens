import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}

  transform(value: unknown) {
    const resultado = this.schema.safeParse(value);

    if (!resultado.success) {
      throw new BadRequestException({
        message: MENSAGENS_ERRO.dadosEntradaInvalidos,
        errors: resultado.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      });
    }

    return resultado.data;
  }
}
