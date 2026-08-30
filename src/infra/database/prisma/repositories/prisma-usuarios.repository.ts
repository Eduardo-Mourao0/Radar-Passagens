import {
  RefreshToken as PrismaRefreshToken,
  Usuario as PrismaUsuario,
  VerificacaoTelefone as PrismaVerificacaoTelefone,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
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
  ): Promise<void> {
    await this.prisma.verificacaoTelefone.update({
      where: { id },
      data: { telegramChatId, telegramUsuarioId },
    });
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
