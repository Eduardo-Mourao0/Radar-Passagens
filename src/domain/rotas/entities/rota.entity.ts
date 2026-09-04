import { MENSAGENS_ERRO } from '../../errors/mensagens-erro';
import { RegraDeNegocioError } from '../../errors/regra-de-negocio.error';

export type SituacaoCotacao =
  'PENDENTE' | 'ATUALIZADA' | 'SEM_OFERTA' | 'INDISPONIVEL';

export type Rota = Readonly<{
  id: string;
  usuarioId: string;
  chaveMonitoramento: string;
  origem: string;
  destino: string;
  dataIda: Date;
  dataVolta: Date | null;
  ativa: boolean;
  situacaoCotacao: SituacaoCotacao;
  ultimaCotacaoEm: Date | null;
  proximaTentativaCotacaoEm: Date | null;
  tentativasCotacao: number;
  criadoEm: Date;
}>;

export type DadosNovaRota = Readonly<{
  origem: string;
  destino: string;
  dataIda: string;
  dataVolta?: string;
}>;

export type NovaRota = Readonly<{
  usuarioId: string;
  chaveMonitoramento: string;
  origem: string;
  destino: string;
  dataIda: Date;
  dataVolta: Date | null;
}>;

export type AtualizacaoSituacaoCotacao = Readonly<{
  situacaoCotacao: SituacaoCotacao;
  ultimaCotacaoEm: Date;
  proximaTentativaCotacaoEm: Date | null;
  tentativasCotacao: number;
}>;

export class RotaEntity {
  static criarNova(dados: DadosNovaRota): Omit<NovaRota, 'usuarioId'> {
    if (dados.origem === dados.destino) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.origemDestinoIguais);
    }

    const dataIda = this.criarData(dados.dataIda, 'dataIda');
    const dataVolta = dados.dataVolta
      ? this.criarData(dados.dataVolta, 'dataVolta')
      : null;
    if (this.dataIdaJaPassou(dataIda)) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.dataIdaPassada);
    }

    if (dataVolta && dataVolta < dataIda) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.dataVoltaAnterior);
    }

    return {
      chaveMonitoramento: [
        dados.origem,
        dados.destino,
        dados.dataIda,
        dados.dataVolta ?? 'SOMENTE_IDA',
      ].join(':'),
      origem: dados.origem,
      destino: dados.destino,
      dataIda,
      dataVolta,
    };
  }

  static dataIdaJaPassou(dataIda: Date, referencia = new Date()): boolean {
    const inicioDaDataIda = new Date(dataIda);
    inicioDaDataIda.setHours(0, 0, 0, 0);

    const inicioDoDia = new Date(referencia);
    inicioDoDia.setHours(0, 0, 0, 0);

    return inicioDaDataIda < inicioDoDia;
  }

  private static criarData(valor: string, campo: string): Date {
    const data = new Date(`${valor}T00:00:00`);

    if (Number.isNaN(data.getTime())) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.dataInvalida(campo));
    }

    return data;
  }
}

export type HistoricoPreco = Readonly<{
  id: string;
  rotaId: string;
  preco: string;
  moeda: string;
  companhia: string;
  ignavId: string | null;
  coletadoEm: Date;
}>;

export type DadosNovoHistoricoPreco = Readonly<{
  rotaId: string;
  preco: string;
  moeda: string;
  companhia: string;
  ignavId?: string;
}>;

export type NovoHistoricoPreco = DadosNovoHistoricoPreco;

export type AlertaPreco = Readonly<{
  id: string;
  rotaId: string;
  precoAlvo: string;
  disparado: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}>;

export type RotaComAlerta = Rota &
  Readonly<{
    alertaPreco: Pick<AlertaPreco, 'precoAlvo' | 'disparado'> | null;
    ultimoPreco: HistoricoPreco | null;
  }>;

export type NovoAlertaPreco = Readonly<{
  rotaId: string;
  precoAlvo: string;
}>;

export class PrecoEntity {
  private static readonly PRECO_VALIDO =
    /^(?:[1-9]\d{0,7}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

  static criar(preco: string): string {
    // Preço zero representa cotação ausente ou inválida, não uma tarifa monitorável.
    if (!this.PRECO_VALIDO.test(preco)) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.precoInvalido);
    }

    return this.normalizar(preco);
  }

  static normalizar(preco: string): string {
    const [parteInteira, parteDecimal = ''] = preco.split('.');

    return `${parteInteira}.${parteDecimal.padEnd(2, '0')}`;
  }

  static comparar(primeiro: string, segundo: string): number {
    const primeiroEmCentavos = this.paraCentavos(primeiro);
    const segundoEmCentavos = this.paraCentavos(segundo);

    if (primeiroEmCentavos === segundoEmCentavos) return 0;

    return primeiroEmCentavos < segundoEmCentavos ? -1 : 1;
  }

  private static paraCentavos(preco: string): bigint {
    const [parteInteira, parteDecimal = ''] = this.normalizar(preco).split('.');

    return BigInt(`${parteInteira}${parteDecimal}`);
  }
}

export class HistoricoPrecoEntity {
  private static readonly MOEDAS_SUPORTADAS = ['BRL', 'USD', 'EUR'] as const;
  private static readonly NOME_COMPANHIA_VALIDO = /^[\p{L}\p{N} .&'-]+$/u;

  static criar(dados: DadosNovoHistoricoPreco): NovoHistoricoPreco {
    if (
      !this.MOEDAS_SUPORTADAS.includes(
        dados.moeda as (typeof this.MOEDAS_SUPORTADAS)[number],
      )
    ) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.moedaInvalida);
    }

    const companhia = dados.companhia.trim().replace(/ +/g, ' ');
    if (!companhia) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.companhiaObrigatoria);
    }

    if (companhia.length > 100 || !this.NOME_COMPANHIA_VALIDO.test(companhia)) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.companhiaInvalida);
    }

    return { ...dados, preco: PrecoEntity.criar(dados.preco), companhia };
  }

  static normalizarPreco(preco: string): string {
    return PrecoEntity.normalizar(preco);
  }

  static compararPrecos(primeiro: string, segundo: string): number {
    return PrecoEntity.comparar(primeiro, segundo);
  }
}

export class AlertaPrecoEntity {
  static criar(dados: NovoAlertaPreco): NovoAlertaPreco {
    const precoAlvo = PrecoEntity.criar(dados.precoAlvo);

    return { rotaId: dados.rotaId, precoAlvo };
  }

  static deveDisparar(alerta: AlertaPreco, precoAtual: string): boolean {
    return (
      !alerta.disparado &&
      PrecoEntity.comparar(precoAtual, alerta.precoAlvo) <= 0
    );
  }

  static deveRearmar(alerta: AlertaPreco, precoAtual: string): boolean {
    return (
      alerta.disparado && PrecoEntity.comparar(precoAtual, alerta.precoAlvo) > 0
    );
  }
}
