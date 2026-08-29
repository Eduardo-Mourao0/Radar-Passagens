export type RegistrarHistoricoPrecoCommand = Readonly<{
  rotaId: string;
  preco: string;
  moeda: string;
  companhia: string;
  ignavId?: string;
}>;
