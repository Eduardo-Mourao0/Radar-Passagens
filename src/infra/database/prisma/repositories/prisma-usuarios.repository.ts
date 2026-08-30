import {
  RefreshToken as PrismaRefreshToken,
  Usuario as PrismaUsuario,
  VerificacaoTelefone as PrismaVerificacaoTelefone,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FinalidadeVerificacaoTelefone,
  RefreshToken,
  Usuario,
  VerificacaoTelefone,
} from '../../../../domain/usuarios/entities/usuario.entity';
import { UsuariosRepository } from '../../../../domain/usuarios/repositories/usuarios.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaUsuariosRepository implements UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorId(id: string): Promise<Usuario | null> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    return usuario ? this.mapearUsuario(usuario) : null;
  }

  async buscarPorIds(ids: readonly string[]): Promise<Usuario[]> {
    if (ids.length === 0) return [];

    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: [...ids] } },
    });
    return usuarios.map((usuario) => this.mapearUsuario(usuario));
  }

  async buscarPorTelefone(telefone: string): Promise<Usuario | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { telefone },
    });
    return usuario ? this.mapearUsuario(usuario) : null;
  }

  async criar(dados: {
    telefone: string;
    senhaHash: string;
    telegramChatId: string;
    verificadoEm: Date;
  }): Promise<Usuario> {
    const usuario = await this.prisma.usuario.create({ data: dados });
    return this.mapearUsuario(usuario);
  }

  async atualizarSenha(id: string, senhaHash: string): Promise<void> {
    await this.prisma.usuario.update({ where: { id }, data: { senhaHash } });
  }

  async atualizarTentativasLogin(
    id: string,
    tentativasLoginFalhas: number,
    bloqueadoAte: Date | null,
  ): Promise<void> {
    await this.prisma.usuario.update({
      where: { id },
      data: { tentativasLoginFalhas, bloqueadoAte },
    });
  }

  async criarVerificacao(dados: {
    telefone: string;
    finalidade: FinalidadeVerificacaoTelefone;
    senhaHash?: string;
    tokenInicio: string;
    expiraEm: Date;
  }): Promise<VerificacaoTelefone> {
    const verificacao = await this.prisma.verificacaoTelefone.create({
      data: {
        ...dados,
        finalidade: dados.finalidade,
      },
    });
    return this.mapearVerificacao(verificacao);
  }

  async buscarVerificacaoPorId(
    id: string,
  ): Promise<VerificacaoTelefone | null> {
    const verificacao = await this.prisma.verificacaoTelefone.findUnique({
      where: { id },
    });
    return verificacao ? this.mapearVerificacao(verificacao) : null;
  }

  async buscarVerificacaoPorTokenInicio(
    tokenInicio: string,
  ): Promise<VerificacaoTelefone | null> {
    const verificacao = await this.prisma.verificacaoTelefone.findUnique({
      where: { tokenInicio },
    });
    return verificacao ? this.mapearVerificacao(verificacao) : null;
  }

  async prepararCodigoTelegram(dados: {
    verificacaoId: string;
    telegramChatId: string;
    telegramUsuarioId: string;
    codigoHash: string;
    quando: Date;
  }): Promise<boolean> {
    const reenvioPermitidoEm = new Date(dados.quando.getTime() - 60_000);

    // The conditional update atomically reserves the code for this Telegram identity.
    const resultado = await this.prisma.verificacaoTelefone.updateMany({
      where: {
        id: dados.verificacaoId,
        consumidaEm: null,
        verificadaEm: null,
        expiraEm: { gt: dados.quando },
        AND: [
          {
            OR: [
              { telegramChatId: null },
              { telegramChatId: dados.telegramChatId },
            ],
          },
          {
            OR: [
              { telegramUsuarioId: null },
              { telegramUsuarioId: dados.telegramUsuarioId },
            ],
          },
          {
            OR: [
              { codigoEnviadoEm: null },
              {
                codigoEnviadoEm: {
                  lte: reenvioPermitidoEm,
                },
              },
            ],
          },
        ],
      },
      data: {
        telegramChatId: dados.telegramChatId,
        telegramUsuarioId: dados.telegramUsuarioId,
        codigoHash: dados.codigoHash,
        codigoEnviadoEm: dados.quando,
        tentativasCodigo: 0,
      },
    });
    return resultado.count === 1;
  }

  async cancelarCodigoTelegram(
    verificacaoId: string,
    codigoHash: string,
  ): Promise<void> {
    await this.prisma.verificacaoTelefone.updateMany({
      where: {
        id: verificacaoId,
        codigoHash,
        consumidaEm: null,
        verificadaEm: null,
      },
      data: {
        codigoHash: null,
        codigoEnviadoEm: null,
        tentativasCodigo: 0,
      },
    });
  }

  async incrementarTentativasCodigo(
    id: string,
    quando: Date,
    maximoTentativas: number,
  ): Promise<boolean> {
    const resultado = await this.prisma.verificacaoTelefone.updateMany({
      where: {
        id,
        consumidaEm: null,
        verificadaEm: null,
        expiraEm: { gt: quando },
        tentativasCodigo: { lt: maximoTentativas },
      },
      data: { tentativasCodigo: { increment: 1 } },
    });
    return resultado.count === 1;
  }

  async finalizarVerificacaoPorCodigo(dados: {
    verificacaoId: string;
    codigoHash: string;
    quando: Date;
  }): Promise<'VERIFICADA' | 'INDISPONIVEL' | 'TELEFONE_JA_CADASTRADO'> {
    try {
      return await this.prisma.$transaction(async (transacao) => {
        const verificacao = await transacao.verificacaoTelefone.findFirst({
          where: {
            id: dados.verificacaoId,
            codigoHash: dados.codigoHash,
            telegramChatId: { not: null },
            telegramUsuarioId: { not: null },
            consumidaEm: null,
            verificadaEm: null,
            expiraEm: { gt: dados.quando },
          },
        });
        if (!verificacao || !verificacao.telegramChatId) return 'INDISPONIVEL';

        if (verificacao.finalidade === 'CADASTRO') {
          if (!verificacao.senhaHash) return 'INDISPONIVEL';
          await transacao.usuario.create({
            data: {
              telefone: verificacao.telefone,
              senhaHash: verificacao.senhaHash,
              telegramChatId: verificacao.telegramChatId,
              verificadoEm: dados.quando,
            },
          });
        }

        await transacao.verificacaoTelefone.update({
          where: { id: verificacao.id },
          data: { verificadaEm: dados.quando },
        });
        return 'VERIFICADA';
      });
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        return 'TELEFONE_JA_CADASTRADO';
      }
      throw erro;
    }
  }

  async marcarVerificacaoComoVerificada(
    id: string,
    quando: Date,
  ): Promise<void> {
    await this.prisma.verificacaoTelefone.update({
      where: { id },
      data: { verificadaEm: quando },
    });
  }

  async consumirVerificacao(id: string, quando: Date): Promise<void> {
    await this.prisma.verificacaoTelefone.update({
      where: { id },
      data: { consumidaEm: quando },
    });
  }

  async contarVerificacoesRecentes(
    telefone: string,
    finalidade: FinalidadeVerificacaoTelefone,
    desde: Date,
  ): Promise<number> {
    return this.prisma.verificacaoTelefone.count({
      where: {
        telefone,
        finalidade,
        criadoEm: { gte: desde },
      },
    });
  }

  async criarRefreshToken(dados: {
    usuarioId: string;
    tokenHash: string;
    expiraEm: Date;
  }): Promise<RefreshToken> {
    const refreshToken = await this.prisma.refreshToken.create({ data: dados });
    return this.mapearRefreshToken(refreshToken);
  }

  async buscarRefreshTokenPorId(id: string): Promise<RefreshToken | null> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { id },
    });
    return refreshToken ? this.mapearRefreshToken(refreshToken) : null;
  }

  async consumirRefreshToken(id: string, quando: Date): Promise<boolean> {
    const resultado = await this.prisma.refreshToken.updateMany({
      where: { id, revogadoEm: null, expiraEm: { gt: quando } },
      data: { revogadoEm: quando },
    });
    return resultado.count === 1;
  }

  async revogarRefreshToken(id: string, quando: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revogadoEm: null },
      data: { revogadoEm: quando },
    });
  }

  async revogarRefreshTokensDoUsuario(id: string, quando: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId: id, revogadoEm: null },
      data: { revogadoEm: quando },
    });
  }

  private mapearUsuario(usuario: PrismaUsuario): Usuario {
    return {
      id: usuario.id,
      telefone: usuario.telefone,
      senhaHash: usuario.senhaHash,
      telegramChatId: usuario.telegramChatId,
      verificadoEm: usuario.verificadoEm,
      tentativasLoginFalhas: usuario.tentativasLoginFalhas,
      bloqueadoAte: usuario.bloqueadoAte,
    };
  }

  private mapearVerificacao(
    verificacao: PrismaVerificacaoTelefone,
  ): VerificacaoTelefone {
    return {
      id: verificacao.id,
      telefone: verificacao.telefone,
      finalidade: verificacao.finalidade,
      senhaHash: verificacao.senhaHash,
      tokenInicio: verificacao.tokenInicio,
      telegramChatId: verificacao.telegramChatId,
      telegramUsuarioId: verificacao.telegramUsuarioId,
      codigoHash: verificacao.codigoHash,
      tentativasCodigo: verificacao.tentativasCodigo,
      codigoEnviadoEm: verificacao.codigoEnviadoEm,
      verificadaEm: verificacao.verificadaEm,
      consumidaEm: verificacao.consumidaEm,
      expiraEm: verificacao.expiraEm,
      criadoEm: verificacao.criadoEm,
    };
  }

  private mapearRefreshToken(token: PrismaRefreshToken): RefreshToken {
    return {
      id: token.id,
      usuarioId: token.usuarioId,
      tokenHash: token.tokenHash,
      expiraEm: token.expiraEm,
      revogadoEm: token.revogadoEm,
    };
  }
}
