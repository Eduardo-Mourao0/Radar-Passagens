import { RegraDeNegocioError } from '../../errors/regra-de-negocio.error';
import { HistoricoPrecoEntity } from './rota.entity';

describe('HistoricoPrecoEntity', () => {
  const dados = {
    rotaId: 'rota-1',
    preco: '1250.50',
    moeda: 'BRL',
    companhia: 'LATAM',
  };

  it.each(['0', '0.00', '100000000.00'])(
    'rejeita o preço inválido %s',
    (preco) => {
      expect(() => HistoricoPrecoEntity.criar({ ...dados, preco })).toThrow(
        RegraDeNegocioError,
      );
    },
  );

  it.each(['AAA', 'XXX', 'brl'])(
    'rejeita a moeda não suportada %s',
    (moeda) => {
      expect(() => HistoricoPrecoEntity.criar({ ...dados, moeda })).toThrow(
        RegraDeNegocioError,
      );
    },
  );

  it('compara os campos monitorados do histórico', () => {
    expect(
      HistoricoPrecoEntity.temMesmoValor(
        { preco: '1250.50', moeda: 'BRL', companhia: 'LATAM' },
        dados,
      ),
    ).toBe(true);
    expect(
      HistoricoPrecoEntity.temMesmoValor(
        { preco: '1250.50', moeda: 'BRL', companhia: 'GOL' },
        dados,
      ),
    ).toBe(false);
  });
});
