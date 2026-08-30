import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import { SessaoService } from '../../../infra/autenticacao/sessao.service';

@Injectable()
export class ObterStatusVerificacaoUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
    private readonly sessaoService: SessaoService,
  ) {}

  async execute(id: string) {
    const verificacao =
      await this.usuariosRepository.buscarVerificacaoPorId(id);
    if (!verificacao)
      throw new NotFoundException(MENSAGENS_ERRO.verificacaoTelefoneInvalida);

    const expirada =
      !verificacao.verificadaEm && verificacao.expiraEm <= new Date();
    if (expirada) {
      return { status: 'EXPIRADA' as const, expiraEm: verificacao.expiraEm };
    }

    if (!verificacao.verificadaEm) {
      return { status: 'PENDENTE' as const, expiraEm: verificacao.expiraEm };
    }

    if (verificacao.finalidade === 'RECUPERACAO') {
      const usuario = await this.usuariosRepository.buscarPorTelefone(
        verificacao.telefone,
      );
      if (!usuario || verificacao.consumidaEm) {
        return { status: 'CONSUMIDA' as const, expiraEm: verificacao.expiraEm };
      }

      return {
        status: 'VERIFICADA' as const,
        expiraEm: verificacao.expiraEm,
        tokenRedefinicao: this.sessaoService.gerarTokenRedefinicao(
          usuario.id,
          verificacao.id,
        ),
      };
    }

    return { status: 'VERIFICADA' as const, expiraEm: verificacao.expiraEm };
  }
}
