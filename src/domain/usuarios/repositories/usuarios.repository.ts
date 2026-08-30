import {
  FinalidadeVerificacaoTelefone,
  RefreshToken,
  Usuario,
  VerificacaoTelefone,
} from '../entities/usuario.entity';

export const USUARIOS_REPOSITORY = Symbol('USUARIOS_REPOSITORY');

export interface UsuariosRepository {
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorIds(ids: readonly string[]): Promise<Usuario[]>;
  buscarPorTelefone(telefone: string): Promise<Usuario | null>;
  criar(dados: {
    telefone: string;
    senhaHash: string;
    telegramChatId: string;
    verificadoEm: Date;
  }): Promise<Usuario>;
  atualizarSenha(id: string, senhaHash: string): Promise<void>;
  atualizarTentativasLogin(
    id: string,
    tentativasLoginFalhas: number,
    bloqueadoAte: Date | null,
  ): Promise<void>;
  criarVerificacao(dados: {
    telefone: string;
    finalidade: FinalidadeVerificacaoTelefone;
    senhaHash?: string;
    tokenInicio: string;
    expiraEm: Date;
  }): Promise<VerificacaoTelefone>;
  buscarVerificacaoPorId(id: string): Promise<VerificacaoTelefone | null>;
  buscarVerificacaoPorTokenInicio(
    tokenInicio: string,
  ): Promise<VerificacaoTelefone | null>;
  prepararCodigoTelegram(dados: {
    verificacaoId: string;
    telegramChatId: string;
    telegramUsuarioId: string;
    codigoHash: string;
    quando: Date;
  }): Promise<boolean>;
  cancelarCodigoTelegram(
    verificacaoId: string,
    codigoHash: string,
  ): Promise<void>;
  incrementarTentativasCodigo(
    id: string,
    quando: Date,
    maximoTentativas: number,
  ): Promise<boolean>;
  finalizarVerificacaoPorCodigo(dados: {
    verificacaoId: string;
    codigoHash: string;
    quando: Date;
  }): Promise<'VERIFICADA' | 'INDISPONIVEL' | 'TELEFONE_JA_CADASTRADO'>;
  marcarVerificacaoComoVerificada(id: string, quando: Date): Promise<void>;
  consumirVerificacao(id: string, quando: Date): Promise<void>;
  contarVerificacoesRecentes(
    telefone: string,
    finalidade: FinalidadeVerificacaoTelefone,
    desde: Date,
  ): Promise<number>;
  criarRefreshToken(dados: {
    usuarioId: string;
    tokenHash: string;
    expiraEm: Date;
  }): Promise<RefreshToken>;
  buscarRefreshTokenPorId(id: string): Promise<RefreshToken | null>;
  consumirRefreshToken(id: string, quando: Date): Promise<boolean>;
  revogarRefreshToken(id: string, quando: Date): Promise<void>;
  revogarRefreshTokensDoUsuario(id: string, quando: Date): Promise<void>;
}
