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
    telefoneVerificadoEm: Date;
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

  async buscarVerificacaoVinculadaAoTelegram(
    telegramChatId: string,
    telegramUsuarioId: string,
  ): Promise<VerificacaoTelefone | null> {
    const verificacao = await this.prisma.verificacaoTelefone.findFirst({
      where: {
        telegramChatId,
        telegramUsuarioId,
        verificadaEm: null,
        consumidaEm: null,
      },
      orderBy: { criadoEm: 'desc' },
    });
    return verificacao ? this.mapearVerificacao(verificacao) : null;
  }

  async vincularTelegramNaVerificacao(
    id: string,
    telegramChatId: string,
    telegramUsuarioId: string,
  ): Promise<boolean> {
    const resultado = await this.prisma.verificacaoTelefone.updateMany({
      where: {
        id,
        telegramChatId: null,
        telegramUsuarioId: null,
        consumidaEm: null,
        verificadaEm: null,
        expiraEm: { gt: new Date() },
      },
      data: { telegramChatId, telegramUsuarioId },
    });
    return resultado.count === 1;
  }

  async finalizarVerificacaoTelegram(dados: {
    verificacaoId: string;
    telefone: string;
    chatId: string;
    telegramUsuarioId: string;
    quando: Date;
  }): Promise<'VERIFICADA' | 'INDISPONIVEL' | 'TELEFONE_JA_CADASTRADO'> {
    try {
      return await this.prisma.$transaction(async (transacao) => {
        const verificacao = await transacao.verificacaoTelefone.findFirst({
          where: {
            id: dados.verificacaoId,
            telefone: dados.telefone,
            telegramChatId: dados.chatId,
            telegramUsuarioId: dados.telegramUsuarioId,
            consumidaEm: null,
            verificadaEm: null,
            expiraEm: { gt: dados.quando },
          },
        });
        if (!verificacao) return 'INDISPONIVEL';

        if (verificacao.finalidade === 'CADASTRO') {
          if (!verificacao.senhaHash) return 'INDISPONIVEL';
          await transacao.usuario.create({
            data: {
              telefone: verificacao.telefone,
              senhaHash: verificacao.senhaHash,
              telegramChatId: dados.chatId,
              telefoneVerificadoEm: dados.quando,
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
      telefoneVerificadoEm: usuario.telefoneVerificadoEm,
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
