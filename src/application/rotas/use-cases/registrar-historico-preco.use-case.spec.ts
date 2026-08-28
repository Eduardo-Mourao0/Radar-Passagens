/* eslint-disable @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';
import {
  ROTAS_REPOSITORY,
  RotasRepository,
} from '../../../domain/rotas/repositories/rotas.repository';
import { RegistrarHistoricoPrecoUseCase } from './registrar-historico-preco.use-case';
import { AvaliarAlertaPrecoUseCase } from './avaliar-alerta-preco.use-case';

describe('RegistrarHistoricoPrecoUseCase', () => {
  it('registra apenas quando a coleta mudou', async () => {
    const repositorio: jest.Mocked<RotasRepository> = {
      buscarPorChave: jest.fn(),
      criar: jest.fn(),
      reativar: jest.fn(),
      listar: jest.fn(),
      listarAtivas: jest.fn(),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'rota-1', ativa: true }),
      listarHistorico: jest.fn(),
      buscarAlertaPreco: jest.fn(),
      salvarAlertaPreco: jest.fn(),
      atualizarAlertaDisparado: jest.fn(),
      registrarHistoricoSeDiferente: jest.fn().mockResolvedValue(null),
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
      useCase.execute({
        rotaId: 'rota-1',
        preco: '100.00',
        moeda: 'BRL',
        companhia: 'LATAM',
      }),
    ).resolves.toEqual({ registrado: false });
    expect(repositorio.registrarHistoricoSeDiferente).toHaveBeenCalledWith({
      rotaId: 'rota-1',
      preco: '100.00',
      moeda: 'BRL',
      companhia: 'LATAM',
    });

    repositorio.registrarHistoricoSeDiferente.mockResolvedValue({
      id: 'h-1',
      rotaId: 'rota-1',
      preco: '99.90',
      moeda: 'BRL',
      companhia: 'LATAM',
      coletadoEm: new Date(),
    });
    await expect(
      useCase.execute({
        rotaId: 'rota-1',
        preco: '99.90',
        moeda: 'BRL',
        companhia: 'LATAM',
      }),
    ).resolves.toMatchObject({ registrado: true });
    expect(avaliarAlertaPrecoUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
