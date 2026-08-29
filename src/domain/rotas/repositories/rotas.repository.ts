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
  buscarPorChave(chaveMonitoramento: string): Promise<Rota | null>;
  criar(dados: NovaRota): Promise<Rota>;
  reativar(id: string): Promise<Rota>;
  desativar(id: string): Promise<Rota>;
  excluir(id: string): Promise<void>;
  listar(): Promise<RotaComAlerta[]>;
  listarAtivas(): Promise<Rota[]>;
  desativarRotasComDataIdaPassada(dataReferencia: Date): Promise<number>;
  buscarPorId(id: string): Promise<Rota | null>;
  listarHistorico(rotaId: string): Promise<HistoricoPreco[]>;
  buscarAlertaPreco(rotaId: string): Promise<AlertaPreco | null>;
  salvarAlertaPreco(dados: NovoAlertaPreco): Promise<AlertaPreco>;
  atualizarAlertaDisparado(id: string, disparado: boolean): Promise<void>;
  registrarHistoricoSeDiferente(
    dados: NovoHistoricoPreco,
  ): Promise<HistoricoPreco | null>;
}
