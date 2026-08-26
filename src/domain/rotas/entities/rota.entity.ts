export type Rota = Readonly<{
  id: string;
  origem: string;
  destino: string;
  dataIda: Date;
  dataVolta: Date | null;
  ativa: boolean;
  criadoEm: Date;
}>;

export type HistoricoPreco = Readonly<{
  id: string;
  rotaId: string;
  preco: string;
  moeda: string;
  companhia: string;
  coletadoEm: Date;
}>;
