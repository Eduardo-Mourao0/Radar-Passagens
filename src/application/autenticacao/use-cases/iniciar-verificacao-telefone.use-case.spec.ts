/* eslint-disable @typescript-eslint/unbound-method */
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import { LimiteAutenticacaoService } from '../../../infra/autenticacao/limite-autenticacao.service';
import { IniciarVerificacaoTelefoneUseCase } from './iniciar-verificacao-telefone.use-case';

describe('IniciarVerificacaoTelefoneUseCase', () => {
  const usuariosRepository = {
    contarVerificacoesRecentes: jest.fn(),
  } as unknown as jest.Mocked<UsuariosRepository>;
  const configService = {
    getOrThrow: jest.fn(),
  } as unknown as ConfigService;

  beforeEach(() => jest.clearAllMocks());

  it('bloqueia a sexta verificacao criada nos ultimos cinco minutos', async () => {
    usuariosRepository.contarVerificacoesRecentes.mockResolvedValue(5);
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
    ).rejects.toBeInstanceOf(HttpException);

    expect(usuariosRepository.contarVerificacoesRecentes).toHaveBeenCalledWith(
      '+5561999999999',
      'CADASTRO',
      expect.any(Date),
    );
  });
});
