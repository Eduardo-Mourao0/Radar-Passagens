/* eslint-disable @typescript-eslint/unbound-method */
import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Usuario } from '../../domain/usuarios/entities/usuario.entity';
import type { UsuariosRepository } from '../../domain/usuarios/repositories/usuarios.repository';
import { SessaoService } from './sessao.service';

describe('SessaoService', () => {
  const usuario = {
    id: '78bb7e21-1d94-4b62-9b7a-0e7fc15e85a8',
    telefone: '+5561999999999',
    senhaHash: 'hash',
    telegramChatId: '123456',
    telefoneVerificadoEm: new Date(),
    tentativasLoginFalhas: 0,
    bloqueadoAte: null,
  } satisfies Usuario;
  const usuariosRepository = {
    buscarRefreshTokenPorId: jest.fn(),
    buscarPorId: jest.fn(),
    consumirRefreshToken: jest.fn(),
    revogarRefreshTokensDoUsuario: jest.fn(),
    criarRefreshToken: jest.fn(),
  } as unknown as jest.Mocked<UsuariosRepository>;
  const configService = {
    getOrThrow: jest.fn(() => 'segredo-de-teste'),
  } as unknown as ConfigService;

  beforeEach(() => jest.clearAllMocks());

  it('revoga todas as sessões quando detecta reutilização de refresh token', async () => {
    const segredo = 'segredo-do-refresh';
    usuariosRepository.buscarRefreshTokenPorId.mockResolvedValue({
      id: '76d8a7e0-a8b4-4205-8105-fd99f4d5fec7',
      usuarioId: usuario.id,
      tokenHash: await argon2.hash(segredo, { type: argon2.argon2id }),
      expiraEm: new Date(Date.now() + 60_000),
      revogadoEm: null,
    });
    usuariosRepository.buscarPorId.mockResolvedValue(usuario);
    usuariosRepository.consumirRefreshToken.mockResolvedValue(false);
    const service = new SessaoService(configService, usuariosRepository);

    await expect(
      service.renovar(
        '76d8a7e0-a8b4-4205-8105-fd99f4d5fec7.segredo-do-refresh',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(
      usuariosRepository.revogarRefreshTokensDoUsuario,
    ).toHaveBeenCalledWith(usuario.id, expect.any(Date));
  });
});
