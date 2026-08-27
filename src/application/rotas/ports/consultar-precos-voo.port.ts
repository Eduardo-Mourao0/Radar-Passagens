import { Rota } from '../../../domain/rotas/entities/rota.entity';

export const CONSULTAR_PRECOS_VOO = Symbol('CONSULTAR_PRECOS_VOO');

export type CotacaoDeVoo = Readonly<{
  preco: string;
  moeda: string;
  companhia: string;
}>;

export interface ConsultarPrecosVoo {
  consultarMenorPreco(rota: Rota): Promise<CotacaoDeVoo | null>;
}
