export const MENSAGENS_ERRO = {
  codigoIataInvalido:
    'Informe um código IATA de três letras maiúsculas.',
  origemDestinoIguais: 'origem e destino devem ser diferentes.',
  dataIdaPassada: 'dataIda deve ser hoje ou uma data futura.',
  dataVoltaAnterior: 'dataVolta deve ser igual ou posterior a dataIda.',
  dataInvalida: (campo: string) => `${campo} deve ser uma data válida.`,
  dadosEntradaInvalidos: 'Dados de entrada inválidos.',
  rotaDuplicada: 'Esta rota já está cadastrada.',
  rotaNaoEncontrada: 'Rota não encontrada.',
  precoInvalido: 'preco deve ser um valor decimal positivo com até duas casas.',
  moedaInvalida: 'moeda deve ser um código ISO de três letras maiúsculas.',
  companhiaObrigatoria: 'companhia é obrigatória.',
} as const;
