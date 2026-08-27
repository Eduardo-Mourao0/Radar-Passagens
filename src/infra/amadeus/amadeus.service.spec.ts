import { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AmadeusService } from './amadeus.service';

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

  it('não expõe detalhes quando a autenticação externa falha', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(throwError(() => new Error('timeout'))),
    } as unknown as HttpService;
    const service = new AmadeusService(httpService, configService);

    await expect(service.obterToken()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
