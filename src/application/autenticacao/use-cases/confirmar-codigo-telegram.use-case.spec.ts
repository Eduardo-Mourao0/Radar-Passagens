import * as argon2 from 'argon2';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { VerificacaoTelefone } from '../../../domain/usuarios/entities/usuario.entity';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import { LimiteAutenticacaoService } from '../../../infra/autenticacao/limite-autenticacao.service';
import { ConfirmarCodigoTelegramUseCase } from './confirmar-codigo-telegram.use-case';

describe('ConfirmarCodigoTelegramUseCase', () => {
  const usuariosRepository = {
    buscarVerificacaoPorId: jest.fn(),
    incrementarTentativasCodigo: jest.fn(),
    finalizarVerificacaoPorCodigo: jest.fn(),
  } as unknown as jest.Mocked<UsuariosRepository>;

  const criarVerificacao = async (): Promise<VerificacaoTelefone> => ({
    id: 'verificacao-1',
    telefone: '+5561999999999',
    finalidade: 'CADASTRO',
    senhaHash: 'hash',
    tokenInicio: 'token-inicio',
    telegramChatId: '123456',
    telegramUsuarioId: '654321',
    codigoHash: await argon2.hash('123456', { type: argon2.argon2id }),
    tentativasCodigo: 0,
    codigoEnviadoEm: new Date(),
    verificadaEm: null,
    consumidaEm: null,
    expiraEm: new Date(Date.now() + 60_000),
    criadoEm: new Date(),
  });

  beforeEach(() => jest.clearAllMocks());

  const criarUseCase = () =>
    new ConfirmarCodigoTelegramUseCase(
      usuariosRepository,
      new LimiteAutenticacaoService(),
    );

  it('finaliza a verificação com o código correto', async () => {
    const verificacao = await criarVerificacao();
    usuariosRepository.buscarVerificacaoPorId.mockResolvedValue(verificacao);
    usuariosRepository.finalizarVerificacaoPorCodigo.mockResolvedValue(
      'VERIFICADA',
    );
    const useCase = criarUseCase();

    await expect(
      useCase.execute(verificacao.id, '123456', '127.0.0.1'),
    ).resolves.toBeUndefined();
    expect(
      usuariosRepository.finalizarVerificacaoPorCodigo,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        verificacaoId: verificacao.id,
        codigoHash: verificacao.codigoHash,
      }),
    );
  });

  it('registra uma tentativa para código incorreto', async () => {
    const verificacao = await criarVerificacao();
    usuariosRepository.buscarVerificacaoPorId.mockResolvedValue(verificacao);
    const useCase = criarUseCase();

    await expect(
      useCase.execute(verificacao.id, '000000', '127.0.0.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usuariosRepository.incrementarTentativasCodigo).toHaveBeenCalledWith(
      verificacao.id,
      expect.any(Date),
      5,
    );
  });

  it('recusa uma verificação que já excedeu as tentativas', async () => {
    const verificacao = await criarVerificacao();
    usuariosRepository.buscarVerificacaoPorId.mockResolvedValue({
      ...verificacao,
      tentativasCodigo: 5,
    });
    const useCase = criarUseCase();

    await expect(
      useCase.execute(verificacao.id, '123456', '127.0.0.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(
      usuariosRepository.incrementarTentativasCodigo,
    ).not.toHaveBeenCalled();
  });

  it('informa conflito se o telefone for cadastrado durante a confirmação', async () => {
    const verificacao = await criarVerificacao();
    usuariosRepository.buscarVerificacaoPorId.mockResolvedValue(verificacao);
    usuariosRepository.finalizarVerificacaoPorCodigo.mockResolvedValue(
      'TELEFONE_JA_CADASTRADO',
    );
    const useCase = criarUseCase();

    await expect(
      useCase.execute(verificacao.id, '123456', '127.0.0.1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
