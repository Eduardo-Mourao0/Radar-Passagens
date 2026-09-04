export const MENSAGENS_ERRO = {
  telefoneInvalido: 'Informe um número de telefone válido no formato E.164.',
  pinInvalido: 'O PIN deve conter exatamente quatro dígitos.',
  telefoneJaCadastrado: 'Este número de telefone já possui uma conta.',
  credenciaisInvalidas: 'Telefone ou PIN inválido.',
  contaTemporariamenteBloqueada:
    'Conta temporariamente bloqueada por tentativas inválidas.',
  verificacaoInvalida: 'Verificação inválida ou expirada.',
  codigoVerificacaoInvalido: 'Código de verificação inválido ou expirado.',
  codigoIataInvalido: 'Informe um código IATA de três letras maiúsculas.',
  origemDestinoIguais: 'origem e destino devem ser diferentes.',
  dataIdaPassada: 'dataIda deve ser hoje ou uma data futura.',
  dataVoltaAnterior: 'dataVolta deve ser igual ou posterior a dataIda.',
  dataInvalida: (campo: string) => `${campo} deve ser uma data válida.`,
  dadosEntradaInvalidos: 'Dados de entrada inválidos.',
  rotaDuplicada: 'Esta rota já está cadastrada.',
  rotaNaoEncontrada: 'Rota não encontrada.',
  rotaComDataIdaPassada:
    'Não é possível reativar uma rota cuja data de ida já passou.',
  precoInvalido:
    'preco deve ser um valor decimal positivo de até 99.999.999,99.',
  moedaInvalida: 'moeda deve ser uma das moedas suportadas: BRL, USD ou EUR.',
  companhiaObrigatoria: 'companhia é obrigatória.',
  companhiaInvalida:
    'companhia deve ter no máximo 100 caracteres e conter apenas letras, números, espaços, hífens, apóstrofos, pontos ou &.',
  ignavConsultaIndisponivel:
    'Não foi possível consultar os preços na Ignav. Tente novamente mais tarde.',
  ignavTempoEsgotado:
    'A Ignav demorou para responder. Tente consultar novamente em instantes.',
  ignavLimiteConsultas:
    'Muitas consultas foram feitas em pouco tempo. Aguarde alguns minutos e tente novamente.',
  ignavCotacaoExpirada:
    'Esta cotação expirou. Atualize o preço da rota e tente novamente.',
  ignavRespostaInvalida:
    'A Ignav retornou dados inválidos. Tente novamente mais tarde.',
  ignavConexaoIndisponivel:
    'Não foi possível conectar à Ignav. Verifique sua conexão e tente novamente.',
  verificacaoPrecosEmAndamento:
    'Uma verificação de preços já está em andamento. Aguarde a conclusão.',
  linksCompraIndisponiveis:
    'Nenhum link de compra est\u00e1 dispon\u00edvel para a \u00faltima cota\u00e7\u00e3o desta rota.',
} as const;

export const MENSAGENS_ERRO_PUBLICAS = new Set<string>([
  MENSAGENS_ERRO.origemDestinoIguais,
  MENSAGENS_ERRO.dataIdaPassada,
  MENSAGENS_ERRO.rotaComDataIdaPassada,
  MENSAGENS_ERRO.dataVoltaAnterior,
  MENSAGENS_ERRO.dataInvalida('dataIda'),
  MENSAGENS_ERRO.dataInvalida('dataVolta'),
  MENSAGENS_ERRO.precoInvalido,
  MENSAGENS_ERRO.moedaInvalida,
  MENSAGENS_ERRO.companhiaObrigatoria,
  MENSAGENS_ERRO.companhiaInvalida,
  MENSAGENS_ERRO.linksCompraIndisponiveis,
]);
