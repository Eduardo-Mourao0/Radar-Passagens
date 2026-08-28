import {
  AlertaPreco,
  HistoricoPreco,
  Rota,
} from '../../../domain/rotas/entities/rota.entity';

export const NOTIFICADOR_ALERTA_PRECO = Symbol('NOTIFICADOR_ALERTA_PRECO');

export type NotificacaoAlertaPreco = Readonly<{
  alerta: AlertaPreco;
  rota: Rota;
  historico: HistoricoPreco;
}>;

export interface NotificadorAlertaPreco {
  enviar(notificacao: NotificacaoAlertaPreco): Promise<void>;
}
