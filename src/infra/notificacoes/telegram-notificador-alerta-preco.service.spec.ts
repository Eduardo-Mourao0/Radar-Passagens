/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { TelegramNotificadorAlertaPrecoService } from './telegram-notificador-alerta-preco.service';

describe('TelegramNotificadorAlertaPrecoService', () => {
  const configService = {
    getOrThrow: jest.fn((chave: string) => {
      const configuracoes: Record<string, string> = {
        TELEGRAM_BOT_TOKEN: 'token-secreto',
      };

      return configuracoes[chave];
    }),
  } as unknown as ConfigService;
  const notificacao = {
    telegramChatId: '123456',
    rota: { id: 'rota-1', origem: 'BSB', destino: 'FOR' },
    alerta: { precoAlvo: '1500.00' },
    historico: { preco: '1400.00', companhia: 'Azul' },
  } as never;

  beforeEach(() => jest.clearAllMocks());

  it('envia uma mensagem com os dados do alerta', async () => {
    const post = jest.fn().mockReturnValue(of({ data: { ok: true } }));
    const httpService = {
      post,
    } as unknown as HttpService;
    const service = new TelegramNotificadorAlertaPrecoService(
      httpService,
      configService,
    );

    await expect(service.enviar(notificacao)).resolves.toBe(true);
    const [url, corpo] = post.mock.calls[0] as unknown as [
      string,
      { chat_id: string; text: string },
    ];

    expect(url).toBe('https://api.telegram.org/bottoken-secreto/sendMessage');
    expect(corpo.chat_id).toBe('123456');
    expect(corpo.text).toContain('BSB → FOR');
    expect(corpo.text).toContain('R$ 1.400,00');
  });

  it('não expõe o token quando o Telegram falha', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(throwError(() => new Error('token-secreto'))),
    } as unknown as HttpService;
    const service = new TelegramNotificadorAlertaPrecoService(
      httpService,
      configService,
    );
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(service.enviar(notificacao)).resolves.toBe(false);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('token-secreto');
    errorLog.mockRestore();
  });

  it('registra o código quando o Telegram rejeita a mensagem', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(
        of({
          data: {
            ok: false,
            error_code: 403,
            description: 'Forbidden: bot was blocked by the user',
          },
        }),
      ),
    } as unknown as HttpService;
    const service = new TelegramNotificadorAlertaPrecoService(
      httpService,
      configService,
    );
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(service.enviar(notificacao)).resolves.toBe(false);
    expect(errorLog).toHaveBeenCalledWith(
      JSON.stringify({
        evento: 'telegram_notificacao_falhou',
        rotaId: 'rota-1',
        tipo: 'resposta_rejeitada',
        codigo: 403,
      }),
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('Forbidden');
    errorLog.mockRestore();
  });

  it('rejeita chat_id fora do formato aceito pelo Telegram', async () => {
    const post = jest.fn();
    const httpService = { post } as unknown as HttpService;
    const configuracaoInvalida = configService;
    const service = new TelegramNotificadorAlertaPrecoService(
      httpService,
      configuracaoInvalida,
    );
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      service.enviar({ ...notificacao, telegramChatId: 'chat-invalido' }),
    ).resolves.toBe(false);
    expect(post).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
