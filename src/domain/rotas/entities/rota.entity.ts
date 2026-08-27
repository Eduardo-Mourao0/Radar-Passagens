import { MENSAGENS_ERRO } from '../../errors/mensagens-erro';
import { RegraDeNegocioError } from '../../errors/regra-de-negocio.error';

export type Rota = Readonly<{
  id: string;
  chaveMonitoramento: string;
  origem: string;
  destino: string;
  dataIda: Date;
  dataVolta: Date | null;
  ativa: boolean;
  criadoEm: Date;
}>;

export type DadosNovaRota = Readonly<{
  origem: string;
  destino: string;
  dataIda: string;
  dataVolta?: string;
}>;

export type NovaRota = Readonly<{
  chaveMonitoramento: string;
  origem: string;
  destino: string;
  dataIda: Date;
  dataVolta: Date | null;
}>;

export class RotaEntity {
  static criarNova(dados: DadosNovaRota): NovaRota {
    if (dados.origem === dados.destino) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.origemDestinoIguais);
    }

    const dataIda = this.criarData(dados.dataIda, 'dataIda');
    const dataVolta = dados.dataVolta
      ? this.criarData(dados.dataVolta, 'dataVolta')
      : null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataIda < hoje) {
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
  coletadoEm: Date;
}>;

export type DadosNovoHistoricoPreco = Readonly<{
  rotaId: string;
  preco: string;
  moeda: string;
  companhia: string;
}>;

export type NovoHistoricoPreco = DadosNovoHistoricoPreco;

export class HistoricoPrecoEntity {
  private static readonly MOEDAS_SUPORTADAS = ['BRL', 'USD', 'EUR'] as const;
  private static readonly NOME_COMPANHIA_VALIDO = /^[\p{L}\p{N} .&'-]+$/u;

  static criar(dados: DadosNovoHistoricoPreco): NovoHistoricoPreco {
    // Preço zero representa cotação ausente ou inválida, não uma tarifa monitorável.
    if (
      !/^(?:[1-9]\d{0,7}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/.test(
        dados.preco,
      )
    ) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.precoInvalido);
    }

    if (
      !this.MOEDAS_SUPORTADAS.includes(
        dados.moeda as (typeof this.MOEDAS_SUPORTADAS)[number],
      )
    ) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.moedaInvalida);
    }

    const companhia = dados.companhia.trim();
    if (!companhia) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.companhiaObrigatoria);
    }

    if (companhia.length > 100 || !this.NOME_COMPANHIA_VALIDO.test(companhia)) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.companhiaInvalida);
    }

    return { ...dados, preco: this.normalizarPreco(dados.preco), companhia };
  }

  static normalizarPreco(preco: string): string {
    const [parteInteira, parteDecimal = ''] = preco.split('.');

    return `${parteInteira}.${parteDecimal.padEnd(2, '0')}`;
  }

  static temMesmoValor(
    historico: Pick<HistoricoPreco, 'preco' | 'moeda' | 'companhia'>,
    outro: Pick<NovoHistoricoPreco, 'preco' | 'moeda' | 'companhia'>,
  ): boolean {
    return (
      historico.preco === outro.preco &&
      historico.moeda === outro.moeda &&
      historico.companhia === outro.companhia
    );
  }
}
