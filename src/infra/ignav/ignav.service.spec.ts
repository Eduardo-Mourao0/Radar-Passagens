/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { defer, delay, finalize, of, tap, throwError } from 'rxjs';
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

function criarErroAxios(statusHttp?: unknown, code?: string) {
  return {
    isAxiosError: true,
    ...(code ? { code } : {}),
    ...(statusHttp ? { response: { status: statusHttp } } : {}),
  };
}

describe('IgnavService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persiste o menor preço verificado entre os sites oficiais', async () => {
    const rotaIdaEVolta = {
      ...rota,
      dataVolta: new Date(2026, 8, 20),
    };
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
                  departure_time_local: '2026-09-10T08:30:00',
                },
              ],
            },
            inbound: {
              segments: [
                {
                  departure_time: '2026-09-20T18:45:00',
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

    await expect(service.consultarMenorPreco(rotaIdaEVolta)).resolves.toEqual({
      preco: '410.00',
      moeda: 'BRL',
      ignavId: 'ignav-azul',
      companhia: 'Azul',
      horarioIda: '2026-09-10T08:30:00',
      horarioVolta: '2026-09-20T18:45:00',
      urlCompra: 'https://www.voeazul.com.br',
    });
  });

  it('limita a concorrência ao consultar links oficiais', async () => {
    let consultasEmAndamento = 0;
    let maiorConcorrencia = 0;
    const httpService = {
      post: jest.fn((url: string, corpo: { ignav_id?: string }) => {
        if (url.endsWith('/booking-links')) {
          return defer(() => {
            consultasEmAndamento += 1;
            maiorConcorrencia = Math.max(
              maiorConcorrencia,
              consultasEmAndamento,
            );

            return of({
              data: respostaLinks([
                {
                  provider_name: 'GOL',
                  provider_type: 'airline',
                  price: {
                    amount: 300,
                    currency: 'BRL',
                    status: 'verified',
                  },
                  url: `https://www.voegol.com.br/${corpo.ignav_id}`,
                },
              ]),
            }).pipe(
              delay(5),
              finalize(() => {
                consultasEmAndamento -= 1;
              }),
            );
          });
        }

        return of({
          data: {
            itineraries: Array.from({ length: 5 }, (_, indice) => ({
              ignav_id: `ignav-${indice}`,
              price: {
                amount: 300 + indice,
                currency: 'BRL',
                status: 'verified',
              },
              outbound: {
                segments: [
                  {
                    operating_carrier_name: 'GOL',
                    marketing_carrier_code: 'G3',
                  },
                ],
              },
            })),
          },
        });
      }),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);

    await service.consultarMenorPreco(rota);

    expect(maiorConcorrencia).toBe(3);
  });

  it('mantém as cotações oficiais quando outra consulta de link falha', async () => {
    let consultaConcluida = false;
    const httpService = {
      post: jest.fn((url: string, corpo: { ignav_id?: string }) => {
        if (url.endsWith('/booking-links')) {
          if (corpo.ignav_id === 'ignav-com-falha') {
            return throwError(() => criarErroAxios(HttpStatus.NOT_FOUND));
          }

          return of({
            data: respostaLinks([
              {
                provider_name: 'GOL',
                provider_type: 'airline',
                price: { amount: 300, currency: 'BRL', status: 'verified' },
                url: 'https://www.voegol.com.br',
              },
            ]),
          }).pipe(
            delay(5),
            tap(() => {
              consultaConcluida = true;
            }),
          );
        }

        return of({
          data: {
            itineraries: [
              {
                ignav_id: 'ignav-com-falha',
                price: { amount: 300, currency: 'BRL', status: 'verified' },
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
                ignav_id: 'ignav-valido',
                price: { amount: 310, currency: 'BRL', status: 'verified' },
                outbound: {
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
        });
      }),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).resolves.toMatchObject({
      preco: '300.00',
      ignavId: 'ignav-valido',
    });
    expect(consultaConcluida).toBe(true);
    expect(httpService.post).toHaveBeenCalledTimes(3);
    expect(httpService.post).toHaveBeenCalledWith(
      'https://ignav.com/api/fares/booking-links',
      { ignav_id: 'ignav-com-falha' },
      expect.any(Object),
    );
    expect(httpService.post).toHaveBeenCalledWith(
      'https://ignav.com/api/fares/booking-links',
      { ignav_id: 'ignav-valido' },
      expect.any(Object),
    );
  });

  it('repete links indisponíveis após 5 e 10 minutos', async () => {
    jest.useFakeTimers();
    const esperar = jest.spyOn(global, 'setTimeout');
    const httpService = {
      post: jest.fn((url: string) => {
        if (url.endsWith('/booking-links')) {
          return throwError(() => criarErroAxios(undefined, 'ETIMEDOUT'));
        }

        return of({
          data: {
            itineraries: [
              {
                ignav_id: 'ignav-indisponivel',
                price: { amount: 300, currency: 'BRL', status: 'verified' },
                outbound: {
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
        });
      }),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);

    try {
      const consulta = service.consultarMenorPreco(rota);
      await jest.advanceTimersByTimeAsync(15 * 60_000);

      await expect(consulta).resolves.toBeNull();
      expect(httpService.post).toHaveBeenCalledTimes(4);
      expect(esperar).toHaveBeenNthCalledWith(
        1,
        expect.any(Function),
        5 * 60_000,
      );
      expect(esperar).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        10 * 60_000,
      );
    } finally {
      esperar.mockRestore();
      jest.useRealTimers();
    }
  });

  it('não repete links quando a Ignav atinge o limite de requisições', async () => {
    const esperar = jest.spyOn(global, 'setTimeout');
    const httpService = {
      post: jest.fn((url: string) => {
        if (url.endsWith('/booking-links')) {
          return throwError(() => criarErroAxios(HttpStatus.TOO_MANY_REQUESTS));
        }

        return of({
          data: {
            itineraries: [
              {
                ignav_id: 'ignav-com-limite',
                price: { amount: 300, currency: 'BRL', status: 'verified' },
                outbound: {
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
        });
      }),
    } as unknown as HttpService;
    const service = new IgnavService(httpService, configService);

    try {
      const erro = await service
        .consultarMenorPreco(rota)
        .catch((erro: unknown) => erro);

      expect(erro).toBeInstanceOf(HttpException);
      expect((erro as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(httpService.post).toHaveBeenCalledTimes(2);
      expect(esperar).not.toHaveBeenCalled();
    } finally {
      esperar.mockRestore();
    }
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
        {
          provider_name: 'Azul',
          provider_type: 'airline',
          price: { amount: 430, currency: 'BRL', status: 'unverified' },
          url: 'https://www.voeazul.com.br',
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
    [
      'status HTTP inválido',
      criarErroAxios('429'),
      HttpStatus.SERVICE_UNAVAILABLE,
      MENSAGENS_ERRO.ignavRespostaInvalida,
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
