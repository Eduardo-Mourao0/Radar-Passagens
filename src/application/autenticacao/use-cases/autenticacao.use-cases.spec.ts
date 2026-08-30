/* eslint-disable @typescript-eslint/unbound-method */
import * as argon2 from 'argon2';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import type {
  Usuario,
  VerificacaoTelefone,
} from '../../../domain/usuarios/entities/usuario.entity';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import { LimiteAutenticacaoService } from '../../../infra/autenticacao/limite-autenticacao.service';
import { SessaoService } from '../../../infra/autenticacao/sessao.service';
import { AutenticarUsuarioUseCase } from './autenticar-usuario.use-case';
import { IniciarVerificacaoTelefoneUseCase } from './iniciar-verificacao-telefone.use-case';
import { ProcessarAtualizacaoTelegramUseCase } from './processar-atualizacao-telegram.use-case';

describe('Casos de uso de autenticação', () => {
  const usuariosRepository = {
    buscarPorTelefone: jest.fn(),
    contarVerificacoesRecentes: jest.fn(),
    criarVerificacao: jest.fn(),
    atualizarTentativasLogin: jest.fn(),
    buscarVerificacaoPorTokenInicio: jest.fn(),
    prepararCodigoTelegram: jest.fn(),
    cancelarCodigoTelegram: jest.fn(),
  } as unknown as jest.Mocked<UsuariosRepository>;
  const configService = {
    getOrThrow: jest.fn(() => 'RadarPassagensBot'),
  } as unknown as ConfigService;
  const sessaoService = { criar: jest.fn() } as unknown as SessaoService;
  const mensageiroTelegram = { enviarMensagem: jest.fn() };

  const criarVerificacao = (
    dados: Partial<VerificacaoTelefone> = {},
  ): VerificacaoTelefone => ({
    id: 'verificacao-1',
    telefone: '+5561999999999',
    finalidade: 'CADASTRO',
    senhaHash: 'hash',
    tokenInicio: 'token-inicio',
    telegramChatId: null,
    telegramUsuarioId: null,
    codigoHash: null,
    tentativasCodigo: 0,
    codigoEnviadoEm: null,
    verificadaEm: null,
    consumidaEm: null,
    expiraEm: new Date(Date.now() + 60_000),
    criadoEm: new Date(),
    ...dados,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuariosRepository.prepararCodigoTelegram.mockResolvedValue(true);
  });

  it('inicia um cadastro com link único do Telegram', async () => {
    usuariosRepository.buscarPorTelefone.mockResolvedValue(null);
    usuariosRepository.contarVerificacoesRecentes.mockResolvedValue(0);
    usuariosRepository.criarVerificacao.mockResolvedValue(criarVerificacao());
    const useCase = new IniciarVerificacaoTelefoneUseCase(
      usuariosRepository,
      new LimiteAutenticacaoService(),
      configService,
    );

    const resultado = await useCase.execute({
      telefone: '+55 (61) 99999-9999',
      pin: '1234',
      ip: '127.0.0.1',
      finalidade: 'CADASTRO',
    });

    expect(resultado.urlTelegram).toMatch(
      /^https:\/\/t\.me\/RadarPassagensBot\?start=/,
    );
    expect(usuariosRepository.criarVerificacao).toHaveBeenCalledWith(
      expect.objectContaining({
        telefone: '+5561999999999',
        finalidade: 'CADASTRO',
      }),
    );
  });

  it('recusa cadastrar um telefone que já possui conta', async () => {
    usuariosRepository.buscarPorTelefone.mockResolvedValue({ id: 'usuario-1' });
    usuariosRepository.contarVerificacoesRecentes.mockResolvedValue(0);
    const useCase = new IniciarVerificacaoTelefoneUseCase(
      usuariosRepository,
      new LimiteAutenticacaoService(),
      configService,
    );

    await expect(
      useCase.execute({
        telefone: '+5561999999999',
        pin: '1234',
        ip: '127.0.0.1',
        finalidade: 'CADASTRO',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('bloqueia após cinco PINs inválidos', async () => {
    const usuario = {
      id: 'usuario-1',
      telefone: '+5561999999999',
      senhaHash: await argon2.hash('1234', { type: argon2.argon2id }),
      telegramChatId: '123456',
      verificadoEm: new Date(),
      tentativasLoginFalhas: 4,
      bloqueadoAte: null,
    } satisfies Usuario;
    usuariosRepository.buscarPorTelefone.mockResolvedValue(usuario);
    const useCase = new AutenticarUsuarioUseCase(
      usuariosRepository,
      sessaoService,
    );

    await expect(
      useCase.execute(usuario.telefone, '9999'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usuariosRepository.atualizarTentativasLogin).toHaveBeenCalledWith(
      usuario.id,
      0,
      expect.any(Date),
    );
  });

  it('vincula o chat e envia um código após /start', async () => {
    const verificacao = criarVerificacao();
    usuariosRepository.buscarVerificacaoPorTokenInicio.mockResolvedValue(
      verificacao,
    );
    const useCase = new ProcessarAtualizacaoTelegramUseCase(
      usuariosRepository,
      mensageiroTelegram,
    );

    await useCase.iniciar({
      tokenInicio: verificacao.tokenInicio,
      chatId: '123456',
      telegramUsuarioId: '654321',
    });

    expect(usuariosRepository.prepararCodigoTelegram).toHaveBeenCalledWith(
      expect.objectContaining({
        verificacaoId: verificacao.id,
        telegramChatId: '123456',
        telegramUsuarioId: '654321',
        codigoHash: expect.any(String),
      }),
    );
    expect(mensageiroTelegram.enviarMensagem).toHaveBeenCalledWith(
      '123456',
      expect.stringMatching(/^Seu código de verificação é: \d{6}$/),
    );
  });

  it('não reenvia o código antes de um minuto', async () => {
    const verificacao = criarVerificacao({ codigoEnviadoEm: new Date() });
    usuariosRepository.buscarVerificacaoPorTokenInicio.mockResolvedValue(
      verificacao,
    );
    const useCase = new ProcessarAtualizacaoTelegramUseCase(
      usuariosRepository,
      mensageiroTelegram,
    );

    await useCase.iniciar({
      tokenInicio: verificacao.tokenInicio,
      chatId: '123456',
      telegramUsuarioId: '654321',
    });

    expect(usuariosRepository.prepararCodigoTelegram).not.toHaveBeenCalled();
    expect(mensageiroTelegram.enviarMensagem).toHaveBeenCalledWith(
      '123456',
      expect.stringContaining('recentemente'),
    );
  });

  it('descarta o código se o Telegram não conseguir enviá-lo', async () => {
    const verificacao = criarVerificacao();
    usuariosRepository.buscarVerificacaoPorTokenInicio.mockResolvedValue(
      verificacao,
    );
    mensageiroTelegram.enviarMensagem.mockRejectedValueOnce(
      new Error('falha de rede'),
    );
    const useCase = new ProcessarAtualizacaoTelegramUseCase(
      usuariosRepository,
      mensageiroTelegram,
    );

    await expect(
      useCase.iniciar({
        tokenInicio: verificacao.tokenInicio,
        chatId: '123456',
        telegramUsuarioId: '654321',
      }),
    ).rejects.toThrow('falha de rede');

    expect(usuariosRepository.cancelarCodigoTelegram).toHaveBeenCalledWith(
      verificacao.id,
      expect.any(String),
    );
  });

  it('orienta o usuário quando recebe /start sem link de confirmação', async () => {
    const useCase = new ProcessarAtualizacaoTelegramUseCase(
      usuariosRepository,
      mensageiroTelegram,
    );

    await useCase.iniciar({ chatId: '123456', telegramUsuarioId: '654321' });

    expect(mensageiroTelegram.enviarMensagem).toHaveBeenCalledWith(
      '123456',
      expect.stringContaining('link de confirmação'),
    );
    expect(
      usuariosRepository.buscarVerificacaoPorTokenInicio,
    ).not.toHaveBeenCalled();
  });

  it('mantém mensagem genérica para credenciais inexistentes', async () => {
    usuariosRepository.buscarPorTelefone.mockResolvedValue(null);
    const useCase = new AutenticarUsuarioUseCase(
      usuariosRepository,
      sessaoService,
    );

    await expect(
      useCase.execute('+5561999999999', '1234'),
    ).rejects.toMatchObject({
      message: MENSAGENS_ERRO.credenciaisInvalidas,
    });
  });
});
