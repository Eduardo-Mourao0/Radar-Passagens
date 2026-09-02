/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { MENSAGENS_ERRO } from '../../domain/errors/mensagens-erro';
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

function criarErroAxios(statusHttp?: number, code?: string) {
  return {
    isAxiosError: true,
    ...(code ? { code } : {}),
    ...(statusHttp ? { response: { status: statusHttp } } : {}),
  };
}

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

  it('mantém a tarifa com uma companhia genérica quando a resposta não a identifica', async () => {
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
                      operating_carrier_name: null,
                      marketing_carrier_code: null,
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
    const warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expect(service.consultarMenorPreco(rota)).resolves.toEqual({
      preco: '350.00',
      moeda: 'BRL',
      companhia: 'Companhia não identificada',
    });
    expect(warnLog).toHaveBeenCalledWith(
      JSON.stringify({ evento: 'ignav_companhia_nao_identificada' }),
    );
    warnLog.mockRestore();
  });

  it.each([
    [
      'uma cotação expirada',
      criarErroAxios(HttpStatus.NOT_FOUND),
      HttpStatus.NOT_FOUND,
      MENSAGENS_ERRO.ignavCotacaoExpirada,
    ],
    [
      'rate limit da Ignav',
      criarErroAxios(HttpStatus.TOO_MANY_REQUESTS),
      HttpStatus.TOO_MANY_REQUESTS,
      MENSAGENS_ERRO.ignavLimiteConsultas,
    ],
    [
      'timeout de conexão',
      criarErroAxios(undefined, 'ETIMEDOUT'),
      HttpStatus.SERVICE_UNAVAILABLE,
      MENSAGENS_ERRO.ignavTempoEsgotado,
    ],
    [
      'timeout retornado pela Ignav',
      criarErroAxios(HttpStatus.REQUEST_TIMEOUT),
      HttpStatus.SERVICE_UNAVAILABLE,
      MENSAGENS_ERRO.ignavTempoEsgotado,
    ],
  ])(
    'retorna uma mensagem específica quando a Ignav informa %s',
    async (_, erroAxios, statusEsperado, mensagemEsperada) => {
      const httpService = {
        post: jest.fn().mockReturnValue(throwError(() => erroAxios)),
      } as unknown as HttpService;
      const service = new IgnavService(httpService, configService);

      const erro = await service
        .obterLinksCompra('ignav-1')
        .catch((erro: unknown) => erro);

      expect(erro).toBeInstanceOf(HttpException);
      expect((erro as HttpException).getStatus()).toBe(statusEsperado);
      const resposta = (erro as HttpException).getResponse();
      expect(typeof resposta === 'string' ? resposta : resposta.message).toBe(
        mensagemEsperada,
      );
    },
  );

  it('informa quando a Ignav retorna dados inválidos para os links', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(of({ data: { booking_options: null } })),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);

    const erro = await service
      .obterLinksCompra('ignav-1')
      .catch((erro: unknown) => erro);

    expect(erro).toBeInstanceOf(ServiceUnavailableException);
    expect((erro as HttpException).getResponse()).toMatchObject({
      message: MENSAGENS_ERRO.ignavRespostaInvalida,
    });
  });

  it('registra o endpoint, tipo e status da falha sem dados sensíveis', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(
          throwError(() => criarErroAxios(HttpStatus.TOO_MANY_REQUESTS)),
        ),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await service.obterLinksCompra('ignav-1').catch(() => undefined);

    expect(errorLog).toHaveBeenCalledWith(
      JSON.stringify({
        evento: 'ignav_consulta_preco_falhou',
        tipo: 'limite_consultas',
        operacao: 'obter_links_compra',
        statusHttp: HttpStatus.TOO_MANY_REQUESTS,
      }),
    );
    errorLog.mockRestore();
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

  it('registra falhas inesperadas sem classificá-las como rede', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(throwError(() => new Error('falha inesperada'))),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(service.consultarMenorPreco(rota)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(errorLog).toHaveBeenCalledWith(
      JSON.stringify({
        evento: 'ignav_consulta_preco_falhou',
        tipo: 'inesperada',
        operacao: 'consultar_precos',
      }),
    );
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
