import { ConflictException } from '@nestjs/common';
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
import { VerificarPrecoRotaUseCase } from '../../../application/rotas/use-cases/verificar-preco-rota.use-case';
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
  const verificarPrecoRotaUseCase = { executarParaUsuario: jest.fn() };
  const autenticacaoGuard = { canActivate: jest.fn(() => true) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executa a verificação manual fora de produção', async () => {
    priceCheckJob.executar.mockResolvedValue([
      {
        rotaId: 'rota-1',
        situacao: 'ATUALIZADA',
        ultimoPreco: { preco: '350.00' },
      },
    ]);
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
        {
          provide: VerificarPrecoRotaUseCase,
          useValue: verificarPrecoRotaUseCase,
        },
        { provide: AutenticacaoGuard, useValue: autenticacaoGuard },
        { provide: SessaoService, useValue: { validarAccessToken: jest.fn() } },
      ],
    }).compile();
    const controller = modulo.get(RotasController);

    await expect(controller.verificarPrecos()).resolves.toEqual({
      mensagem: 'Verificação de preços concluída.',
      rotas: [
        {
          rotaId: 'rota-1',
          situacao: 'ATUALIZADA',
          ultimoPreco: { preco: '350.00' },
        },
      ],
    });
    expect(priceCheckJob.executar).toHaveBeenCalledWith({
      repetirLinks: false,
    });

    let concluirVerificacao: ((rotas: []) => void) | undefined;
    priceCheckJob.executar.mockImplementationOnce(
      () =>
        new Promise<[]>((resolve) => {
          concluirVerificacao = resolve;
        }),
    );
    const primeiraVerificacao = controller.verificarPrecos();

    await expect(controller.verificarPrecos()).rejects.toBeInstanceOf(
      ConflictException,
    );
    concluirVerificacao?.([]);
    await primeiraVerificacao;
  });

  it('executa a verificação manual em produção para usuário autenticado', async () => {
    priceCheckJob.executar.mockResolvedValue([]);
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
        {
          provide: VerificarPrecoRotaUseCase,
          useValue: verificarPrecoRotaUseCase,
        },
        { provide: AutenticacaoGuard, useValue: autenticacaoGuard },
        { provide: SessaoService, useValue: { validarAccessToken: jest.fn() } },
      ],
    }).compile();
    const controller = modulo.get(RotasController);

    await expect(controller.verificarPrecos()).resolves.toEqual({
      mensagem: 'Verificação de preços concluída.',
      rotas: [],
    });
    expect(priceCheckJob.executar).toHaveBeenCalledTimes(1);
  });

  it('atualiza apenas a rota solicitada pelo usuário autenticado', async () => {
    verificarPrecoRotaUseCase.executarParaUsuario.mockResolvedValue({
      id: 'rota-1',
      situacaoCotacao: 'ATUALIZADA',
      ultimoPreco: { preco: '350.00' },
    });
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
        {
          provide: VerificarPrecoRotaUseCase,
          useValue: verificarPrecoRotaUseCase,
        },
        { provide: AutenticacaoGuard, useValue: autenticacaoGuard },
        { provide: SessaoService, useValue: { validarAccessToken: jest.fn() } },
      ],
    }).compile();
    const controller = modulo.get(RotasController);
    const request = { usuario: { id: 'usuario-1' } } as never;

    await expect(
      controller.verificarPreco({ id: 'rota-1' }, request),
    ).resolves.toEqual({
      id: 'rota-1',
      situacaoCotacao: 'ATUALIZADA',
      ultimoPreco: { preco: '350.00' },
    });
    expect(verificarPrecoRotaUseCase.executarParaUsuario).toHaveBeenCalledWith(
      'rota-1',
      'usuario-1',
    );
  });
});
