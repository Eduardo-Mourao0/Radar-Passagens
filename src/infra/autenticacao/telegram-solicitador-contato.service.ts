import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { SolicitadorContatoTelegram } from '../../application/autenticacao/ports/solicitador-contato-telegram.port';

@Injectable()
export class TelegramSolicitadorContatoService implements SolicitadorContatoTelegram {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async solicitarContato(chatId: string): Promise<void> {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    await firstValueFrom(
      this.httpService
        .post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: chatId,
          text: 'Para confirmar seu cadastro, toque em “Compartilhar meu número”.',
          reply_markup: {
            keyboard: [
              [
                {
                  text: 'Compartilhar meu número',
                  request_contact: true,
                },
              ],
            ],
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        })
        .pipe(timeout(10_000)),
    );
  }
}
