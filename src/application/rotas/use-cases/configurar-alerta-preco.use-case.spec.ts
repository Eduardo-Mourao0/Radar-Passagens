/* eslint-disable @typescript-eslint/unbound-method */
import { Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import {
  ROTAS_REPOSITORY,
  RotasRepository,
} from '../../../domain/rotas/repositories/rotas.repository';
import { AvaliarAlertaPrecoUseCase } from './avaliar-alerta-preco.use-case';
import { ConfigurarAlertaPrecoUseCase } from './configurar-alerta-preco.use-case';

describe('ConfigurarAlertaPrecoUseCase', () => {
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
    registrarHistorico: jest.fn(),
    buscarAlertaPreco: jest.fn(),
    salvarAlertaPreco: jest.fn(),
    atualizarAlertaDisparado: jest.fn(),
  };
  const avaliarAlertaPrecoUseCase = { execute: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('configura um alerta e normaliza o preço-alvo', async () => {
    repositorio.buscarPorId.mockResolvedValue({ id: 'rota-1' } as never);
    repositorio.listarHistorico.mockResolvedValue([]);
    repositorio.salvarAlertaPreco.mockResolvedValue({
      id: 'alerta-1',
      rotaId: 'rota-1',
      precoAlvo: '1500.50',
      disparado: false,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });
    const modulo = await Test.createTestingModule({
      providers: [
        ConfigurarAlertaPrecoUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
        {
          provide: AvaliarAlertaPrecoUseCase,
          useValue: avaliarAlertaPrecoUseCase,
        },
      ],
    }).compile();
    const useCase = modulo.get(ConfigurarAlertaPrecoUseCase);

    await expect(
      useCase.execute({
        rotaId: 'rota-1',
        usuarioId: 'usuario-1',
        precoAlvo: '1500.5',
      }),
    ).resolves.toMatchObject({ precoAlvo: '1500.50' });
    expect(repositorio.salvarAlertaPreco).toHaveBeenCalledWith({
      rotaId: 'rota-1',
      precoAlvo: '1500.50',
    });
    expect(avaliarAlertaPrecoUseCase.execute).not.toHaveBeenCalled();
  });

  it('avalia imediatamente a última tarifa ao configurar a meta', async () => {
    const rota = { id: 'rota-1', usuarioId: 'usuario-1' } as never;
    const historico = {
      preco: '811.00',
      companhia: 'GOL',
    };
    repositorio.buscarPorId.mockResolvedValue(rota);
    repositorio.salvarAlertaPreco.mockResolvedValue({
      id: 'alerta-1',
      rotaId: 'rota-1',
      precoAlvo: '900.00',
      disparado: false,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });
    repositorio.listarHistorico.mockResolvedValue([historico] as never);
    const modulo = await Test.createTestingModule({
      providers: [
        ConfigurarAlertaPrecoUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
        {
          provide: AvaliarAlertaPrecoUseCase,
          useValue: avaliarAlertaPrecoUseCase,
        },
      ],
    }).compile();
    const useCase = modulo.get(ConfigurarAlertaPrecoUseCase);

    await useCase.execute({
      rotaId: 'rota-1',
      usuarioId: 'usuario-1',
      precoAlvo: '900.00',
    });

    expect(avaliarAlertaPrecoUseCase.execute).toHaveBeenCalledWith(
      rota,
      historico,
    );
  });

  it('mantém o alerta salvo quando a avaliação imediata falha', async () => {
    const rota = { id: 'rota-1', usuarioId: 'usuario-1' } as never;
    const historico = { preco: '811.00', companhia: 'GOL' };
    const alertaSalvo = {
      id: 'alerta-1',
      rotaId: 'rota-1',
      precoAlvo: '900.00',
      disparado: false,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    repositorio.buscarPorId.mockResolvedValue(rota);
    repositorio.salvarAlertaPreco.mockResolvedValue(alertaSalvo);
    repositorio.listarHistorico.mockResolvedValue([historico] as never);
    avaliarAlertaPrecoUseCase.execute.mockRejectedValue(
      new Error('falha ao notificar'),
    );
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const modulo = await Test.createTestingModule({
      providers: [
        ConfigurarAlertaPrecoUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
        {
          provide: AvaliarAlertaPrecoUseCase,
          useValue: avaliarAlertaPrecoUseCase,
        },
      ],
    }).compile();
    const useCase = modulo.get(ConfigurarAlertaPrecoUseCase);

    await expect(
      useCase.execute({
        rotaId: 'rota-1',
        usuarioId: 'usuario-1',
        precoAlvo: '900.00',
      }),
    ).resolves.toEqual(alertaSalvo);
    expect(errorLog).toHaveBeenCalledWith(
      JSON.stringify({
        evento: 'avaliacao_alerta_ao_configurar_falhou',
        rotaId: 'rota-1',
      }),
    );
    errorLog.mockRestore();
  });

  it('informa quando a rota não existe', async () => {
    repositorio.buscarPorId.mockResolvedValue(null);
    const modulo = await Test.createTestingModule({
      providers: [
        ConfigurarAlertaPrecoUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
        {
          provide: AvaliarAlertaPrecoUseCase,
          useValue: avaliarAlertaPrecoUseCase,
        },
      ],
    }).compile();
    const useCase = modulo.get(ConfigurarAlertaPrecoUseCase);

    await expect(
      useCase.execute({ rotaId: 'rota-inexistente', precoAlvo: '1500.00' }),
    ).rejects.toMatchObject({
      message: MENSAGENS_ERRO.rotaNaoEncontrada,
      status: new NotFoundException().getStatus(),
    });
  });
});
