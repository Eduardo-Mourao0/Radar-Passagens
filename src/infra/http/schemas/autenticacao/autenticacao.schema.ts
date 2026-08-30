import { z } from 'zod';

export const telefoneSchema = z.object({ telefone: z.string().min(8).max(20) });
export const cadastroSchema = telefoneSchema.extend({
  pin: z.string().regex(/^\d{4}$/),
});
export const loginSchema = cadastroSchema;
export const redefinirPinSchema = z.object({
  tokenRedefinicao: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/),
});
export const confirmarCodigoTelegramSchema = z.object({
  codigo: z.string().regex(/^\d{6}$/),
});
export const verificacaoParamsSchema = z.object({ id: z.uuid() });

export type CadastroInput = z.infer<typeof cadastroSchema>;
export type TelefoneInput = z.infer<typeof telefoneSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RedefinirPinInput = z.infer<typeof redefinirPinSchema>;
export type ConfirmarCodigoTelegramInput = z.infer<
  typeof confirmarCodigoTelegramSchema
>;
export type VerificacaoParams = z.infer<typeof verificacaoParamsSchema>;
