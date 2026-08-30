import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { AutenticarUsuarioUseCase } from '../../../application/autenticacao/use-cases/autenticar-usuario.use-case';
import { ConfirmarCodigoTelegramUseCase } from '../../../application/autenticacao/use-cases/confirmar-codigo-telegram.use-case';
import { IniciarVerificacaoTelefoneUseCase } from '../../../application/autenticacao/use-cases/iniciar-verificacao-telefone.use-case';
import { ObterStatusVerificacaoUseCase } from '../../../application/autenticacao/use-cases/obter-status-verificacao.use-case';
import { ProcessarAtualizacaoTelegramUseCase } from '../../../application/autenticacao/use-cases/processar-atualizacao-telegram.use-case';
import { RedefinirPinUseCase } from '../../../application/autenticacao/use-cases/redefinir-pin.use-case';
import { SessaoService } from '../../autenticacao/sessao.service';
import { AutenticacaoController } from './autenticacao.controller';

describe('AutenticacaoController', () => {
  const processarAtualizacaoTelegram = { iniciar: jest.fn() };
  const confirmarCodigoTelegram = { execute: jest.fn() };
  let controller: AutenticacaoController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      controllers: [AutenticacaoController],
      providers: [
        { provide: IniciarVerificacaoTelefoneUseCase, useValue: {} },
        {
          provide: ConfirmarCodigoTelegramUseCase,
          useValue: confirmarCodigoTelegram,
        },
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

  it('confirma o código de verificação', async () => {
    await expect(
      controller.confirmarCodigo(
        { id: 'c9e0e8f7-39ef-4279-87a8-2867f5db95eb' },
        {
          codigo: '123456',
        },
        { headers: {}, ip: '127.0.0.1' } as Request,
      ),
    ).resolves.toBeUndefined();

    expect(confirmarCodigoTelegram.execute).toHaveBeenCalledWith(
      'c9e0e8f7-39ef-4279-87a8-2867f5db95eb',
      '123456',
      '127.0.0.1',
    );
  });
});
