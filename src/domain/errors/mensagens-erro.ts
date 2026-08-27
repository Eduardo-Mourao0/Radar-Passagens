export const MENSAGENS_ERRO = {
  codigoIataInvalido: 'Informe um código IATA de três letras maiúsculas.',
  origemDestinoIguais: 'origem e destino devem ser diferentes.',
  dataIdaPassada: 'dataIda deve ser hoje ou uma data futura.',
  dataVoltaAnterior: 'dataVolta deve ser igual ou posterior a dataIda.',
  dataInvalida: (campo: string) => `${campo} deve ser uma data válida.`,
  dadosEntradaInvalidos: 'Dados de entrada inválidos.',
  rotaDuplicada: 'Esta rota já está cadastrada.',
  rotaNaoEncontrada: 'Rota não encontrada.',
  precoInvalido:
    'preco deve ser um valor decimal positivo de até 99.999.999,99.',
  moedaInvalida: 'moeda deve ser uma das moedas suportadas: BRL, USD ou EUR.',
  companhiaObrigatoria: 'companhia é obrigatória.',
  companhiaInvalida:
    'companhia deve ter no máximo 100 caracteres e conter apenas letras, números, espaços, hífens, apóstrofos, pontos ou &.',
} as const;

export const MENSAGENS_ERRO_PUBLICAS = new Set<string>([
  MENSAGENS_ERRO.origemDestinoIguais,
  MENSAGENS_ERRO.dataIdaPassada,
  MENSAGENS_ERRO.dataVoltaAnterior,
  MENSAGENS_ERRO.dataInvalida('dataIda'),
  MENSAGENS_ERRO.dataInvalida('dataVolta'),
  MENSAGENS_ERRO.precoInvalido,
  MENSAGENS_ERRO.moedaInvalida,
  MENSAGENS_ERRO.companhiaObrigatoria,
  MENSAGENS_ERRO.companhiaInvalida,
]);
