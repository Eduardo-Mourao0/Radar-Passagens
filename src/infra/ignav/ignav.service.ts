import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
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
          price: z
            .object({
              amount: z.number().finite().positive(),
              currency: z.literal('BRL'),
              status: z.enum(['verified', 'unverified']),
            })
            .nullable()
            .optional(),
          url: z.string().trim().min(1),
        }),
      ),
    }),
  ),
});

type TipoFalhaConsulta = 'rede' | 'resposta_invalida' | 'inesperada';

/**
 * Adaptador da Ignav que normaliza tarifas para o contrato da aplicação.
 */
@Injectable()
export class IgnavService implements ConsultarPrecosVoo {
  private static readonly CONCORRENCIA_MAXIMA_LINKS = 3;

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
        this.registrarFalhaConsulta('resposta_invalida');
        throw new ServiceUnavailableException(
          MENSAGENS_ERRO.ignavConsultaIndisponivel,
        );
      }

      const ofertasVerificadas = resultado.data.itineraries
        .filter(
          (oferta) =>
            oferta.price.status === 'verified' && oferta.ignav_id !== undefined,
        )
        .sort(
          (ofertaA, ofertaB) => ofertaA.price.amount - ofertaB.price.amount,
        );
      const ofertasPendentes = [...ofertasVerificadas];
      const cotacoes = await Promise.all(
        Array.from(
          {
            length: Math.min(
              IgnavService.CONCORRENCIA_MAXIMA_LINKS,
              ofertasPendentes.length,
            ),
          },
          async () => {
            const cotacoesDoTrabalhador: CotacaoDeVoo[] = [];

            while (ofertasPendentes.length > 0) {
              const oferta = ofertasPendentes.shift();
              if (!oferta) break;

              const links = await this.obterLinksCompra(oferta.ignav_id!);
              const menorLink = links.reduce<LinkCompra | null>(
                (menor, link) =>
                  !menor || Number(link.preco) < Number(menor.preco)
                    ? link
                    : menor,
                null,
              );

              if (!menorLink) continue;

              cotacoesDoTrabalhador.push({
                preco: menorLink.preco,
                moeda: menorLink.moeda,
                ignavId: oferta.ignav_id!,
                companhia: menorLink.fornecedor,
              });
            }

            return cotacoesDoTrabalhador;
          },
        ),
      );

      return cotacoes
        .flat()
        .reduce<CotacaoDeVoo | null>(
          (menor, cotacao) =>
            !menor || Number(cotacao.preco) < Number(menor.preco)
              ? cotacao
              : menor,
          null,
        );
    } catch (erro: unknown) {
      if (erro instanceof ServiceUnavailableException) {
        throw erro;
      }

      this.registrarFalhaConsulta(this.identificarTipoFalha(erro));
      throw new ServiceUnavailableException(
        MENSAGENS_ERRO.ignavConsultaIndisponivel,
      );
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
        this.registrarFalhaConsulta('resposta_invalida');
        throw new ServiceUnavailableException(
          MENSAGENS_ERRO.ignavConsultaIndisponivel,
        );
      }
      const links = resultado.data.booking_options.flatMap((opcao) =>
        opcao.links.flatMap((link) => {
          if (
            link.provider_type !== 'airline' ||
            !link.price ||
            link.price.status !== 'verified'
          ) {
            return [];
          }

          return [
            {
              fornecedor: link.provider_name,
              tipoFornecedor: link.provider_type,
              preco: link.price.amount.toFixed(2),
              moeda: link.price.currency,
              url: link.url,
            },
          ];
        }),
      );
      if (links.length === 0) {
        this.logger.warn(
          JSON.stringify({ evento: 'ignav_link_compra_indisponivel' }),
        );
        return [];
      }
      return links;
    } catch (erro: unknown) {
      if (erro instanceof ServiceUnavailableException) throw erro;
      this.registrarFalhaConsulta(this.identificarTipoFalha(erro));
      throw new ServiceUnavailableException(
        MENSAGENS_ERRO.ignavConsultaIndisponivel,
      );
    }
  }

  private registrarFalhaConsulta(tipo: TipoFalhaConsulta): void {
    this.logger.error(
      JSON.stringify({
        evento: 'ignav_consulta_preco_falhou',
        tipo,
      }),
    );
  }

  private identificarTipoFalha(erro: unknown): TipoFalhaConsulta {
    if (
      typeof erro === 'object' &&
      erro !== null &&
      'isAxiosError' in erro &&
      erro.isAxiosError === true
    ) {
      return 'rede';
    }

    return 'inesperada';
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
  }
}
