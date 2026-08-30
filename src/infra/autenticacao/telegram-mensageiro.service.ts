import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { MensageiroTelegram } from '../../application/autenticacao/ports/mensageiro-telegram.port';

@Injectable()
export class TelegramMensageiroService implements MensageiroTelegram {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async enviarMensagem(chatId: string, mensagem: string): Promise<void> {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    await firstValueFrom(
      this.httpService
        .post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: chatId,
          text: mensagem,
        })
        .pipe(timeout(10_000)),
    );
  }
}
