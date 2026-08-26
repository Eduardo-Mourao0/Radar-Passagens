export type CriarRotaCommand = Readonly<{
  origem: string;
  destino: string;
  dataIda: string;
  dataVolta?: string;
}>;
