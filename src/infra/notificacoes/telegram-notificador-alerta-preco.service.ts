import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { z } from 'zod';
import {
  NotificacaoAlertaPreco,
  NotificadorAlertaPreco,
} from '../../application/rotas/ports/notificador-alerta-preco.port';

const respostaTelegramSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    error_code: z.number().int().optional(),
    description: z.string().optional(),
  }),
]);
const chatIdSchema = z.string().regex(/^-?\d{1,19}$/);

type TipoFalhaTelegram =
  'configuracao_invalida' | 'rede' | 'resposta_invalida' | 'resposta_rejeitada';

class RespostaTelegramInvalidaError extends Error {
  constructor(
    readonly tipo: Exclude<TipoFalhaTelegram, 'rede'>,
    readonly codigo?: number,
  ) {
    super(tipo);
  }
}

class ConfiguracaoTelegramInvalidaError extends Error {}

/** Adaptador da API oficial do Telegram para alertas de preço. */
@Injectable()
export class TelegramNotificadorAlertaPrecoService implements NotificadorAlertaPreco {
  private static readonly FORMATADOR_PRECO = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  private static readonly TIMEOUT_ENVIO_MS = 10_000;

  private readonly logger = new Logger(
    TelegramNotificadorAlertaPrecoService.name,
  );

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async enviar(notificacao: NotificacaoAlertaPreco): Promise<boolean> {
    try {
      const token = this.obterToken();
      const chatId = chatIdSchema.parse(notificacao.telegramChatId);
      const urlEnvio = `https://api.telegram.org/bot${token}/sendMessage`;
      const resposta = await firstValueFrom(
        this.httpService
          .post<unknown>(urlEnvio, {
            chat_id: chatId,
            text: this.montarMensagem(notificacao),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          })
          .pipe(
            timeout(TelegramNotificadorAlertaPrecoService.TIMEOUT_ENVIO_MS),
          ),
      );
      const resultado = respostaTelegramSchema.safeParse(resposta?.data);

      if (!resultado.success) {
        throw new RespostaTelegramInvalidaError('resposta_invalida');
      }

      if (!resultado.data.ok) {
        throw new RespostaTelegramInvalidaError(
          'resposta_rejeitada',
          resultado.data.error_code,
        );
      }

      return true;
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
      return false;
    }
  }

  private montarMensagem(notificacao: NotificacaoAlertaPreco): string {
    const { rota, alerta, historico, detalhesVoo } = notificacao;
    const horarioIda = detalhesVoo?.horarioIda
      ? `Ida: ${this.formatarHorario(detalhesVoo.horarioIda)}`
      : null;
    const horarioVolta = detalhesVoo?.horarioVolta
      ? `Volta: ${this.formatarHorario(detalhesVoo.horarioVolta)}`
      : null;
    const urlCompra = this.obterUrlCompra(detalhesVoo?.urlCompra);

    return [
      '<b>ALERTA DE PRECO</b>',
      '',
      `<b>${this.escaparHtml(rota.origem)} -> ${this.escaparHtml(rota.destino)}</b>`,
      this.escaparHtml(historico.companhia),
      ...(horarioIda || horarioVolta ? ['', horarioIda, horarioVolta] : []),
      '',
      `<b>Preco encontrado:</b> ${this.formatarPreco(historico.preco)}`,
      `<b>Sua meta:</b> ${this.formatarPreco(alerta.precoAlvo)}`,
      ...(urlCompra
        ? ['', `<a href="${this.escaparHtml(urlCompra)}">VER PASSAGEM</a>`]
        : []),
    ]
      .filter((linha): linha is string => linha !== null)
      .join('\n');
  }

  private formatarHorario(horario: string): string {
    const resultado = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(horario);
    if (!resultado) return this.escaparHtml(horario);

    const [, ano, mes, dia, hora] = resultado;
    const meses = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ];
    const mesFormatado = meses[Number(mes) - 1] ?? mes;

    return `${dia} ${mesFormatado} ${ano}, ${hora}`;
  }

  private obterUrlCompra(url?: string): string | null {
    if (!url) return null;

    try {
      const urlCompra = new URL(url);
      return ['http:', 'https:'].includes(urlCompra.protocol)
        ? urlCompra.toString()
        : null;
    } catch {
      return null;
    }
  }

  private escaparHtml(valor: string): string {
    return valor.replace(/[&<>"']/g, (caractere) => {
      const caracteresEscapados: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };

      return caracteresEscapados[caractere];
    });
  }

  private formatarPreco(preco: string): string {
    return TelegramNotificadorAlertaPrecoService.FORMATADOR_PRECO.format(
      Number(preco),
    );
  }

  private identificarFalha(erro: unknown): {
    tipo: TipoFalhaTelegram;
    codigo?: number;
  } {
    if (erro instanceof RespostaTelegramInvalidaError) {
      return { tipo: erro.tipo, codigo: erro.codigo };
    }

    if (erro instanceof ConfiguracaoTelegramInvalidaError) {
      return { tipo: 'configuracao_invalida' };
    }

    return { tipo: 'rede' };
  }

  private obterToken(): string {
    try {
      return this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    } catch {
      throw new ConfiguracaoTelegramInvalidaError();
    }
  }
}
