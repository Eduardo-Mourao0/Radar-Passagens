import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { ExcluirRotaCommand } from '../commands/excluir-rota.command';

@Injectable()
export class ExcluirRotaUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
  ) {}

  async execute(comando: ExcluirRotaCommand): Promise<void> {
    const rota = await this.rotasRepository.buscarPorId(comando.rotaId);
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    await this.rotasRepository.excluir(rota.id);
  }
}
