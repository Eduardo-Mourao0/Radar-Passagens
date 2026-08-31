import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { RegraDeNegocioError } from '../../../domain/errors/regra-de-negocio.error';
import { RotaEntity } from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { ReativarRotaCommand } from '../commands/reativar-rota.command';
import { VerificarPrecoRotaUseCase } from './verificar-preco-rota.use-case';

@Injectable()
export class ReativarRotaUseCase {
  private readonly logger = new Logger(ReativarRotaUseCase.name);

  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
    private readonly verificarPrecoRota: VerificarPrecoRotaUseCase,
  ) {}

  async execute(comando: ReativarRotaCommand) {
    const rota = await this.rotasRepository.buscarPorId(
      comando.rotaId,
      comando.usuarioId,
    );
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    if (RotaEntity.dataIdaJaPassou(rota.dataIda)) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.rotaComDataIdaPassada);
    }

    if (rota.ativa) return rota;

    const rotaReativada = await this.rotasRepository.reativar(
      rota.id,
      comando.usuarioId,
    );
    try {
      await this.verificarPrecoRota.execute(rotaReativada);
    } catch {
      this.logger.error(
        JSON.stringify({
          evento: 'verificacao_preco_imediata_falhou',
          rotaId: rotaReativada.id,
        }),
      );
    }

    return rotaReativada;
  }
}
