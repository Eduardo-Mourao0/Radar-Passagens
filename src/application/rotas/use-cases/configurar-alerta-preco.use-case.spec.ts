/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import {
  ROTAS_REPOSITORY,
  RotasRepository,
} from '../../../domain/rotas/repositories/rotas.repository';
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
    registrarHistoricoSeDiferente: jest.fn(),
    buscarAlertaPreco: jest.fn(),
    salvarAlertaPreco: jest.fn(),
    atualizarAlertaDisparado: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('configura um alerta e normaliza o preço-alvo', async () => {
    repositorio.buscarPorId.mockResolvedValue({ id: 'rota-1' } as never);
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
      ],
    }).compile();
    const useCase = modulo.get(ConfigurarAlertaPrecoUseCase);

    await expect(
      useCase.execute({ rotaId: 'rota-1', precoAlvo: '1500.5' }),
    ).resolves.toMatchObject({ precoAlvo: '1500.50' });
    expect(repositorio.salvarAlertaPreco).toHaveBeenCalledWith({
      rotaId: 'rota-1',
      precoAlvo: '1500.50',
    });
  });

  it('informa quando a rota não existe', async () => {
    repositorio.buscarPorId.mockResolvedValue(null);
    const modulo = await Test.createTestingModule({
      providers: [
        ConfigurarAlertaPrecoUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
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
