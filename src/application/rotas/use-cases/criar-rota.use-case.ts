import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { RotaEntity } from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { CriarRotaCommand } from '../commands/criar-rota.command';

@Injectable()
export class CriarRotaUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
  ) {}

  async execute(comando: CriarRotaCommand) {
    const novaRota = {
      ...RotaEntity.criarNova(comando),
      usuarioId: comando.usuarioId,
    };

    const rotaExistente = await this.rotasRepository.buscarPorChave(
      comando.usuarioId,
      novaRota.chaveMonitoramento,
    );

    if (rotaExistente) {
      if (!rotaExistente.ativa) {
        return this.rotasRepository.reativar(
          rotaExistente.id,
          comando.usuarioId,
        );
      }

      throw new ConflictException(MENSAGENS_ERRO.rotaDuplicada);
    }

    return this.rotasRepository.criar(novaRota);
  }
}
