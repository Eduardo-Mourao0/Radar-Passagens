import {
  AlertaPreco,
  HistoricoPreco,
  Rota,
} from '../../../domain/rotas/entities/rota.entity';

export const NOTIFICADOR_ALERTA_PRECO = Symbol('NOTIFICADOR_ALERTA_PRECO');

export type DetalhesVooAlerta = Readonly<{
  horarioIda?: string;
  horarioVolta?: string;
  urlCompra?: string;
}>;

export type NotificacaoAlertaPreco = Readonly<{
  telegramChatId: string;
  alerta: AlertaPreco;
  rota: Rota;
  historico: Pick<HistoricoPreco, 'preco' | 'companhia'>;
  detalhesVoo?: DetalhesVooAlerta;
}>;

export interface NotificadorAlertaPreco {
  enviar(notificacao: NotificacaoAlertaPreco): Promise<boolean>;
}
