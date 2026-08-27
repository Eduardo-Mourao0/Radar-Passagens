import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { MENSAGENS_ERRO } from '../../domain/errors/mensagens-erro';

type RespostaTokenAmadeus = Readonly<{
  access_token: string;
  expires_in: number;
}>;

type TokenEmCache = Readonly<{
  accessToken: string;
  expiraEm: number;
}>;

/**
 * Fronteira de infraestrutura para autenticação e consultas à API Amadeus.
 */
@Injectable()
export class AmadeusService {
  private static readonly MARGEM_EXPIRACAO_MS = 60_000;

  private tokenEmCache: TokenEmCache | null = null;
  private tokenEmAtualizacao: Promise<string> | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async obterToken(): Promise<string> {
    if (this.tokenAindaValido()) {
      return this.tokenEmCache!.accessToken;
    }

    if (!this.tokenEmAtualizacao) {
      this.tokenEmAtualizacao = this.solicitarToken();
    }

    try {
      return await this.tokenEmAtualizacao;
    } finally {
      this.tokenEmAtualizacao = null;
    }
  }

  private tokenAindaValido(): boolean {
    return (
      this.tokenEmCache !== null &&
      this.tokenEmCache.expiraEm - Date.now() >
        AmadeusService.MARGEM_EXPIRACAO_MS
    );
  }

  private async solicitarToken(): Promise<string> {
    const clientId = this.configService.getOrThrow<string>('AMADEUS_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>(
      'AMADEUS_CLIENT_SECRET',
    );
    const baseUrl = this.configService.getOrThrow<string>('AMADEUS_BASE_URL');
    const corpo = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    try {
      const resposta = await firstValueFrom(
        this.httpService.post<RespostaTokenAmadeus>(
          `${baseUrl.replace(/\/$/, '')}/v1/security/oauth2/token`,
          corpo.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      if (
        !resposta.data.access_token ||
        !Number.isFinite(resposta.data.expires_in) ||
        resposta.data.expires_in <= 0
      ) {
        throw new ServiceUnavailableException(
          MENSAGENS_ERRO.amadeusAutenticacaoIndisponivel,
        );
      }

      this.tokenEmCache = {
        accessToken: resposta.data.access_token,
        expiraEm: Date.now() + resposta.data.expires_in * 1_000,
      };

      return this.tokenEmCache.accessToken;
    } catch (erro) {
      if (erro instanceof ServiceUnavailableException) {
        throw erro;
      }

      throw new ServiceUnavailableException(
        MENSAGENS_ERRO.amadeusAutenticacaoIndisponivel,
      );
    }
  }
}
