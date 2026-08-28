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

const respostaTelegramSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    error_code: z.number().int().optional(),
    description: z.string().optional(),
  }),
]);

type TipoFalhaTelegram = 'rede' | 'resposta_invalida' | 'resposta_rejeitada';

class RespostaTelegramInvalidaError extends Error {
  constructor(
    readonly tipo: Exclude<TipoFalhaTelegram, 'rede'>,
    readonly codigo?: number,
  ) {
    super(tipo);
  }
}

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
    const urlEnvio = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
      const resposta = await firstValueFrom(
        this.httpService.post<unknown>(urlEnvio, {
          chat_id: chatId,
          text: this.montarMensagem(notificacao),
        }),
      );
      const resultado = respostaTelegramSchema.safeParse(resposta.data);

      if (!resultado.success) {
        throw new RespostaTelegramInvalidaError('resposta_invalida');
      }

      if (!resultado.data.ok) {
        throw new RespostaTelegramInvalidaError(
          'resposta_rejeitada',
          resultado.data.error_code,
        );
      }
    } catch (erro: unknown) {
      const falha = this.identificarFalha(erro);

      this.logger.error(
        JSON.stringify({
          evento: 'telegram_notificacao_falhou',
          rotaId: notificacao.rota.id,
          tipo: falha.tipo,
          ...(falha.codigo ? { codigo: falha.codigo } : {}),
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

  private identificarFalha(erro: unknown): {
    tipo: TipoFalhaTelegram;
    codigo?: number;
  } {
    if (erro instanceof RespostaTelegramInvalidaError) {
      return { tipo: erro.tipo, codigo: erro.codigo };
    }

    return { tipo: 'rede' };
  }
}
