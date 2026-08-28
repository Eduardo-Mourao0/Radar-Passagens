import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { RegraDeNegocioError } from '../../../domain/errors/regra-de-negocio.error';
import { RotaEntity } from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { ReativarRotaCommand } from '../commands/reativar-rota.command';

@Injectable()
export class ReativarRotaUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
  ) {}

  async execute(comando: ReativarRotaCommand) {
    const rota = await this.rotasRepository.buscarPorId(comando.rotaId);
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    if (RotaEntity.dataIdaJaPassou(rota.dataIda)) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.rotaComDataIdaPassada);
    }

    if (rota.ativa) return rota;

    return this.rotasRepository.reativar(rota.id);
  }
}
