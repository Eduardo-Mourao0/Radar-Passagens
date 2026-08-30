import { MENSAGENS_ERRO } from '../../errors/mensagens-erro';
import { RegraDeNegocioError } from '../../errors/regra-de-negocio.error';

export type Usuario = Readonly<{
  id: string;
  telefone: string;
  senhaHash: string;
  telegramChatId: string;
  verificadoEm: Date;
  tentativasLoginFalhas: number;
  bloqueadoAte: Date | null;
}>;

export type FinalidadeVerificacaoTelefone = 'CADASTRO' | 'RECUPERACAO';

export type VerificacaoTelefone = Readonly<{
  id: string;
  telefone: string;
  finalidade: FinalidadeVerificacaoTelefone;
  senhaHash: string | null;
  tokenInicio: string;
  telegramChatId: string | null;
  telegramUsuarioId: string | null;
  codigoHash: string | null;
  tentativasCodigo: number;
  codigoEnviadoEm: Date | null;
  verificadaEm: Date | null;
  consumidaEm: Date | null;
  expiraEm: Date;
  criadoEm: Date;
}>;

export type RefreshToken = Readonly<{
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiraEm: Date;
  revogadoEm: Date | null;
}>;

export class UsuarioEntity {
  private static readonly TELEFONE_E164 = /^\+[1-9]\d{7,14}$/;
  private static readonly PIN = /^\d{4}$/;

  static normalizarTelefone(telefone: string): string {
    const normalizado = telefone.trim().replace(/[\s()-]/g, '');

    if (!this.TELEFONE_E164.test(normalizado)) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.telefoneInvalido);
    }

    return normalizado;
  }

  static validarPin(pin: string): string {
    if (!this.PIN.test(pin)) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.pinInvalido);
    }

    return pin;
  }

  static estaBloqueado(usuario: Usuario, agora = new Date()): boolean {
    return Boolean(usuario.bloqueadoAte && usuario.bloqueadoAte > agora);
  }
}
