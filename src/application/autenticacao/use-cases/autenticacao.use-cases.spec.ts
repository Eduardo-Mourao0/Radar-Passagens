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
    vincularTelegramNaVerificacao: jest.fn(),
    buscarVerificacaoVinculadaAoTelegram: jest.fn(),
    criar: jest.fn(),
    marcarVerificacaoComoVerificada: jest.fn(),
  } as unknown as jest.Mocked<UsuariosRepository>;
  const configService = {
    getOrThrow: jest.fn(() => 'RadarPassagensBot'),
  } as unknown as ConfigService;
  const sessaoService = {
    criar: jest.fn(),
  } as unknown as SessaoService;
  const solicitadorContato = { solicitarContato: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('inicia um cadastro com link único do Telegram', async () => {
    usuariosRepository.buscarPorTelefone.mockResolvedValue(null);
    usuariosRepository.contarVerificacoesRecentes.mockResolvedValue(0);
    usuariosRepository.criarVerificacao.mockImplementation((dados) => ({
      id: 'verificacao-1',
      ...dados,
      senhaHash: dados.senhaHash ?? null,
      telegramChatId: null,
      telegramUsuarioId: null,
      verificadaEm: null,
      consumidaEm: null,
      criadoEm: new Date(),
    }));
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
      telefoneVerificadoEm: new Date(),
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

  it('vincula o chat e solicita o contato após /start', async () => {
    const verificacao = {
      id: 'verificacao-1',
      telefone: '+5561999999999',
      finalidade: 'CADASTRO',
      senhaHash: 'hash',
      tokenInicio: 'token-inicio',
      telegramChatId: null,
      telegramUsuarioId: null,
      verificadaEm: null,
      consumidaEm: null,
      expiraEm: new Date(Date.now() + 60_000),
      criadoEm: new Date(),
    } satisfies VerificacaoTelefone;
    usuariosRepository.buscarVerificacaoPorTokenInicio.mockResolvedValue(
      verificacao,
    );
    const useCase = new ProcessarAtualizacaoTelegramUseCase(
      usuariosRepository,
      solicitadorContato,
    );

    await useCase.iniciar({
      tokenInicio: verificacao.tokenInicio,
      chatId: '123456',
      telegramUsuarioId: '654321',
    });

    expect(
      usuariosRepository.vincularTelegramNaVerificacao,
    ).toHaveBeenCalledWith(verificacao.id, '123456', '654321');
    expect(solicitadorContato.solicitarContato).toHaveBeenCalledWith('123456');
  });

  it('recusa contato compartilhado que pertence a outra conta do Telegram', async () => {
    const useCase = new ProcessarAtualizacaoTelegramUseCase(
      usuariosRepository,
      solicitadorContato,
    );

    await useCase.confirmarContato({
      telefone: '5561999999999',
      chatId: '123456',
      telegramUsuarioId: '654321',
      contatoUsuarioId: 'outro-usuario',
    });

    expect(
      usuariosRepository.buscarVerificacaoVinculadaAoTelegram,
    ).not.toHaveBeenCalled();
    expect(usuariosRepository.criar).not.toHaveBeenCalled();
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
