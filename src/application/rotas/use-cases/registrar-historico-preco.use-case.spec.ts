/* eslint-disable @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';
import {
  ROTAS_REPOSITORY,
  RotasRepository,
} from '../../../domain/rotas/repositories/rotas.repository';
import { RegistrarHistoricoPrecoUseCase } from './registrar-historico-preco.use-case';
import { AvaliarAlertaPrecoUseCase } from './avaliar-alerta-preco.use-case';

describe('RegistrarHistoricoPrecoUseCase', () => {
  it('registra cada coleta, mesmo quando a cotação não mudou', async () => {
    const repositorio: jest.Mocked<RotasRepository> = {
      buscarPorChave: jest.fn(),
      criar: jest.fn(),
      reativar: jest.fn(),
      desativar: jest.fn(),
      excluir: jest.fn(),
      listar: jest.fn(),
      listarAtivas: jest.fn(),
      desativarRotasComDataIdaPassada: jest.fn(),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'rota-1', ativa: true }),
      listarHistorico: jest.fn(),
      buscarAlertaPreco: jest.fn(),
      salvarAlertaPreco: jest.fn(),
      atualizarAlertaDisparado: jest.fn(),
      registrarHistorico: jest.fn().mockResolvedValue({
        id: 'h-1',
        rotaId: 'rota-1',
        preco: '100.00',
        moeda: 'BRL',
        companhia: 'LATAM',
        ignavId: null,
        coletadoEm: new Date(),
      }),
    };
    const avaliarAlertaPrecoUseCase = { execute: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        RegistrarHistoricoPrecoUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
        {
          provide: AvaliarAlertaPrecoUseCase,
          useValue: avaliarAlertaPrecoUseCase,
        },
      ],
    }).compile();
    const useCase = module.get(RegistrarHistoricoPrecoUseCase);

    await expect(
      useCase.execute(
        {
          rotaId: 'rota-1',
          preco: '100.00',
          moeda: 'BRL',
          companhia: 'LATAM',
        },
        { id: 'rota-1', usuarioId: 'usuario-1' } as never,
      ),
    ).resolves.toMatchObject({ registrado: true });
    expect(repositorio.registrarHistorico).toHaveBeenCalledWith({
      rotaId: 'rota-1',
      preco: '100.00',
      moeda: 'BRL',
      companhia: 'LATAM',
    });
    expect(avaliarAlertaPrecoUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rota-1' }),
      expect.objectContaining({ preco: '100.00', companhia: 'LATAM' }),
      undefined,
      { horarioIda: undefined, horarioVolta: undefined, urlCompra: undefined },
    );

    await expect(
      useCase.execute(
        {
          rotaId: 'rota-1',
          preco: '100.00',
          moeda: 'BRL',
          companhia: 'LATAM',
        },
        { id: 'rota-1', usuarioId: 'usuario-1' } as never,
      ),
    ).resolves.toMatchObject({ registrado: true });
    expect(repositorio.registrarHistorico).toHaveBeenCalledTimes(2);
    expect(avaliarAlertaPrecoUseCase.execute).toHaveBeenCalledTimes(2);
  });

  it('encaminha horários e link ao alerta sem persistir esses dados', async () => {
    const repositorio: jest.Mocked<RotasRepository> = {
      buscarPorChave: jest.fn(),
      criar: jest.fn(),
      reativar: jest.fn(),
      desativar: jest.fn(),
      excluir: jest.fn(),
      listar: jest.fn(),
      listarAtivas: jest.fn(),
      desativarRotasComDataIdaPassada: jest.fn(),
      buscarPorId: jest.fn(),
      listarHistorico: jest.fn(),
      buscarAlertaPreco: jest.fn(),
      salvarAlertaPreco: jest.fn(),
      atualizarAlertaDisparado: jest.fn(),
      registrarHistorico: jest.fn().mockResolvedValue({
        id: 'h-1',
        rotaId: 'rota-1',
        preco: '100.00',
        moeda: 'BRL',
        companhia: 'LATAM',
        ignavId: null,
        coletadoEm: new Date(),
      }),
    };
    const avaliarAlertaPrecoUseCase = { execute: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        RegistrarHistoricoPrecoUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
        {
          provide: AvaliarAlertaPrecoUseCase,
          useValue: avaliarAlertaPrecoUseCase,
        },
      ],
    }).compile();
    const useCase = module.get(RegistrarHistoricoPrecoUseCase);

    await useCase.execute(
      {
        rotaId: 'rota-1',
        preco: '100.00',
        moeda: 'BRL',
        companhia: 'LATAM',
        horarioIda: '2026-12-10T08:30:00',
        horarioVolta: '2026-12-20T18:45:00',
        urlCompra: 'https://www.latamairlines.com',
      },
      { id: 'rota-1', usuarioId: 'usuario-1' } as never,
    );

    expect(repositorio.registrarHistorico).toHaveBeenCalledWith({
      rotaId: 'rota-1',
      preco: '100.00',
      moeda: 'BRL',
      companhia: 'LATAM',
    });
    expect(avaliarAlertaPrecoUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rota-1' }),
      expect.objectContaining({ preco: '100.00', companhia: 'LATAM' }),
      undefined,
      {
        horarioIda: '2026-12-10T08:30:00',
        horarioVolta: '2026-12-20T18:45:00',
        urlCompra: 'https://www.latamairlines.com',
      },
    );
  });
});
