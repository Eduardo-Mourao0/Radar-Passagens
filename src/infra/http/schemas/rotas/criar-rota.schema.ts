import { z } from 'zod';

const codigoIataSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Informe um código IATA de três letras maiúsculas.');

export const criarRotaSchema = z
  .object({
    origem: codigoIataSchema,
    destino: codigoIataSchema,
    dataIda: z.iso.date(),
    dataVolta: z.iso.date().optional(),
  })
  .strict();

export type CriarRotaInput = z.infer<typeof criarRotaSchema>;
