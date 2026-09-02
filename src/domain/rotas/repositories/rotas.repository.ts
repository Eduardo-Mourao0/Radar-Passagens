import {
  AlertaPreco,
  HistoricoPreco,
  NovoAlertaPreco,
  NovaRota,
  NovoHistoricoPreco,
  Rota,
  RotaComAlerta,
} from '../entities/rota.entity';

export const ROTAS_REPOSITORY = Symbol('ROTAS_REPOSITORY');

export interface RotasRepository {
  buscarPorChave(
    usuarioId: string,
    chaveMonitoramento: string,
  ): Promise<Rota | null>;
  criar(dados: NovaRota): Promise<Rota>;
  reativar(id: string, usuarioId: string): Promise<Rota>;
  desativar(id: string, usuarioId: string): Promise<Rota>;
  excluir(id: string, usuarioId: string): Promise<void>;
  listar(usuarioId: string): Promise<RotaComAlerta[]>;
  listarAtivas(): Promise<Rota[]>;
  desativarRotasComDataIdaPassada(dataReferencia: Date): Promise<number>;
  buscarPorId(id: string, usuarioId: string): Promise<Rota | null>;
  listarHistorico(rotaId: string, usuarioId: string): Promise<HistoricoPreco[]>;
  buscarAlertaPreco(rotaId: string): Promise<AlertaPreco | null>;
  salvarAlertaPreco(dados: NovoAlertaPreco): Promise<AlertaPreco>;
  atualizarAlertaDisparado(id: string, disparado: boolean): Promise<void>;
  registrarHistorico(dados: NovoHistoricoPreco): Promise<HistoricoPreco>;
}
