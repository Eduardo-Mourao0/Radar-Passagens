import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { TelegramMensageiroService } from './telegram-mensageiro.service';

describe('TelegramMensageiroService', () => {
  it('envia o código sem solicitar o compartilhamento de contato', async () => {
    const post = jest.fn().mockReturnValue(of({ data: { ok: true } }));
    const service = new TelegramMensageiroService(
      { post } as unknown as HttpService,
      {
        getOrThrow: jest.fn(() => 'token-secreto'),
      } as unknown as ConfigService,
    );

    await service.enviarMensagem(
      '123456',
      'Seu código de verificação é: 123456',
    );

    expect(post).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken-secreto/sendMessage',
      {
        chat_id: '123456',
        text: 'Seu código de verificação é: 123456',
      },
    );
  });

  it('falha quando o Telegram rejeita a mensagem', async () => {
    const service = new TelegramMensageiroService(
      {
        post: jest.fn().mockReturnValue(of({ data: { ok: false } })),
      } as unknown as HttpService,
      {
        getOrThrow: jest.fn(() => 'token-secreto'),
      } as unknown as ConfigService,
    );

    await expect(service.enviarMensagem('123456', 'mensagem')).rejects.toThrow(
      'Telegram rejeitou o envio da mensagem.',
    );
  });
});
