import { z } from 'zod';

export const configurarAlertaPrecoSchema = z.object({
  precoAlvo: z
    .string()
    .regex(
      /^(?:[1-9]\d{0,7}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/,
      'precoAlvo deve ser um valor decimal positivo de até 99.999.999,99.',
    ),
});

export type ConfigurarAlertaPrecoInput = z.infer<
  typeof configurarAlertaPrecoSchema
>;
