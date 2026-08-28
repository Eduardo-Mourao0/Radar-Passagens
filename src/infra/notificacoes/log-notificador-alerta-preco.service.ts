import { Injectable, Logger } from '@nestjs/common';
import {
  NotificacaoAlertaPreco,
  NotificadorAlertaPreco,
} from '../../application/rotas/ports/notificador-alerta-preco.port';

/** Notificador temporário até a escolha de um canal externo. */
@Injectable()
export class LogNotificadorAlertaPrecoService implements NotificadorAlertaPreco {
  private readonly logger = new Logger(LogNotificadorAlertaPrecoService.name);

  enviar(notificacao: NotificacaoAlertaPreco): Promise<void> {
    this.logger.warn(
      JSON.stringify({
        evento: 'alerta_preco_disparado',
        rotaId: notificacao.rota.id,
        origem: notificacao.rota.origem,
        destino: notificacao.rota.destino,
        preco: notificacao.historico.preco,
        moeda: notificacao.historico.moeda,
        precoAlvo: notificacao.alerta.precoAlvo,
      }),
    );

    return Promise.resolve();
  }
}
