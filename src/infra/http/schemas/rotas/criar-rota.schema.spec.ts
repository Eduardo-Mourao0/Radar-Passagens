import { criarRotaSchema } from './criar-rota.schema';

describe('criarRotaSchema', () => {
  const dadosValidos = {
    origem: 'BSB',
    destino: 'GRU',
    dataIda: '2099-12-10',
    dataVolta: '2099-12-20',
  };

  it('rejeita uma data de ida anterior ao dia atual', () => {
    const resultado = criarRotaSchema.safeParse({
      ...dadosValidos,
      dataIda: '2000-01-01',
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].path).toEqual(['dataIda']);
    }
  });

  it('rejeita origem e destino iguais', () => {
    const resultado = criarRotaSchema.safeParse({
      ...dadosValidos,
      destino: dadosValidos.origem,
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].path).toEqual(['destino']);
    }
  });

  it('rejeita uma data de volta anterior à data de ida', () => {
    const resultado = criarRotaSchema.safeParse({
      ...dadosValidos,
      dataIda: '2099-12-20',
      dataVolta: '2099-12-10',
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].path).toEqual(['dataVolta']);
    }
  });

  it('aceita ida futura e volta no mesmo dia ou posterior', () => {
    expect(criarRotaSchema.safeParse(dadosValidos).success).toBe(true);
    expect(
      criarRotaSchema.safeParse({
        ...dadosValidos,
        dataVolta: dadosValidos.dataIda,
      }).success,
    ).toBe(true);
  });
});
