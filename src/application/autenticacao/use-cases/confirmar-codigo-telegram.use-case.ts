import * as argon2 from 'argon2';
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import { LimiteAutenticacaoService } from '../../../infra/autenticacao/limite-autenticacao.service';

@Injectable()
export class ConfirmarCodigoTelegramUseCase {
  private static readonly MAXIMO_TENTATIVAS = 5;

  constructor(
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
    private readonly limiteAutenticacao: LimiteAutenticacaoService,
  ) {}

  async execute(
    verificacaoId: string,
    codigo: string,
    ip: string,
  ): Promise<void> {
    this.limiteAutenticacao.validarConfirmacaoCodigo(ip);
    const agora = new Date();
    const verificacao =
      await this.usuariosRepository.buscarVerificacaoPorId(verificacaoId);
    if (
      !verificacao ||
      !verificacao.codigoHash ||
      verificacao.consumidaEm ||
      verificacao.verificadaEm ||
      verificacao.expiraEm <= agora ||
      verificacao.tentativasCodigo >=
        ConfirmarCodigoTelegramUseCase.MAXIMO_TENTATIVAS
    ) {
      throw new UnauthorizedException(MENSAGENS_ERRO.codigoVerificacaoInvalido);
    }

    const codigoValido = await argon2.verify(verificacao.codigoHash, codigo);
    if (!codigoValido) {
      await this.usuariosRepository.incrementarTentativasCodigo(
        verificacao.id,
        agora,
        ConfirmarCodigoTelegramUseCase.MAXIMO_TENTATIVAS,
      );
      throw new UnauthorizedException(MENSAGENS_ERRO.codigoVerificacaoInvalido);
    }

    const resultado =
      await this.usuariosRepository.finalizarVerificacaoPorCodigo({
        verificacaoId: verificacao.id,
        codigoHash: verificacao.codigoHash,
        quando: agora,
      });
    if (resultado === 'TELEFONE_JA_CADASTRADO') {
      throw new ConflictException(MENSAGENS_ERRO.telefoneJaCadastrado);
    }
    if (resultado !== 'VERIFICADA') {
      throw new UnauthorizedException(MENSAGENS_ERRO.codigoVerificacaoInvalido);
    }
  }
}
