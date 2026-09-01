import { Rota } from '../../../domain/rotas/entities/rota.entity';

export const CONSULTAR_PRECOS_VOO = Symbol('CONSULTAR_PRECOS_VOO');

export type CotacaoDeVoo = Readonly<{
  preco: string;
  moeda: string;
  companhia: string;
  ignavId?: string;
}>;

export type LinkCompra = Readonly<{
  fornecedor: string;
  tipoFornecedor: 'airline' | 'third_party';
  preco: string;
  moeda: string;
  url: string;
}>;

export interface ConsultarPrecosVoo {
  consultarMenorPreco(rota: Rota): Promise<CotacaoDeVoo | null>;
  obterLinksCompra(ignavId: string): Promise<LinkCompra[]>;
}
