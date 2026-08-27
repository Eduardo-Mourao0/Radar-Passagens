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
