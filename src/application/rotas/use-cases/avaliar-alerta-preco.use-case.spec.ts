/* eslint-disable @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';
import {
  AlertaPreco,
  HistoricoPreco,
  Rota,
} from '../../../domain/rotas/entities/rota.entity';
import {
  ROTAS_REPOSITORY,
  RotasRepository,
} from '../../../domain/rotas/repositories/rotas.repository';
import {
  NOTIFICADOR_ALERTA_PRECO,
  NotificadorAlertaPreco,
} from '../ports/notificador-alerta-preco.port';
import { AvaliarAlertaPrecoUseCase } from './avaliar-alerta-preco.use-case';

describe('AvaliarAlertaPrecoUseCase', () => {
  const rota = { id: 'rota-1', origem: 'BSB', destino: 'FOR' } as Rota;
  const historico = {
    id: 'historico-1',
    rotaId: 'rota-1',
    preco: '1400.00',
    moeda: 'BRL',
    companhia: 'Azul',
    coletadoEm: new Date(),
  } as HistoricoPreco;
  const repositorio: jest.Mocked<RotasRepository> = {
    buscarPorChave: jest.fn(),
    criar: jest.fn(),
    reativar: jest.fn(),
    listar: jest.fn(),
    listarAtivas: jest.fn(),
    buscarPorId: jest.fn(),
    listarHistorico: jest.fn(),
    registrarHistoricoSeDiferente: jest.fn(),
    buscarAlertaPreco: jest.fn(),
    salvarAlertaPreco: jest.fn(),
    atualizarAlertaDisparado: jest.fn(),
  };
  const notificador: jest.Mocked<NotificadorAlertaPreco> = {
    enviar: jest.fn(),
  };
  const alerta = {
    id: 'alerta-1',
    rotaId: 'rota-1',
    precoAlvo: '1500.00',
    disparado: false,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  } as AlertaPreco;

  let useCase: AvaliarAlertaPrecoUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    notificador.enviar.mockResolvedValue(true);
    const modulo = await Test.createTestingModule({
      providers: [
        AvaliarAlertaPrecoUseCase,
        { provide: ROTAS_REPOSITORY, useValue: repositorio },
        { provide: NOTIFICADOR_ALERTA_PRECO, useValue: notificador },
      ],
    }).compile();
    useCase = modulo.get(AvaliarAlertaPrecoUseCase);
  });

  it('não faz nada quando a rota não possui alerta configurado', async () => {
    repositorio.buscarAlertaPreco.mockResolvedValue(null);

    await useCase.execute(rota, historico);

    expect(notificador.enviar).not.toHaveBeenCalled();
    expect(repositorio.atualizarAlertaDisparado).not.toHaveBeenCalled();
  });

  it('notifica e marca o alerta como disparado quando atinge o preço-alvo', async () => {
    repositorio.buscarAlertaPreco.mockResolvedValue(alerta);

    await useCase.execute(rota, historico);

    expect(notificador.enviar).toHaveBeenCalledWith({
      alerta,
      rota,
      historico,
    });
    expect(repositorio.atualizarAlertaDisparado).toHaveBeenCalledWith(
      'alerta-1',
      true,
    );
  });

  it('não repete a notificação enquanto o alerta já estiver disparado', async () => {
    repositorio.buscarAlertaPreco.mockResolvedValue({
      ...alerta,
      disparado: true,
    });

    await useCase.execute(rota, historico);

    expect(notificador.enviar).not.toHaveBeenCalled();
    expect(repositorio.atualizarAlertaDisparado).not.toHaveBeenCalled();
  });

  it('mantém o alerta pendente quando a notificação falha', async () => {
    repositorio.buscarAlertaPreco.mockResolvedValue(alerta);
    notificador.enviar.mockResolvedValue(false);

    await useCase.execute(rota, historico);

    expect(repositorio.atualizarAlertaDisparado).not.toHaveBeenCalled();
  });

  it('rearma o alerta quando o preço volta a ficar acima da meta', async () => {
    repositorio.buscarAlertaPreco.mockResolvedValue({
      ...alerta,
      disparado: true,
    });

    await useCase.execute(rota, { ...historico, preco: '1600.00' });

    expect(notificador.enviar).not.toHaveBeenCalled();
    expect(repositorio.atualizarAlertaDisparado).toHaveBeenCalledWith(
      'alerta-1',
      false,
    );
  });
});
