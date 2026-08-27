/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AmadeusService } from './amadeus.service';

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

describe('AmadeusService', () => {
  const configService = {
    getOrThrow: jest.fn((chave: string) => {
      const configuracoes: Record<string, string> = {
        AMADEUS_CLIENT_ID: 'client-id',
        AMADEUS_CLIENT_SECRET: 'client-secret',
        AMADEUS_BASE_URL: 'https://test.api.amadeus.com',
      };

      return configuracoes[chave];
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('solicita e armazena o token da Amadeus', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(
          of({ data: { access_token: 'token-1', expires_in: 1_800 } }),
        ),
    } as unknown as HttpService;
    const service = new AmadeusService(httpService, configService);

    await expect(service.obterToken()).resolves.toBe('token-1');
    await expect(service.obterToken()).resolves.toBe('token-1');
    expect(httpService.post).toHaveBeenCalledTimes(1);
    expect(httpService.post).toHaveBeenCalledWith(
      'https://test.api.amadeus.com/v1/security/oauth2/token',
      'grant_type=client_credentials&client_id=client-id&client_secret=client-secret',
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
  });

  it('renova o token quando falta menos de um minuto para expirar', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValueOnce(
          of({ data: { access_token: 'token-1', expires_in: 60 } }),
        )
        .mockReturnValueOnce(
          of({ data: { access_token: 'token-2', expires_in: 1_800 } }),
        ),
    } as unknown as HttpService;
    const service = new AmadeusService(httpService, configService);

    await expect(service.obterToken()).resolves.toBe('token-1');
    await expect(service.obterToken()).resolves.toBe('token-2');
    expect(httpService.post).toHaveBeenCalledTimes(2);
  });

  it('compartilha a solicitação de token entre chamadas simultâneas', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(
          of({ data: { access_token: 'token-1', expires_in: 1_800 } }),
        ),
    } as unknown as HttpService;
    const service = new AmadeusService(httpService, configService);

    await expect(
      Promise.all([service.obterToken(), service.obterToken()]),
    ).resolves.toEqual(['token-1', 'token-1']);
    expect(httpService.post).toHaveBeenCalledTimes(1);
  });

  it('não expõe credenciais quando a autenticação externa falha', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(
          throwError(() => new Error('timeout client-id client-secret')),
        ),
    } as unknown as HttpService;
    const service = new AmadeusService(httpService, configService);
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const erro = await service.obterToken().catch((erro: unknown) => erro);

    expect(erro).toBeInstanceOf(ServiceUnavailableException);
    expect(
      JSON.stringify((erro as ServiceUnavailableException).getResponse()),
    ).not.toContain('client-id');
    expect(
      JSON.stringify((erro as ServiceUnavailableException).getResponse()),
    ).not.toContain('client-secret');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('client-id');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('client-secret');
    errorLog.mockRestore();
  });

  it.each([
    ['token vazio', { access_token: '   ', expires_in: 1_800 }],
    ['token não textual', { access_token: 123, expires_in: 1_800 }],
    ['expiração zero', { access_token: 'token-1', expires_in: 0 }],
    ['expiração negativa', { access_token: 'token-1', expires_in: -1 }],
    ['campos obrigatórios ausentes', {}],
    ['dados nulos', null],
  ])('rejeita resposta com %s', async (_, resposta) => {
    const httpService = {
      post: jest.fn().mockReturnValue(of({ data: resposta })),
    } as unknown as HttpService;
    const service = new AmadeusService(httpService, configService);
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(service.obterToken()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    errorLog.mockRestore();
  });

  it('consulta e normaliza a menor oferta de voo', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(
          of({ data: { access_token: 'token-1', expires_in: 1_800 } }),
        ),
      get: jest.fn().mockReturnValue(
        of({
          data: {
            data: [
              {
                price: { total: '450.50', currency: 'BRL' },
                itineraries: [{ segments: [{ carrierCode: 'AD' }] }],
              },
              {
                price: { total: '380.00', currency: 'BRL' },
                itineraries: [{ segments: [{ carrierCode: 'G3' }] }],
              },
            ],
            dictionaries: { carriers: { AD: 'Azul', G3: 'GOL' } },
          },
        }),
      ),
    } as unknown as HttpService;
    const service = new AmadeusService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).resolves.toEqual({
      preco: '380.00',
      moeda: 'BRL',
      companhia: 'GOL',
    });
    expect(httpService.get).toHaveBeenCalledWith(
      'https://test.api.amadeus.com/v2/shopping/flight-offers',
      {
        headers: { Authorization: 'Bearer token-1' },
        params: {
          originLocationCode: 'GRU',
          destinationLocationCode: 'REC',
          departureDate: '2026-09-10',
          adults: 1,
          max: 10,
          currencyCode: 'BRL',
        },
      },
    );
  });

  it('retorna null quando a Amadeus não encontra ofertas', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(
          of({ data: { access_token: 'token-1', expires_in: 1_800 } }),
        ),
      get: jest.fn().mockReturnValue(of({ data: { data: [] } })),
    } as unknown as HttpService;
    const service = new AmadeusService(httpService, configService);

    await expect(service.consultarMenorPreco(rota)).resolves.toBeNull();
  });

  it('rejeita uma resposta de ofertas malformada', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(
          of({ data: { access_token: 'token-1', expires_in: 1_800 } }),
        ),
      get: jest.fn().mockReturnValue(of({ data: { data: null } })),
    } as unknown as HttpService;
    const service = new AmadeusService(httpService, configService);
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(service.consultarMenorPreco(rota)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    errorLog.mockRestore();
  });
});
