import { z } from 'zod';

export const rotaIdParamsSchema = z
  .object({
    id: z.string().uuid('id deve ser um UUID válido.'),
  })
  .strict();

export type RotaIdParams = z.infer<typeof rotaIdParamsSchema>;
