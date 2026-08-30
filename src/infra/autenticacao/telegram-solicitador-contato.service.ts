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
    await this.enviar(
      chatId,
      'Para confirmar seu cadastro, toque em “Compartilhar meu número”.',
      {
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
    );
  }

  async enviarMensagem(chatId: string, mensagem: string): Promise<void> {
    await this.enviar(chatId, mensagem);
  }

  private async enviar(
    chatId: string,
    text: string,
    replyMarkup?: Record<string, unknown>,
  ): Promise<void> {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    await firstValueFrom(
      this.httpService
        .post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: chatId,
          text,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        })
        .pipe(timeout(10_000)),
    );
  }
}
