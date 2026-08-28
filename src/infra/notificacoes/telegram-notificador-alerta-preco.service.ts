import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import {
  NotificacaoAlertaPreco,
  NotificadorAlertaPreco,
} from '../../application/rotas/ports/notificador-alerta-preco.port';
import { MENSAGENS_ERRO } from '../../domain/errors/mensagens-erro';

const respostaTelegramSchema = z.object({
  ok: z.literal(true),
});

/** Adaptador da API oficial do Telegram para alertas de preço. */
@Injectable()
export class TelegramNotificadorAlertaPrecoService implements NotificadorAlertaPreco {
  private readonly logger = new Logger(
    TelegramNotificadorAlertaPrecoService.name,
  );

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async enviar(notificacao: NotificacaoAlertaPreco): Promise<void> {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.configService.getOrThrow<string>('TELEGRAM_CHAT_ID');

    try {
      const resposta = await firstValueFrom(
        this.httpService.post<unknown>(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            chat_id: chatId,
            text: this.montarMensagem(notificacao),
          },
        ),
      );

      if (!respostaTelegramSchema.safeParse(resposta.data).success) {
        throw new Error('Resposta inválida da API do Telegram.');
      }
    } catch {
      this.logger.error(
        JSON.stringify({
          evento: 'telegram_notificacao_falhou',
          rotaId: notificacao.rota.id,
        }),
      );
      throw new ServiceUnavailableException(
        MENSAGENS_ERRO.telegramNotificacaoIndisponivel,
      );
    }
  }

  private montarMensagem(notificacao: NotificacaoAlertaPreco): string {
    const { rota, alerta, historico } = notificacao;

    return [
      '⚠️ Alerta de preço',
      '',
      `${rota.origem} → ${rota.destino}`,
      `Preço encontrado: ${this.formatarPreco(historico.preco)}`,
      `Sua meta: ${this.formatarPreco(alerta.precoAlvo)}`,
      `Companhia: ${historico.companhia}`,
    ].join('\n');
  }

  private formatarPreco(preco: string): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(preco));
  }
}
