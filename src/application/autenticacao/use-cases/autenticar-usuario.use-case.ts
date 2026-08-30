import * as argon2 from 'argon2';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { UsuarioEntity } from '../../../domain/usuarios/entities/usuario.entity';
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import { SessaoService } from '../../../infra/autenticacao/sessao.service';

@Injectable()
export class AutenticarUsuarioUseCase {
  private static readonly MAXIMO_TENTATIVAS = 5;
  private static readonly BLOQUEIO_MS = 15 * 60 * 1000;
  // Gerado com argon2.hash('0000', { type: argon2.argon2id }).
  private static readonly HASH_PIN_INEXISTENTE =
    '$argon2id$v=19$m=65536,p=4,t=3$AekrjfWEK+YXJ9AyWp0Ccw$HdHVsVk/uP2fRuxeOcMzotyu0Xv9OgOj0sDB1FDTbC8';

  constructor(
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
    private readonly sessaoService: SessaoService,
  ) {}

  async execute(telefoneInformado: string, pin: string) {
    const telefone = UsuarioEntity.normalizarTelefone(telefoneInformado);
    UsuarioEntity.validarPin(pin);
    const usuario = await this.usuariosRepository.buscarPorTelefone(telefone);
    if (!usuario) {
      await argon2.verify(AutenticarUsuarioUseCase.HASH_PIN_INEXISTENTE, pin);
      throw new UnauthorizedException(MENSAGENS_ERRO.credenciaisInvalidas);
    }

    if (UsuarioEntity.estaBloqueado(usuario)) {
      throw new UnauthorizedException(
        MENSAGENS_ERRO.contaTemporariamenteBloqueada,
      );
    }

    if (!(await argon2.verify(usuario.senhaHash, pin))) {
      const tentativas = usuario.tentativasLoginFalhas + 1;
      await this.usuariosRepository.atualizarTentativasLogin(
        usuario.id,
        tentativas >= AutenticarUsuarioUseCase.MAXIMO_TENTATIVAS
          ? 0
          : tentativas,
        tentativas >= AutenticarUsuarioUseCase.MAXIMO_TENTATIVAS
          ? new Date(Date.now() + AutenticarUsuarioUseCase.BLOQUEIO_MS)
          : null,
      );
      throw new UnauthorizedException(MENSAGENS_ERRO.credenciaisInvalidas);
    }

    if (usuario.tentativasLoginFalhas || usuario.bloqueadoAte) {
      await this.usuariosRepository.atualizarTentativasLogin(
        usuario.id,
        0,
        null,
      );
    }

    return this.sessaoService.criar(usuario);
  }
}
