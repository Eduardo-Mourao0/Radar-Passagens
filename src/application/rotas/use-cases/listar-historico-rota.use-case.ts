import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';

@Injectable()
export class ListarHistoricoRotaUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
  ) {}

  async execute(rotaId: string, usuarioId: string) {
    const rota = await this.rotasRepository.buscarPorId(rotaId, usuarioId);

    if (!rota) {
      throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);
    }

    return this.rotasRepository.listarHistorico(rotaId, usuarioId);
  }
}
