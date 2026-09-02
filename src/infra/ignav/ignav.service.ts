import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { z } from 'zod';
import {
  ConsultarPrecosVoo,
  CotacaoDeVoo,
  LinkCompra,
} from '../../application/rotas/ports/consultar-precos-voo.port';
import { MENSAGENS_ERRO } from '../../domain/errors/mensagens-erro';
import { Rota } from '../../domain/rotas/entities/rota.entity';

const respostaIgnavSchema = z.object({
  itineraries: z.array(
    z.object({
      price: z.object({
        amount: z.number().finite().positive(),
        currency: z.literal('BRL'),
        status: z.enum(['verified', 'unverified']),
      }),
      ignav_id: z.string().trim().min(1).optional(),
      outbound: z.object({
        carrier: z.string().trim().min(1).optional(),
        segments: z
          .array(
            z.object({
              operating_carrier_name: z.string().trim().min(1).nullable(),
              marketing_carrier_code: z.string().trim().min(1).nullable(),
            }),
          )
          .min(1),
      }),
    }),
  ),
});

const respostaLinksCompraSchema = z.object({
  booking_options: z.array(
    z.object({
      links: z.array(
        z.object({
          provider_name: z.string().trim().min(1),
          provider_type: z.enum(['airline', 'third_party']),
          url: z.string().trim().min(1),
        }),
      ),
    }),
  ),
});

type OperacaoIgnav = 'consultar_precos' | 'obter_links_compra';
type TipoFalhaConsulta =
  | 'tempo_esgotado'
  | 'limite_consultas'
  | 'cotacao_expirada'
  | 'indisponivel'
  | 'rede'
  | 'resposta_invalida'
  | 'inesperada';

/**
 * Adaptador da Ignav que normaliza tarifas para o contrato da aplicação.
 */
@Injectable()
export class IgnavService implements ConsultarPrecosVoo {
  private readonly logger = new Logger(IgnavService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async consultarMenorPreco(rota: Rota): Promise<CotacaoDeVoo | null> {
    const apiKey = this.configService.getOrThrow<string>('IGNAV_API_KEY');
    const baseUrl = this.configService.getOrThrow<string>('IGNAV_BASE_URL');
    const dataIda = this.formatarData(rota.dataIda);
    const dataVolta = rota.dataVolta ? this.formatarData(rota.dataVolta) : null;

    try {
      const resposta = await firstValueFrom(
        this.httpService
          .post<unknown>(
            `${baseUrl.replace(/\/$/, '')}/fares/${
              dataVolta ? 'round-trip' : 'one-way'
            }`,
            {
              origin: rota.origem,
              destination: rota.destino,
              departure_date: dataIda,
              ...(dataVolta ? { return_date: dataVolta } : {}),
              adults: 1,
              market: 'BR',
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey,
              },
            },
          )
          .pipe(timeout(10_000)),
      );

      const resultado = respostaIgnavSchema.safeParse(resposta.data);
      if (!resultado.success) {
        this.lancarFalhaConsulta('resposta_invalida', 'consultar_precos');
      }

      const menorOferta = resultado.data.itineraries.reduce(
        (menor, oferta) => {
          if (oferta.price.status !== 'verified') {
            return menor;
          }

          return !menor || oferta.price.amount < menor.price.amount
            ? oferta
            : menor;
        },
        undefined as (typeof resultado.data.itineraries)[number] | undefined,
      );

      if (!menorOferta) {
        return null;
      }

      const companhiaIdentificada = this.identificarCompanhia(menorOferta);
      if (!companhiaIdentificada) {
        this.logger.warn(
          JSON.stringify({
            evento: 'ignav_companhia_nao_identificada',
          }),
        );
      }

      return {
        preco: menorOferta.price.amount.toFixed(2),
        moeda: menorOferta.price.currency,
        ...(menorOferta.ignav_id ? { ignavId: menorOferta.ignav_id } : {}),
        companhia: companhiaIdentificada ?? 'Companhia não identificada',
      };
    } catch (erro: unknown) {
      if (erro instanceof HttpException) {
        throw erro;
      }

      this.lancarFalhaDaIgnav(erro, 'consultar_precos');
    }
  }

  async obterLinksCompra(ignavId: string): Promise<LinkCompra[]> {
    if (typeof ignavId !== 'string' || !ignavId.trim()) {
      throw new BadRequestException('ignavId nao pode ser vazio.');
    }
    const apiKey = this.configService.getOrThrow<string>('IGNAV_API_KEY');
    const baseUrl = this.configService.getOrThrow<string>('IGNAV_BASE_URL');
    try {
      const resposta = await firstValueFrom(
        this.httpService
          .post<unknown>(
            `${baseUrl.replace(/\/$/, '')}/fares/booking-links`,
            { ignav_id: ignavId },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey,
              },
            },
          )
          .pipe(timeout(10_000)),
      );
      const resultado = respostaLinksCompraSchema.safeParse(resposta.data);
      if (!resultado.success) {
        this.lancarFalhaConsulta('resposta_invalida', 'obter_links_compra');
      }
      const links = resultado.data.booking_options.flatMap((opcao) =>
        opcao.links.map((link) => ({
          fornecedor: link.provider_name,
          tipoFornecedor: link.provider_type,
          url: link.url,
        })),
      );
      if (links.length === 0) {
        this.logger.warn(
          JSON.stringify({ evento: 'ignav_link_compra_indisponivel' }),
        );
        return [];
      }
      return links;
    } catch (erro: unknown) {
      if (erro instanceof HttpException) throw erro;
      this.lancarFalhaDaIgnav(erro, 'obter_links_compra');
    }
  }

  private lancarFalhaDaIgnav(erro: unknown, operacao: OperacaoIgnav): never {
    const { tipo, statusHttp } = this.classificarFalhaConsulta(erro, operacao);
    this.lancarFalhaConsulta(tipo, operacao, statusHttp);
  }

  private lancarFalhaConsulta(
    tipo: TipoFalhaConsulta,
    operacao: OperacaoIgnav,
    statusHttp?: number,
  ): never {
    this.registrarFalhaConsulta(tipo, operacao, statusHttp);

    if (tipo === 'cotacao_expirada') {
      throw new NotFoundException(MENSAGENS_ERRO.ignavCotacaoExpirada);
    }
    if (tipo === 'limite_consultas') {
      throw new HttpException(
        MENSAGENS_ERRO.ignavLimiteConsultas,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (tipo === 'tempo_esgotado') {
      throw new ServiceUnavailableException(MENSAGENS_ERRO.ignavTempoEsgotado);
    }
    if (tipo === 'rede') {
      throw new ServiceUnavailableException(
        MENSAGENS_ERRO.ignavConexaoIndisponivel,
      );
    }
    if (tipo === 'resposta_invalida') {
      throw new ServiceUnavailableException(
        MENSAGENS_ERRO.ignavRespostaInvalida,
      );
    }

    throw new ServiceUnavailableException(
      MENSAGENS_ERRO.ignavConsultaIndisponivel,
    );
  }

  private registrarFalhaConsulta(
    tipo: TipoFalhaConsulta,
    operacao: OperacaoIgnav,
    statusHttp?: number,
  ): void {
    this.logger.error(
      JSON.stringify({
        evento: 'ignav_consulta_preco_falhou',
        tipo,
        operacao,
        ...(statusHttp ? { statusHttp } : {}),
      }),
    );
  }

  private classificarFalhaConsulta(
    erro: unknown,
    operacao: OperacaoIgnav,
  ): Readonly<{ tipo: TipoFalhaConsulta; statusHttp?: number }> {
    if (erro instanceof TimeoutError) {
      return { tipo: 'tempo_esgotado' };
    }

    if (
      typeof erro === 'object' &&
      erro !== null &&
      'isAxiosError' in erro &&
      erro.isAxiosError === true
    ) {
      const erroAxios = erro as {
        code?: unknown;
        response?: { status?: unknown };
      };
      const statusHttp = erroAxios.response?.status;

      if (erroAxios.code === 'ECONNABORTED' || erroAxios.code === 'ETIMEDOUT') {
        return { tipo: 'tempo_esgotado' };
      }
      if (statusHttp === HttpStatus.REQUEST_TIMEOUT) {
        return { tipo: 'tempo_esgotado', statusHttp };
      }
      if (operacao === 'obter_links_compra' && statusHttp === 404) {
        return { tipo: 'cotacao_expirada', statusHttp };
      }
      if (statusHttp === 429) {
        return { tipo: 'limite_consultas', statusHttp };
      }
      if (typeof statusHttp === 'number' && statusHttp >= 500) {
        return { tipo: 'indisponivel', statusHttp };
      }
      if (typeof statusHttp === 'number') {
        return { tipo: 'inesperada', statusHttp };
      }

      return { tipo: 'rede' };
    }

    return { tipo: 'inesperada' };
  }

  private identificarCompanhia(
    oferta: z.infer<typeof respostaIgnavSchema>['itineraries'][number],
  ): string | null {
    if (oferta.outbound.carrier) {
      return oferta.outbound.carrier;
    }

    const segmentoComCompanhia = oferta.outbound.segments.find(
      (segmento) =>
        segmento.operating_carrier_name || segmento.marketing_carrier_code,
    );

    return (
      segmentoComCompanhia?.operating_carrier_name ??
      segmentoComCompanhia?.marketing_carrier_code ??
      null
    );
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
  }
}
