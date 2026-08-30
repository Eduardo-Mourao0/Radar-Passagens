import { Test } from '@nestjs/testing';
import { PriceCheckJob } from '../../../application/rotas/jobs/price-check.job';
import { CriarRotaUseCase } from '../../../application/rotas/use-cases/criar-rota.use-case';
import { DesativarRotaUseCase } from '../../../application/rotas/use-cases/desativar-rota.use-case';
import { ExcluirRotaUseCase } from '../../../application/rotas/use-cases/excluir-rota.use-case';
import { ConfigurarAlertaPrecoUseCase } from '../../../application/rotas/use-cases/configurar-alerta-preco.use-case';
import { ListarHistoricoRotaUseCase } from '../../../application/rotas/use-cases/listar-historico-rota.use-case';
import { ListarRotasUseCase } from '../../../application/rotas/use-cases/listar-rotas.use-case';
import { ReativarRotaUseCase } from '../../../application/rotas/use-cases/reativar-rota.use-case';
import { ObterLinksCompraRotaUseCase } from '../../../application/rotas/use-cases/obter-links-compra-rota.use-case';
import { RotasController } from './rotas.controller';
import { AutenticacaoGuard } from '../guards/autenticacao.guard';
import { SessaoService } from '../../autenticacao/sessao.service';

describe('RotasController', () => {
  const criarRotaUseCase = { execute: jest.fn() };
  const desativarRotaUseCase = { execute: jest.fn() };
  const excluirRotaUseCase = { execute: jest.fn() };
  const reativarRotaUseCase = { execute: jest.fn() };
  const configurarAlertaPrecoUseCase = { execute: jest.fn() };
  const listarRotasUseCase = { execute: jest.fn() };
  const listarHistoricoRotaUseCase = { execute: jest.fn() };
  const obterLinksCompraRotaUseCase = { execute: jest.fn() };
  const priceCheckJob = { executar: jest.fn() };
  const autenticacaoGuard = { canActivate: jest.fn(() => true) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executa a verificação manual fora de produção', async () => {
    priceCheckJob.executar.mockResolvedValue(undefined);
    const modulo = await Test.createTestingModule({
      controllers: [RotasController],
      providers: [
        { provide: CriarRotaUseCase, useValue: criarRotaUseCase },
        { provide: DesativarRotaUseCase, useValue: desativarRotaUseCase },
        { provide: ExcluirRotaUseCase, useValue: excluirRotaUseCase },
        { provide: ReativarRotaUseCase, useValue: reativarRotaUseCase },
        {
          provide: ConfigurarAlertaPrecoUseCase,
          useValue: configurarAlertaPrecoUseCase,
        },
        { provide: ListarRotasUseCase, useValue: listarRotasUseCase },
        {
          provide: ListarHistoricoRotaUseCase,
          useValue: listarHistoricoRotaUseCase,
        },
        {
          provide: ObterLinksCompraRotaUseCase,
          useValue: obterLinksCompraRotaUseCase,
        },
        { provide: PriceCheckJob, useValue: priceCheckJob },
        { provide: AutenticacaoGuard, useValue: autenticacaoGuard },
        { provide: SessaoService, useValue: { validarAccessToken: jest.fn() } },
      ],
    }).compile();
    const controller = modulo.get(RotasController);

    await expect(controller.verificarPrecos()).resolves.toEqual({
      mensagem: 'Verificação de preços concluída.',
    });
    expect(priceCheckJob.executar).toHaveBeenCalledTimes(1);
  });

  it('executa a verificação manual em produção para usuário autenticado', async () => {
    priceCheckJob.executar.mockResolvedValue(undefined);
    const modulo = await Test.createTestingModule({
      controllers: [RotasController],
      providers: [
        { provide: CriarRotaUseCase, useValue: criarRotaUseCase },
        { provide: DesativarRotaUseCase, useValue: desativarRotaUseCase },
        { provide: ExcluirRotaUseCase, useValue: excluirRotaUseCase },
        { provide: ReativarRotaUseCase, useValue: reativarRotaUseCase },
        {
          provide: ConfigurarAlertaPrecoUseCase,
          useValue: configurarAlertaPrecoUseCase,
        },
        { provide: ListarRotasUseCase, useValue: listarRotasUseCase },
        {
          provide: ListarHistoricoRotaUseCase,
          useValue: listarHistoricoRotaUseCase,
        },
        {
          provide: ObterLinksCompraRotaUseCase,
          useValue: obterLinksCompraRotaUseCase,
        },
        { provide: PriceCheckJob, useValue: priceCheckJob },
        { provide: AutenticacaoGuard, useValue: autenticacaoGuard },
        { provide: SessaoService, useValue: { validarAccessToken: jest.fn() } },
      ],
    }).compile();
    const controller = modulo.get(RotasController);

    await expect(controller.verificarPrecos()).resolves.toEqual({
      mensagem: 'Verificação de preços concluída.',
    });
    expect(priceCheckJob.executar).toHaveBeenCalledTimes(1);
  });
});
