import { Test } from '@nestjs/testing';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import { CONSULTAR_PRECOS_VOO } from '../ports/consultar-precos-voo.port';
import { RegistrarHistoricoPrecoUseCase } from './registrar-historico-preco.use-case';
import { VerificarPrecoRotaUseCase } from './verificar-preco-rota.use-case';

describe('VerificarPrecoRotaUseCase', () => {
  const consultarPrecosVoo = { consultarMenorPreco: jest.fn() };
  const registrarHistoricoPreco = { execute: jest.fn() };
  const rotasRepository = { buscarPorId: jest.fn() };
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
        { provide: ROTAS_REPOSITORY, useValue: rotasRepository },
      ],
    }).compile();
    useCase = modulo.get(VerificarPrecoRotaUseCase);
  });

  it('não registra histórico quando não há oferta', async () => {
    consultarPrecosVoo.consultarMenorPreco.mockResolvedValue(null);

    await expect(useCase.execute(rota)).resolves.toEqual({
      ofertaEncontrada: false,
      historicoRegistrado: false,
      historico: null,
    });
    expect(registrarHistoricoPreco.execute).not.toHaveBeenCalled();
  });

  it('registra a cotação encontrada somente para a rota solicitada', async () => {
    consultarPrecosVoo.consultarMenorPreco.mockResolvedValue({
      preco: '350.00',
      moeda: 'BRL',
      companhia: 'Azul',
      horarioIda: '2026-12-10T08:30:00',
      urlCompra: 'https://www.voeazul.com.br',
    });
    const historico = {
      id: 'historico-1',
      rotaId: 'rota-1',
      preco: '350.00',
      moeda: 'BRL',
      companhia: 'Azul',
      ignavId: null,
      coletadoEm: new Date(2026, 0, 1),
    };
    registrarHistoricoPreco.execute.mockResolvedValue({
      registrado: true,
      historico,
    });

    await expect(useCase.execute(rota)).resolves.toEqual({
      ofertaEncontrada: true,
      historicoRegistrado: true,
      historico,
    });
    expect(registrarHistoricoPreco.execute).toHaveBeenCalledWith(
      {
        rotaId: 'rota-1',
        preco: '350.00',
        moeda: 'BRL',
        companhia: 'Azul',
        horarioIda: '2026-12-10T08:30:00',
        urlCompra: 'https://www.voeazul.com.br',
      },
      rota,
      undefined,
    );
  });

  it('informa indisponibilidade sem propagar falhas da cotação', async () => {
    consultarPrecosVoo.consultarMenorPreco.mockRejectedValue(
      new Error('Ignav indisponível'),
    );

    await expect(useCase.executarResiliente(rota)).resolves.toBe(
      'INDISPONIVEL',
    );
  });

  it('atualiza somente a rota pertencente ao usuário e devolve sua cotação', async () => {
    const historico = {
      id: 'historico-1',
      rotaId: 'rota-1',
      preco: '350.00',
      moeda: 'BRL',
      companhia: 'Azul',
      ignavId: null,
      coletadoEm: new Date(2026, 0, 1),
    };
    rotasRepository.buscarPorId.mockResolvedValue(rota);
    consultarPrecosVoo.consultarMenorPreco.mockResolvedValue({
      preco: '350.00',
      moeda: 'BRL',
      companhia: 'Azul',
    });
    registrarHistoricoPreco.execute.mockResolvedValue({
      registrado: true,
      historico,
    });

    await expect(
      useCase.executarParaUsuario('rota-1', 'usuario-1'),
    ).resolves.toEqual({
      ...rota,
      situacaoCotacao: 'ATUALIZADA',
      ultimoPreco: historico,
    });
    expect(rotasRepository.buscarPorId).toHaveBeenCalledWith(
      'rota-1',
      'usuario-1',
    );
    expect(consultarPrecosVoo.consultarMenorPreco).toHaveBeenCalledWith(rota, {
      repetirLinks: false,
    });
  });
});
