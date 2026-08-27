import { z } from 'zod';
import { MENSAGENS_ERRO } from '../../../../domain/errors/mensagens-erro';

const codigoIataSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, MENSAGENS_ERRO.codigoIataInvalido);

const dataIdaSchema = z.iso.date().refine(
  (dataIda) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return new Date(`${dataIda}T00:00:00`) >= hoje;
  },
  { message: MENSAGENS_ERRO.dataIdaPassada },
);

export const criarRotaSchema = z
  .object({
    origem: codigoIataSchema,
    destino: codigoIataSchema,
    dataIda: dataIdaSchema,
    dataVolta: z.iso.date().optional(),
  })
  .refine(({ origem, destino }) => origem !== destino, {
    message: MENSAGENS_ERRO.origemDestinoIguais,
    path: ['destino'],
  })
  .refine(({ dataIda, dataVolta }) => !dataVolta || dataVolta >= dataIda, {
    message: MENSAGENS_ERRO.dataVoltaAnterior,
    path: ['dataVolta'],
  })
  .strict();

export type CriarRotaInput = z.infer<typeof criarRotaSchema>;
