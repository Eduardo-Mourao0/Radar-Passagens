import * as argon2 from 'argon2';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { UsuarioEntity } from '../../../domain/usuarios/entities/usuario.entity';
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import { SessaoService } from '../../../infra/autenticacao/sessao.service';

@Injectable()
export class RedefinirPinUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
    private readonly sessaoService: SessaoService,
  ) {}

  async execute(tokenRedefinicao: string, pin: string): Promise<void> {
    UsuarioEntity.validarPin(pin);
    const payload =
      this.sessaoService.validarTokenRedefinicao(tokenRedefinicao);
    const verificacao = await this.usuariosRepository.buscarVerificacaoPorId(
      payload.verificacaoId,
    );
    if (
      !verificacao ||
      verificacao.finalidade !== 'RECUPERACAO' ||
      verificacao.consumidaEm ||
      !verificacao.verificadaEm ||
      verificacao.expiraEm <= new Date()
    ) {
      throw new UnauthorizedException(
        MENSAGENS_ERRO.verificacaoTelefoneInvalida,
      );
    }

    const usuario = await this.usuariosRepository.buscarPorId(payload.sub);
    if (!usuario || usuario.telefone !== verificacao.telefone) {
      throw new UnauthorizedException(
        MENSAGENS_ERRO.verificacaoTelefoneInvalida,
      );
    }

    const agora = new Date();
    await this.usuariosRepository.atualizarSenha(
      usuario.id,
      await argon2.hash(pin, { type: argon2.argon2id }),
    );
    await this.usuariosRepository.revogarRefreshTokensDoUsuario(
      usuario.id,
      agora,
    );
    await this.usuariosRepository.consumirVerificacao(verificacao.id, agora);
  }
}
