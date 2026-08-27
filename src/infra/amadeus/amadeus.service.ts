import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import {
  ConsultarPrecosVoo,
  CotacaoDeVoo,
} from '../../application/rotas/ports/consultar-precos-voo.port';
import { MENSAGENS_ERRO } from '../../domain/errors/mensagens-erro';
import { Rota } from '../../domain/rotas/entities/rota.entity';

const respostaTokenAmadeusSchema = z.object({
  access_token: z.string().trim().min(1),
  expires_in: z.number().finite().positive(),
});

const respostaOfertasAmadeusSchema = z.object({
  data: z.array(
    z.object({
      price: z.object({
        total: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
        currency: z.string().length(3),
      }),
      itineraries: z
        .array(
          z.object({
            segments: z
              .array(z.object({ carrierCode: z.string().min(1) }))
              .min(1),
          }),
        )
        .min(1),
    }),
  ),
  dictionaries: z
    .object({
      carriers: z.record(z.string(), z.string()),
    })
    .optional(),
});

type TokenEmCache = Readonly<{
  accessToken: string;
  expiraEm: number;
}>;

/**
 * Fronteira de infraestrutura para autenticação e consultas à API Amadeus.
 */
@Injectable()
export class AmadeusService implements ConsultarPrecosVoo {
  private static readonly MARGEM_EXPIRACAO_MS = 60_000;

  private readonly logger = new Logger(AmadeusService.name);
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

  async consultarMenorPreco(rota: Rota): Promise<CotacaoDeVoo | null> {
    const token = await this.obterToken();
    const baseUrl = this.configService.getOrThrow<string>('AMADEUS_BASE_URL');

    try {
      const resposta = await firstValueFrom(
        this.httpService.get<unknown>(
          `${baseUrl.replace(/\/$/, '')}/v2/shopping/flight-offers`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              originLocationCode: rota.origem,
              destinationLocationCode: rota.destino,
              departureDate: this.formatarData(rota.dataIda),
              ...(rota.dataVolta
                ? { returnDate: this.formatarData(rota.dataVolta) }
                : {}),
              adults: 1,
              max: 10,
              currencyCode: 'BRL',
            },
          },
        ),
      );

      const ofertas = respostaOfertasAmadeusSchema.safeParse(resposta.data);
      if (!ofertas.success) {
        this.registrarFalhaConsulta('resposta_invalida');
        throw new ServiceUnavailableException(
          MENSAGENS_ERRO.amadeusConsultaIndisponivel,
        );
      }

      const menorOferta = ofertas.data.data.reduce(
        (menor, oferta) =>
          !menor || Number(oferta.price.total) < Number(menor.price.total)
            ? oferta
            : menor,
        undefined as (typeof ofertas.data.data)[number] | undefined,
      );

      if (!menorOferta) {
        return null;
      }

      const codigoCompanhia =
        menorOferta.itineraries[0].segments[0].carrierCode;
      const companhia = ofertas.data.dictionaries?.carriers?.[codigoCompanhia];

      if (!companhia) {
        this.logger.warn(
          JSON.stringify({
            evento: 'amadeus_companhia_nao_encontrada',
            codigoCompanhia,
          }),
        );
      }

      return {
        preco: menorOferta.price.total,
        moeda: menorOferta.price.currency,
        companhia: companhia ?? codigoCompanhia,
      };
    } catch (erro) {
      if (erro instanceof ServiceUnavailableException) {
        throw erro;
      }

      this.registrarFalhaConsulta('rede');
      throw new ServiceUnavailableException(
        MENSAGENS_ERRO.amadeusConsultaIndisponivel,
      );
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
        this.httpService.post<unknown>(
          `${baseUrl.replace(/\/$/, '')}/v1/security/oauth2/token`,
          corpo.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      const token = respostaTokenAmadeusSchema.safeParse(resposta.data);
      if (!token.success) {
        this.registrarFalhaAutenticacao('resposta_invalida');
        throw new ServiceUnavailableException(
          MENSAGENS_ERRO.amadeusAutenticacaoIndisponivel,
        );
      }

      this.tokenEmCache = {
        accessToken: token.data.access_token,
        expiraEm: Date.now() + token.data.expires_in * 1_000,
      };

      return this.tokenEmCache.accessToken;
    } catch (erro) {
      if (erro instanceof ServiceUnavailableException) {
        throw erro;
      }

      this.registrarFalhaAutenticacao('rede');
      throw new ServiceUnavailableException(
        MENSAGENS_ERRO.amadeusAutenticacaoIndisponivel,
      );
    }
  }

  private registrarFalhaAutenticacao(tipo: 'rede' | 'resposta_invalida'): void {
    this.logger.error(
      JSON.stringify({
        evento: 'amadeus_oauth2_falhou',
        tipo,
      }),
    );
  }

  private registrarFalhaConsulta(tipo: 'rede' | 'resposta_invalida'): void {
    this.logger.error(
      JSON.stringify({
        evento: 'amadeus_consulta_preco_falhou',
        tipo,
      }),
    );
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
  }
}
