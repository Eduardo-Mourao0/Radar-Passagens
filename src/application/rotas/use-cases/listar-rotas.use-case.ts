import { Inject, Injectable } from '@nestjs/common';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';

@Injectable()
export class ListarRotasUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
  ) {}

  async execute(usuarioId: string) {
    return this.rotasRepository.listar(usuarioId);
  }
}
