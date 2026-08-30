import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AutenticarUsuarioUseCase } from '../../../application/autenticacao/use-cases/autenticar-usuario.use-case';
import { IniciarVerificacaoTelefoneUseCase } from '../../../application/autenticacao/use-cases/iniciar-verificacao-telefone.use-case';
import { ObterStatusVerificacaoUseCase } from '../../../application/autenticacao/use-cases/obter-status-verificacao.use-case';
import { ProcessarAtualizacaoTelegramUseCase } from '../../../application/autenticacao/use-cases/processar-atualizacao-telegram.use-case';
import { RedefinirPinUseCase } from '../../../application/autenticacao/use-cases/redefinir-pin.use-case';
import { SessaoService } from '../../autenticacao/sessao.service';
import { AutenticacaoController } from './autenticacao.controller';

describe('AutenticacaoController', () => {
  const processarAtualizacaoTelegram = { iniciar: jest.fn() };
  let controller: AutenticacaoController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      controllers: [AutenticacaoController],
      providers: [
        { provide: IniciarVerificacaoTelefoneUseCase, useValue: {} },
        { provide: ObterStatusVerificacaoUseCase, useValue: {} },
        { provide: AutenticarUsuarioUseCase, useValue: {} },
        { provide: RedefinirPinUseCase, useValue: {} },
        {
          provide: ProcessarAtualizacaoTelegramUseCase,
          useValue: processarAtualizacaoTelegram,
        },
        { provide: SessaoService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn(() => 'segredo') },
        },
      ],
    }).compile();
    controller = modulo.get(AutenticacaoController);
  });

  it('encaminha /start simples para o caso de uso', async () => {
    await controller.webhookTelegram('segredo', {
      message: {
        text: '/start',
        chat: { id: 123456, type: 'private' },
        from: { id: 654321 },
      },
    });

    expect(processarAtualizacaoTelegram.iniciar).toHaveBeenCalledWith({
      chatId: '123456',
      telegramUsuarioId: '654321',
      tokenInicio: undefined,
    });
  });

  it.each([
    { texto: '/start@RadarPassagensBot', tokenInicio: undefined },
    {
      texto: `/start@RadarPassagensBot ${'a'.repeat(43)}`,
      tokenInicio: 'a'.repeat(43),
    },
  ])('encaminha $texto para o caso de uso', async ({ texto, tokenInicio }) => {
    await controller.webhookTelegram('segredo', {
      message: {
        text: texto,
        chat: { id: 123456, type: 'private' },
        from: { id: 654321 },
      },
    });

    expect(processarAtualizacaoTelegram.iniciar).toHaveBeenCalledWith({
      chatId: '123456',
      telegramUsuarioId: '654321',
      tokenInicio,
    });
  });

  it('ignora /start com token fora do formato esperado', async () => {
    await controller.webhookTelegram('segredo', {
      message: {
        text: '/start token-invalido',
        chat: { id: 123456, type: 'private' },
        from: { id: 654321 },
      },
    });

    expect(processarAtualizacaoTelegram.iniciar).not.toHaveBeenCalled();
  });
});
