/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ROTAS_REPOSITORY,
  RotasRepository,
} from '../../../domain/rotas/repositories/rotas.repository';
import { DesativarRotaUseCase } from './desativar-rota.use-case';

describe('DesativarRotaUseCase', () => {
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

  let useCase: DesativarRotaUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        DesativarRotaUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
      ],
    }).compile();
    useCase = modulo.get(DesativarRotaUseCase);
  });

  it('desativa uma rota ativa', async () => {
    repositorio.buscarPorId.mockResolvedValue(rota);
    repositorio.desativar.mockResolvedValue({ ...rota, ativa: false });

    await expect(
      useCase.execute({ rotaId: rota.id, usuarioId: rota.usuarioId }),
    ).resolves.toMatchObject({
      ativa: false,
    });
    expect(repositorio.desativar).toHaveBeenCalledWith(rota.id, rota.usuarioId);
  });

  it('não altera uma rota que já está inativa', async () => {
    repositorio.buscarPorId.mockResolvedValue({ ...rota, ativa: false });

    await expect(
      useCase.execute({ rotaId: rota.id, usuarioId: rota.usuarioId }),
    ).resolves.toMatchObject({
      ativa: false,
    });
    expect(repositorio.desativar).not.toHaveBeenCalled();
  });

  it('informa quando a rota não existe', async () => {
    repositorio.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        rotaId: 'rota-inexistente',
        usuarioId: rota.usuarioId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
