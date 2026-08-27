import {
  HistoricoPreco,
  NovaRota,
  NovoHistoricoPreco,
  Rota,
} from '../entities/rota.entity';

export const ROTAS_REPOSITORY = Symbol('ROTAS_REPOSITORY');

export interface RotasRepository {
  buscarPorChave(chaveMonitoramento: string): Promise<Rota | null>;
  criar(dados: NovaRota): Promise<Rota>;
  reativar(id: string): Promise<Rota>;
  listar(): Promise<Rota[]>;
  listarAtivas(): Promise<Rota[]>;
  buscarPorId(id: string): Promise<Rota | null>;
  listarHistorico(rotaId: string): Promise<HistoricoPreco[]>;
  registrarHistoricoSeDiferente(
    dados: NovoHistoricoPreco,
  ): Promise<HistoricoPreco | null>;
}
