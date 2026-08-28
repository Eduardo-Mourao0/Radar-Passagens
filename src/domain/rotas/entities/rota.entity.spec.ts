import { RegraDeNegocioError } from '../../errors/regra-de-negocio.error';
import { HistoricoPrecoEntity, RotaEntity } from './rota.entity';

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

  it('normaliza espaços internos no nome da companhia', () => {
    expect(
      HistoricoPrecoEntity.criar({
        ...dados,
        companhia: '  LATAM   Airlines  ',
      }).companhia,
    ).toBe('LATAM Airlines');
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

describe('RotaEntity', () => {
  describe('dataIdaJaPassou', () => {
    const referencia = new Date(2026, 7, 27, 15, 30, 0);

    it('ignora o horario da data de ida na comparacao', () => {
      const dataIda = new Date(2026, 7, 27, 23, 59, 59);

      expect(RotaEntity.dataIdaJaPassou(dataIda, referencia)).toBe(false);
    });

    it('considera passada uma data anterior ao dia de referencia', () => {
      const dataIda = new Date(2026, 7, 26, 23, 59, 59);

      expect(RotaEntity.dataIdaJaPassou(dataIda, referencia)).toBe(true);
    });
  });
});
