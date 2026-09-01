/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { IgnavService } from './ignav.service';

const rota = {
  id: 'rota-1',
  chaveMonitoramento: 'GRU:REC:2026-09-10:SOMENTE_IDA',
  origem: 'GRU',
  destino: 'REC',
  dataIda: new Date(2026, 8, 10),
  dataVolta: null,
  ativa: true,
  criadoEm: new Date(2026, 0, 1),
} as const;

const configService = {
  getOrThrow: jest.fn((chave: string) => {
    const configuracoes: Record<string, string> = {
      IGNAV_API_KEY: 'ignav-api-key',
      IGNAV_BASE_URL: 'https://ignav.com/api',
    };

    return configuracoes[chave];
  }),
} as unknown as ConfigService;

function criarHttpService(
  respostaTarifas: unknown,
  respostasLinks: Record<string, unknown>,
): HttpService {
  return {
    post: jest.fn((url: string, corpo: { ignav_id?: string }) => {
      if (url.endsWith('/booking-links')) {
        return of({ data: respostasLinks[corpo.ignav_id ?? ''] });
      }

      return of({ data: respostaTarifas });
    }),
  } as unknown as HttpService;
}

function respostaLinks(links: unknown[]) {
  return { booking_options: [{ links }] };
}

describe('IgnavService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persiste o menor preço verificado entre os sites oficiais', async () => {
    const httpService = criarHttpService(
      {
        itineraries: [
          {
            ignav_id: 'ignav-gol',
            price: { amount: 380, currency: 'BRL', status: 'verified' },
            outbound: {
              segments: [
                {
                  operating_carrier_name: 'GOL',
                  marketing_carrier_code: 'G3',
                },
              ],
            },
          },
          {
            ignav_id: 'ignav-azul',
            price: { amount: 450, currency: 'BRL', status: 'verified' },
            outbound: {
              segments: [
                {
                  operating_carrier_name: 'Azul',
                  marketing_carrier_code: 'AD',
                },
              ],
            },
          },
        ],
      },
      {
        'ignav-gol': respostaLinks([
          {
            provider_name: 'Decolar',
            provider_type: 'third_party',
            price: { amount: 380, currency: 'BRL', status: 'verified' },
            url: 'https://www.decolar.com',
          },
          {
            provider_name: 'GOL',
            provider_type: 'airline',
            price: { amount: 430, currency: 'BRL', status: 'verified' },
            url: 'https://www.voegol.com.br',
          },
        ]),
        'ignav-azul': respostaLinks([
          {
            provider_name: 'Azul',
            provider_type: 'airline',
            price: { amount: 410, currency: 'BRL', status: 'verified' },
            url: 'https://www.voeazul.com.br',
          },
        ]),
      },
    );
    const service = new IgnavService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).resolves.toEqual({
      preco: '410.00',
      moeda: 'BRL',
      ignavId: 'ignav-azul',
      companhia: 'Azul',
    });
  });

  it('consulta ida e volta pelo endpoint específico', async () => {
    const httpService = criarHttpService({ itineraries: [] }, {});
    const service = new IgnavService(httpService, configService);

    await service.consultarMenorPreco({
      ...rota,
      dataVolta: new Date(2026, 8, 20),
    });

    expect(httpService.post).toHaveBeenCalledWith(
      'https://ignav.com/api/fares/round-trip',
      expect.objectContaining({ return_date: '2026-09-20' }),
      expect.any(Object),
    );
  });

  it('retorna null quando não há tarifa oficial verificada', async () => {
    const httpService = criarHttpService(
      {
        itineraries: [
          {
            ignav_id: 'ignav-1',
            price: { amount: 250, currency: 'BRL', status: 'verified' },
            outbound: {
              segments: [
                {
                  operating_carrier_name: 'Azul',
                  marketing_carrier_code: 'AD',
                },
              ],
            },
          },
        ],
      },
      {
        'ignav-1': respostaLinks([
          {
            provider_name: 'Decolar',
            provider_type: 'third_party',
            price: { amount: 250, currency: 'BRL', status: 'verified' },
            url: 'https://www.decolar.com',
          },
        ]),
      },
    );
    const service = new IgnavService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).resolves.toBeNull();
  });

  it('ignora tarifas de busca não verificadas', async () => {
    const httpService = criarHttpService(
      {
        itineraries: [
          {
            ignav_id: 'ignav-1',
            price: { amount: 250, currency: 'BRL', status: 'unverified' },
            outbound: {
              segments: [
                {
                  operating_carrier_name: 'Azul',
                  marketing_carrier_code: 'AD',
                },
              ],
            },
          },
        ],
      },
      {},
    );
    const service = new IgnavService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).resolves.toBeNull();
    expect(httpService.post).toHaveBeenCalledTimes(1);
  });

  it('retorna somente links oficiais com preço verificado', async () => {
    const httpService = criarHttpService(undefined, {
      'ignav-1': respostaLinks([
        {
          provider_name: 'Decolar',
          provider_type: 'third_party',
          price: { amount: 420, currency: 'BRL', status: 'verified' },
          url: 'https://www.decolar.com',
        },
        {
          provider_name: 'GOL',
          provider_type: 'airline',
          price: { amount: 450, currency: 'BRL', status: 'verified' },
          url: 'https://www.voegol.com.br',
        },
        {
          provider_name: 'LATAM',
          provider_type: 'airline',
          price: null,
          url: 'https://www.latamairlines.com',
        },
      ]),
    });
    const service = new IgnavService(httpService, configService);

    await expect(service.obterLinksCompra('ignav-1')).resolves.toEqual([
      {
        fornecedor: 'GOL',
        tipoFornecedor: 'airline',
        preco: '450.00',
        moeda: 'BRL',
        url: 'https://www.voegol.com.br',
      },
    ]);
  });

  it('não expõe a chave de API quando a consulta falha', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(throwError(() => new Error('timeout ignav-api-key'))),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);

    const erro = await service
      .consultarMenorPreco(rota)
      .catch((erro: unknown) => erro);

    expect(erro).toBeInstanceOf(ServiceUnavailableException);
    expect(
      JSON.stringify((erro as ServiceUnavailableException).getResponse()),
    ).not.toContain('ignav-api-key');
  });

  it('rejeita respostas malformadas da Ignav', async () => {
    const httpService = criarHttpService({ itineraries: null }, {});
    const service = new IgnavService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
