import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { MensageiroTelegram } from '../../application/autenticacao/ports/mensageiro-telegram.port';

type RespostaTelegram = Readonly<{ ok?: boolean }>;

class RespostaTelegramInvalidaError extends Error {
  constructor() {
    super('Telegram rejeitou o envio da mensagem.');
  }
}

@Injectable()
export class TelegramMensageiroService implements MensageiroTelegram {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async enviarMensagem(chatId: string, mensagem: string): Promise<void> {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const resposta = await firstValueFrom(
      this.httpService
        .post<RespostaTelegram>(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            chat_id: chatId,
            text: mensagem,
          },
        )
        .pipe(timeout(10_000)),
    );
    if (resposta.data?.ok !== true) throw new RespostaTelegramInvalidaError();
  }
}
