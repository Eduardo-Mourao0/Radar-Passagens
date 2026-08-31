import { Test } from '@nestjs/testing';
import { CONSULTAR_PRECOS_VOO } from '../ports/consultar-precos-voo.port';
import { RegistrarHistoricoPrecoUseCase } from './registrar-historico-preco.use-case';
import { VerificarPrecoRotaUseCase } from './verificar-preco-rota.use-case';

describe('VerificarPrecoRotaUseCase', () => {
  const consultarPrecosVoo = { consultarMenorPreco: jest.fn() };
  const registrarHistoricoPreco = { execute: jest.fn() };
  const rota = { id: 'rota-1', usuarioId: 'usuario-1' } as never;

  let useCase: VerificarPrecoRotaUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        VerificarPrecoRotaUseCase,
        { provide: CONSULTAR_PRECOS_VOO, useValue: consultarPrecosVoo },
        {
          provide: RegistrarHistoricoPrecoUseCase,
          useValue: registrarHistoricoPreco,
        },
      ],
    }).compile();
    useCase = modulo.get(VerificarPrecoRotaUseCase);
  });

  it('não registra histórico quando não há oferta', async () => {
    consultarPrecosVoo.consultarMenorPreco.mockResolvedValue(null);

    await expect(useCase.execute(rota)).resolves.toEqual({
      ofertaEncontrada: false,
      historicoRegistrado: false,
    });
    expect(registrarHistoricoPreco.execute).not.toHaveBeenCalled();
  });

  it('registra a cotação encontrada somente para a rota solicitada', async () => {
    consultarPrecosVoo.consultarMenorPreco.mockResolvedValue({
      preco: '350.00',
      moeda: 'BRL',
      companhia: 'Azul',
    });
    registrarHistoricoPreco.execute.mockResolvedValue({ registrado: true });

    await expect(useCase.execute(rota)).resolves.toEqual({
      ofertaEncontrada: true,
      historicoRegistrado: true,
    });
    expect(registrarHistoricoPreco.execute).toHaveBeenCalledWith(
      {
        rotaId: 'rota-1',
        preco: '350.00',
        moeda: 'BRL',
        companhia: 'Azul',
      },
      rota,
      undefined,
    );
  });
});
