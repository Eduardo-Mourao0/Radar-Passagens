import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { DesativarRotaCommand } from '../commands/desativar-rota.command';

@Injectable()
export class DesativarRotaUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
  ) {}

  async execute(comando: DesativarRotaCommand) {
    const rota = await this.rotasRepository.buscarPorId(comando.rotaId);
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    if (!rota.ativa) return rota;

    return this.rotasRepository.desativar(rota.id);
  }
}
