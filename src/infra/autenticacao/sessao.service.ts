import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import * as argon2 from 'argon2';
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Usuario } from '../../domain/usuarios/entities/usuario.entity';
import { USUARIOS_REPOSITORY } from '../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../domain/usuarios/repositories/usuarios.repository';

type TokenAcessoPayload = { sub: string; tipo: 'acesso'; exp: number };
type TokenRedefinicaoPayload = {
  sub: string;
  verificacaoId: string;
  tipo: 'redefinicao-pin';
  exp: number;
};
type JwtPayload = TokenAcessoPayload | TokenRedefinicaoPayload;
type DadosJwt =
  Omit<TokenAcessoPayload, 'exp'> | Omit<TokenRedefinicaoPayload, 'exp'>;

export type SessaoCriada = Readonly<{
  accessToken: string;
  refreshToken: string;
  expiraEm: Date;
}>;

@Injectable()
export class SessaoService {
  private static readonly DIAS_REFRESH = 30;
  private static readonly UUID_SCHEMA = z.uuid();
  private readonly logger = new Logger(SessaoService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
  ) {}

  async criar(usuario: Usuario): Promise<SessaoCriada> {
    const segredo = randomBytes(48).toString('base64url');
    const expiraEm = new Date(
      Date.now() + SessaoService.DIAS_REFRESH * 24 * 60 * 60 * 1000,
    );
    const refresh = await this.usuariosRepository.criarRefreshToken({
      usuarioId: usuario.id,
      tokenHash: await argon2.hash(segredo, { type: argon2.argon2id }),
      expiraEm,
    });

    return {
      accessToken: this.gerarJwt(
        { sub: usuario.id, tipo: 'acesso' },
        this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        15 * 60,
      ),
      refreshToken: `${refresh.id}.${segredo}`,
      expiraEm,
    };
  }

  async renovar(refreshToken: string): Promise<SessaoCriada> {
    const [id, segredo] = refreshToken.split('.', 2);
    if (!id || !segredo) throw new UnauthorizedException();
    const refresh = await this.usuariosRepository.buscarRefreshTokenPorId(id);
    const agora = new Date();
    if (!refresh || refresh.expiraEm <= agora)
      throw new UnauthorizedException();

    const segredoValido = await argon2.verify(refresh.tokenHash, segredo);
    if (!segredoValido) throw new UnauthorizedException();

    if (refresh.revogadoEm) {
      await this.usuariosRepository.revogarRefreshTokensDoUsuario(
        refresh.usuarioId,
        agora,
      );
      this.registrarReutilizacao(refresh.usuarioId, refresh.id);
      throw new UnauthorizedException();
    }
    const usuario = await this.usuariosRepository.buscarPorId(
      refresh.usuarioId,
    );
    if (!usuario) throw new UnauthorizedException();

    const consumido = await this.usuariosRepository.consumirRefreshToken(
      refresh.id,
      agora,
    );
    if (!consumido) {
      await this.usuariosRepository.revogarRefreshTokensDoUsuario(
        refresh.usuarioId,
        agora,
      );
      this.registrarReutilizacao(refresh.usuarioId, refresh.id);
      throw new UnauthorizedException();
    }

    return this.criar(usuario);
  }

  async encerrar(refreshToken: string | undefined): Promise<void> {
    const [id] = refreshToken?.split('.', 1) ?? [];
    if (id) await this.usuariosRepository.revogarRefreshToken(id, new Date());
  }

  gerarTokenRedefinicao(usuarioId: string, verificacaoId: string): string {
    return this.gerarJwt(
      { sub: usuarioId, verificacaoId, tipo: 'redefinicao-pin' },
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      10 * 60,
    );
  }

  validarTokenRedefinicao(token: string): TokenRedefinicaoPayload {
    const payload = this.validarJwt(
      token,
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    );
    if (payload.tipo !== 'redefinicao-pin') throw new UnauthorizedException();
    return payload;
  }

  validarAccessToken(token: string): TokenAcessoPayload {
    const payload = this.validarJwt(
      token,
      this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    );
    if (payload.tipo !== 'acesso') throw new UnauthorizedException();
    return payload;
  }

  private gerarJwt(
    dados: DadosJwt,
    segredo: string,
    duracaoSegundos: number,
  ): string {
    const cabecalho = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        ...dados,
        exp: Math.floor(Date.now() / 1000) + duracaoSegundos,
      }),
    ).toString('base64url');
    const assinatura = createHmac('sha256', segredo)
      .update(`${cabecalho}.${payload}`)
      .digest('base64url');
    return `${cabecalho}.${payload}.${assinatura}`;
  }

  private validarJwt(token: string, segredo: string): JwtPayload {
    try {
      const [cabecalho, payloadCodificado, assinatura] = token.split('.');
      if (!cabecalho || !payloadCodificado || !assinatura) {
        throw new UnauthorizedException();
      }
      const assinaturaEsperada = createHmac('sha256', segredo)
        .update(`${cabecalho}.${payloadCodificado}`)
        .digest('base64url');
      if (
        assinatura.length !== assinaturaEsperada.length ||
        !timingSafeEqual(
          Buffer.from(assinatura),
          Buffer.from(assinaturaEsperada),
        )
      ) {
        throw new UnauthorizedException();
      }
      const payload: unknown = JSON.parse(
        Buffer.from(payloadCodificado, 'base64url').toString('utf8'),
      );
      if (
        !this.ePayloadJwtValido(payload) ||
        payload.exp <= Date.now() / 1000
      ) {
        throw new UnauthorizedException();
      }
      return payload;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private ePayloadJwtValido(payload: unknown): payload is JwtPayload {
    if (!payload || typeof payload !== 'object') return false;
    const candidato = payload as Record<string, unknown>;
    return (
      typeof candidato.sub === 'string' &&
      SessaoService.UUID_SCHEMA.safeParse(candidato.sub).success &&
      typeof candidato.exp === 'number' &&
      (candidato.tipo === 'acesso' ||
        (candidato.tipo === 'redefinicao-pin' &&
          typeof candidato.verificacaoId === 'string'))
    );
  }

  private registrarReutilizacao(
    usuarioId: string,
    refreshTokenId: string,
  ): void {
    this.logger.warn(
      JSON.stringify({
        evento: 'reutilizacao_refresh_token_detectada',
        usuarioId,
        refreshTokenId,
      }),
    );
  }
}
