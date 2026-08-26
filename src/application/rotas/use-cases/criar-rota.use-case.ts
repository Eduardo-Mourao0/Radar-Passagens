import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  NovaRota,
  ROTAS_REPOSITORY,
} from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { CriarRotaCommand } from '../commands/criar-rota.command';

@Injectable()
export class CriarRotaUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
  ) {}

  async execute(comando: CriarRotaCommand) {
    const novaRota: NovaRota = {
      origem: comando.origem,
      destino: comando.destino,
      dataIda: new Date(comando.dataIda),
      dataVolta: comando.dataVolta ? new Date(comando.dataVolta) : null,
    };

    const rotaExistente = await this.rotasRepository.buscarDuplicada(novaRota);

    if (rotaExistente) {
      throw new ConflictException('Esta rota já está cadastrada.');
    }

    return this.rotasRepository.criar(novaRota);
  }
}
