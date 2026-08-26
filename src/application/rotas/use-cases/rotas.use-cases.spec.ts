import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ROTAS_REPOSITORY,
  RotasRepository,
} from '../../../domain/rotas/repositories/rotas.repository';
import { CriarRotaUseCase } from './criar-rota.use-case';
import { ListarHistoricoRotaUseCase } from './listar-historico-rota.use-case';
import { ListarRotasUseCase } from './listar-rotas.use-case';

describe('Casos de uso de rotas', () => {
  let criarRotaUseCase: CriarRotaUseCase;
  let listarRotasUseCase: ListarRotasUseCase;
  let listarHistoricoRotaUseCase: ListarHistoricoRotaUseCase;
  let repositorio: jest.Mocked<RotasRepository>;

  const rota = {
    id: 'rota-1',
    origem: 'BSB',
    destino: 'GRU',
    dataIda: new Date('2026-12-10'),
    dataVolta: new Date('2026-12-20'),
    ativa: true,
    criadoEm: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    repositorio = {
      buscarDuplicada: jest.fn(),
      criar: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      listarHistorico: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CriarRotaUseCase,
        ListarRotasUseCase,
        ListarHistoricoRotaUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
      ],
    }).compile();

    criarRotaUseCase = module.get<CriarRotaUseCase>(CriarRotaUseCase);
    listarRotasUseCase = module.get<ListarRotasUseCase>(ListarRotasUseCase);
    listarHistoricoRotaUseCase = module.get<ListarHistoricoRotaUseCase>(
      ListarHistoricoRotaUseCase,
    );
  });

  it('cria uma rota quando ainda não existe uma igual', async () => {
    repositorio.buscarDuplicada.mockResolvedValue(null);
    repositorio.criar.mockResolvedValue(rota);

    await expect(
      criarRotaUseCase.execute({
        origem: 'BSB',
        destino: 'GRU',
        dataIda: '2026-12-10',
        dataVolta: '2026-12-20',
      }),
    ).resolves.toEqual(rota);
    expect(repositorio.criar).toHaveBeenCalledWith({
      origem: 'BSB',
      destino: 'GRU',
      dataIda: new Date('2026-12-10'),
      dataVolta: new Date('2026-12-20'),
    });
  });

  it('rejeita o cadastro de uma rota duplicada', async () => {
    repositorio.buscarDuplicada.mockResolvedValue(rota);

    await expect(
      criarRotaUseCase.execute({
        origem: 'BSB',
        destino: 'GRU',
        dataIda: '2026-12-10',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repositorio.criar).not.toHaveBeenCalled();
  });

  it('lista as rotas', async () => {
    repositorio.listar.mockResolvedValue([rota]);

    await expect(listarRotasUseCase.execute()).resolves.toEqual([rota]);
  });

  it('retorna o histórico de uma rota existente', async () => {
    const historico = {
      id: 'historico-1',
      rotaId: rota.id,
      preco: '1250.50',
      moeda: 'BRL',
      companhia: 'LATAM',
      coletadoEm: new Date('2026-01-01'),
    };
    repositorio.buscarPorId.mockResolvedValue(rota);
    repositorio.listarHistorico.mockResolvedValue([historico]);

    await expect(listarHistoricoRotaUseCase.execute(rota.id)).resolves.toEqual([
      historico,
    ]);
  });

  it('rejeita a consulta de histórico de uma rota inexistente', async () => {
    repositorio.buscarPorId.mockResolvedValue(null);

    await expect(
      listarHistoricoRotaUseCase.execute('rota-inexistente'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorio.listarHistorico).not.toHaveBeenCalled();
  });
});
