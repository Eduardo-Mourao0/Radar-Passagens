export type CriarRotaCommand = Readonly<{
  usuarioId: string;
  origem: string;
  destino: string;
  dataIda: string;
  dataVolta?: string;
}>;
