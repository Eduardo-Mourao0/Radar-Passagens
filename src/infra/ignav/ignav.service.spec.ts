/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
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

const respostaComOfertas = {
  itineraries: [
    {
      price: { amount: 450.5, currency: 'BRL', status: 'verified' },
      outbound: {
        carrier: 'Azul',
        segments: [
          {
            operating_carrier_name: 'Azul',
            marketing_carrier_code: 'AD',
          },
        ],
      },
    },
    {
      price: { amount: 380, currency: 'BRL', status: 'verified' },
      outbound: {
        carrier: 'GOL',
        segments: [
          {
            operating_carrier_name: 'GOL',
            marketing_carrier_code: 'G3',
          },
        ],
      },
    },
  ],
};

describe('IgnavService', () => {
  const configService = {
    getOrThrow: jest.fn((chave: string) => {
      const configuracoes: Record<string, string> = {
        IGNAV_API_KEY: 'ignav-api-key',
        IGNAV_BASE_URL: 'https://ignav.com/api',
      };

      return configuracoes[chave];
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('consulta uma rota só de ida e normaliza a menor tarifa verificada', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(of({ data: respostaComOfertas })),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).resolves.toEqual({
      preco: '380.00',
      moeda: 'BRL',
      companhia: 'GOL',
    });
    expect(httpService.post).toHaveBeenCalledWith(
      'https://ignav.com/api/fares/one-way',
      {
        origin: 'GRU',
        destination: 'REC',
        departure_date: '2026-09-10',
        adults: 1,
        market: 'BR',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': 'ignav-api-key',
        },
      },
    );
  });

  it('consulta ida e volta pelo endpoint específico', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(of({ data: respostaComOfertas })),
    } as unknown as HttpService;
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

  it('ignora tarifas não verificadas', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(
        of({
          data: {
            itineraries: [
              {
                price: { amount: 250, currency: 'BRL', status: 'unverified' },
                outbound: {
                  carrier: 'Azul',
                  segments: [
                    {
                      operating_carrier_name: 'Azul',
                      marketing_carrier_code: 'AD',
                    },
                  ],
                },
              },
              {
                price: { amount: 380, currency: 'BRL', status: 'verified' },
                outbound: {
                  carrier: 'GOL',
                  segments: [
                    {
                      operating_carrier_name: 'GOL',
                      marketing_carrier_code: 'G3',
                    },
                  ],
                },
              },
            ],
          },
        }),
      ),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).resolves.toEqual({
      preco: '380.00',
      moeda: 'BRL',
      companhia: 'GOL',
    });
  });

  it.each([
    ['nenhuma tarifa', { itineraries: [] }],
    [
      'apenas tarifa não verificada',
      {
        itineraries: [
          {
            price: { amount: 250, currency: 'BRL', status: 'unverified' },
            outbound: {
              carrier: 'Azul',
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
    ],
  ])('retorna null quando há %s', async (_, resposta) => {
    const httpService = {
      post: jest.fn().mockReturnValue(of({ data: resposta })),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).resolves.toBeNull();
  });

  it('usa a companhia do segmento quando o campo principal não é retornado', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(
        of({
          data: {
            itineraries: [
              {
                price: { amount: 350, currency: 'BRL', status: 'verified' },
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
        }),
      ),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).resolves.toEqual({
      preco: '350.00',
      moeda: 'BRL',
      companhia: 'Azul',
    });
  });

  it('não expõe a chave de API quando a consulta falha', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(throwError(() => new Error('timeout ignav-api-key'))),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const erro = await service
      .consultarMenorPreco(rota)
      .catch((erro: unknown) => erro);

    expect(erro).toBeInstanceOf(ServiceUnavailableException);
    expect(
      JSON.stringify((erro as ServiceUnavailableException).getResponse()),
    ).not.toContain('ignav-api-key');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('ignav-api-key');
    errorLog.mockRestore();
  });

  it('rejeita uma resposta malformada', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(of({ data: { itineraries: null } })),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(service.consultarMenorPreco(rota)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    errorLog.mockRestore();
  });
});
