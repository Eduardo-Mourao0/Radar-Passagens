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

  it('aceita o maior preço suportado pelo campo Decimal(10, 2)', () => {
    expect(
      HistoricoPrecoEntity.criar({ ...dados, preco: '99999999.99' }),
    ).toEqual({
      ...dados,
      preco: '99999999.99',
    });
  });

  it('normaliza o preço para duas casas decimais antes de comparar', () => {
    const novoHistorico = HistoricoPrecoEntity.criar({
      ...dados,
      preco: '100',
    });

    expect(novoHistorico.preco).toBe('100.00');
    expect(
      HistoricoPrecoEntity.temMesmoValor(
        { preco: '100.00', moeda: 'BRL', companhia: 'LATAM' },
        novoHistorico,
      ),
    ).toBe(true);
  });

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

  it.each([
    ['uma companhia longa demais', 'A'.repeat(101)],
    ['caractere de controle', 'LATAM\nAirlines'],
  ])('rejeita %s', (_, companhia) => {
    expect(() => HistoricoPrecoEntity.criar({ ...dados, companhia })).toThrow(
      RegraDeNegocioError,
    );
  });
});
