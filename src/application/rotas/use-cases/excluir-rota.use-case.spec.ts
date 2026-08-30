/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ROTAS_REPOSITORY,
  RotasRepository,
} from '../../../domain/rotas/repositories/rotas.repository';
import { ExcluirRotaUseCase } from './excluir-rota.use-case';

describe('ExcluirRotaUseCase', () => {
  const rota = {
    id: 'rota-1',
    usuarioId: 'usuario-1',
    chaveMonitoramento: 'BSB:FOR:2026-12-05:2026-12-12',
    origem: 'BSB',
    destino: 'FOR',
    dataIda: new Date('2026-12-05'),
    dataVolta: new Date('2026-12-12'),
    ativa: true,
    criadoEm: new Date(),
  };
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
    registrarHistoricoSeDiferente: jest.fn(),
  };

  let useCase: ExcluirRotaUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        ExcluirRotaUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
      ],
    }).compile();
    useCase = modulo.get(ExcluirRotaUseCase);
  });

  it('exclui a rota existente', async () => {
    repositorio.buscarPorId.mockResolvedValue(rota);
    repositorio.excluir.mockResolvedValue(undefined);

    await expect(
      useCase.execute({ rotaId: rota.id, usuarioId: rota.usuarioId }),
    ).resolves.toBeUndefined();
    expect(repositorio.excluir).toHaveBeenCalledWith(rota.id, rota.usuarioId);
  });

  it('informa quando a rota nao existe', async () => {
    repositorio.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        rotaId: 'rota-inexistente',
        usuarioId: rota.usuarioId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorio.excluir).not.toHaveBeenCalled();
  });
});
