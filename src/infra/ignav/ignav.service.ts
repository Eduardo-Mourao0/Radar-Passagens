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
        this.httpService.post<unknown>(
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
        ).pipe(timeout(10_000)),
      );

      const resultado = respostaIgnavSchema.safeParse(resposta.data);
      if (!resultado.success) {
        this.registrarFalhaConsulta('resposta_invalida');
        throw new ServiceUnavailableException(
          MENSAGENS_ERRO.ignavConsultaIndisponivel,
        );
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
    if (!ignavId.trim()) {
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
        throw new ServiceUnavailableException(MENSAGENS_ERRO.ignavConsultaIndisponivel);
      }
      const links = resultado.data.booking_options.flatMap((opcao) =>
        opcao.links.map((link) => ({
          fornecedor: link.provider_name,
          tipoFornecedor: link.provider_type,
          url: link.url,
        })),
      );
      if (links.length === 0) return [];
      return links;
    } catch (erro: unknown) {
      if (erro instanceof ServiceUnavailableException) throw erro;
      this.registrarFalhaConsulta(this.identificarTipoFalha(erro));
      throw new ServiceUnavailableException(MENSAGENS_ERRO.ignavConsultaIndisponivel);
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
