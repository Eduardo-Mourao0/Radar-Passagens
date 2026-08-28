/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RegraDeNegocioError } from '../../../domain/errors/regra-de-negocio.error';
import {
  ROTAS_REPOSITORY,
  RotasRepository,
} from '../../../domain/rotas/repositories/rotas.repository';
import { ReativarRotaUseCase } from './reativar-rota.use-case';

describe('ReativarRotaUseCase', () => {
  const rota = {
    id: 'rota-1',
    chaveMonitoramento: 'BSB:FOR:2026-12-05:2026-12-12',
    origem: 'BSB',
    destino: 'FOR',
    dataIda: new Date('2026-12-05'),
    dataVolta: new Date('2026-12-12'),
    ativa: false,
    criadoEm: new Date(),
  };
  const repositorio: jest.Mocked<RotasRepository> = {
    buscarPorChave: jest.fn(),
    criar: jest.fn(),
    reativar: jest.fn(),
    desativar: jest.fn(),
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

  let useCase: ReativarRotaUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        ReativarRotaUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
      ],
    }).compile();
    useCase = modulo.get(ReativarRotaUseCase);
  });

  it('reativa uma rota inativa', async () => {
    repositorio.buscarPorId.mockResolvedValue(rota);
    repositorio.reativar.mockResolvedValue({ ...rota, ativa: true });

    await expect(useCase.execute({ rotaId: rota.id })).resolves.toMatchObject({
      ativa: true,
    });
    expect(repositorio.reativar).toHaveBeenCalledWith(rota.id);
  });

  it('não altera uma rota que já está ativa', async () => {
    repositorio.buscarPorId.mockResolvedValue({ ...rota, ativa: true });

    await expect(useCase.execute({ rotaId: rota.id })).resolves.toMatchObject({
      ativa: true,
    });
    expect(repositorio.reativar).not.toHaveBeenCalled();
  });

  it('não reativa uma rota cuja ida já passou', async () => {
    repositorio.buscarPorId.mockResolvedValue({
      ...rota,
      dataIda: new Date('2020-01-01'),
    });

    await expect(useCase.execute({ rotaId: rota.id })).rejects.toBeInstanceOf(
      RegraDeNegocioError,
    );
    expect(repositorio.reativar).not.toHaveBeenCalled();
  });

  it('informa quando a rota não existe', async () => {
    repositorio.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.execute({ rotaId: 'rota-inexistente' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
