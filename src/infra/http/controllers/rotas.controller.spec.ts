import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PriceCheckJob } from '../../../application/rotas/jobs/price-check.job';
import { CriarRotaUseCase } from '../../../application/rotas/use-cases/criar-rota.use-case';
import { ListarHistoricoRotaUseCase } from '../../../application/rotas/use-cases/listar-historico-rota.use-case';
import { ListarRotasUseCase } from '../../../application/rotas/use-cases/listar-rotas.use-case';
import { RotasController } from './rotas.controller';

describe('RotasController', () => {
  const criarRotaUseCase = { execute: jest.fn() };
  const listarRotasUseCase = { execute: jest.fn() };
  const listarHistoricoRotaUseCase = { execute: jest.fn() };
  const priceCheckJob = { executar: jest.fn() };
  const configService = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executa a verificação manual fora de produção', async () => {
    configService.get.mockReturnValue('development');
    priceCheckJob.executar.mockResolvedValue(undefined);
    const modulo = await Test.createTestingModule({
      controllers: [RotasController],
      providers: [
        { provide: CriarRotaUseCase, useValue: criarRotaUseCase },
        { provide: ListarRotasUseCase, useValue: listarRotasUseCase },
        {
          provide: ListarHistoricoRotaUseCase,
          useValue: listarHistoricoRotaUseCase,
        },
        { provide: PriceCheckJob, useValue: priceCheckJob },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    const controller = modulo.get(RotasController);

    await expect(controller.verificarPrecos()).resolves.toEqual({
      mensagem: 'Verificação de preços concluída.',
    });
    expect(priceCheckJob.executar).toHaveBeenCalledTimes(1);
  });

  it('bloqueia a verificação manual em produção', async () => {
    configService.get.mockReturnValue('production');
    const modulo = await Test.createTestingModule({
      controllers: [RotasController],
      providers: [
        { provide: CriarRotaUseCase, useValue: criarRotaUseCase },
        { provide: ListarRotasUseCase, useValue: listarRotasUseCase },
        {
          provide: ListarHistoricoRotaUseCase,
          useValue: listarHistoricoRotaUseCase,
        },
        { provide: PriceCheckJob, useValue: priceCheckJob },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    const controller = modulo.get(RotasController);

    await expect(controller.verificarPrecos()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(priceCheckJob.executar).not.toHaveBeenCalled();
  });
});
