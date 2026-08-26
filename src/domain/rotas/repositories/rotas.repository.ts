import { HistoricoPreco, Rota } from '../entities/rota.entity';

export const ROTAS_REPOSITORY = Symbol('ROTAS_REPOSITORY');

export type NovaRota = Readonly<{
  origem: string;
  destino: string;
  dataIda: Date;
  dataVolta: Date | null;
}>;

export interface RotasRepository {
  buscarDuplicada(dados: NovaRota): Promise<Rota | null>;
  criar(dados: NovaRota): Promise<Rota>;
  listar(): Promise<Rota[]>;
  buscarPorId(id: string): Promise<Rota | null>;
  listarHistorico(rotaId: string): Promise<HistoricoPreco[]>;
}
