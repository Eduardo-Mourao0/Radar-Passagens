import {
  FinalidadeVerificacaoTelefone,
  RefreshToken,
  Usuario,
  VerificacaoTelefone,
} from '../entities/usuario.entity';

export const USUARIOS_REPOSITORY = Symbol('USUARIOS_REPOSITORY');

export interface UsuariosRepository {
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorTelefone(telefone: string): Promise<Usuario | null>;
  criar(dados: {
    telefone: string;
    senhaHash: string;
    telegramChatId: string;
    telefoneVerificadoEm: Date;
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
  buscarVerificacaoVinculadaAoTelegram(
    telegramChatId: string,
    telegramUsuarioId: string,
  ): Promise<VerificacaoTelefone | null>;
  vincularTelegramNaVerificacao(
    id: string,
    telegramChatId: string,
    telegramUsuarioId: string,
  ): Promise<void>;
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
  revogarRefreshToken(id: string, quando: Date): Promise<void>;
  revogarRefreshTokensDoUsuario(id: string, quando: Date): Promise<void>;
}
