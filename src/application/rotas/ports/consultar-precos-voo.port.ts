import { Rota } from '../../../domain/rotas/entities/rota.entity';

export const CONSULTAR_PRECOS_VOO = Symbol('CONSULTAR_PRECOS_VOO');

export type CotacaoDeVoo = Readonly<{
  preco: string;
  moeda: string;
  companhia: string;
  ignavId?: string;
  horarioIda?: string;
  horarioVolta?: string;
  urlCompra?: string;
}>;

export type LinkCompra = Readonly<{
  fornecedor: string;
  tipoFornecedor: 'airline' | 'third_party';
  preco: string;
  moeda: string;
  url: string;
}>;

export type OpcoesConsultaPreco = Readonly<{
  repetirLinks?: boolean;
}>;

export interface ConsultarPrecosVoo {
  consultarMenorPreco(
    rota: Rota,
    opcoes?: OpcoesConsultaPreco,
  ): Promise<CotacaoDeVoo | null>;
  obterLinksCompra(ignavId: string): Promise<LinkCompra[]>;
}
