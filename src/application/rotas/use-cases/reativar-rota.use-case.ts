import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { RegraDeNegocioError } from '../../../domain/errors/regra-de-negocio.error';
import { RotaEntity } from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { ReativarRotaCommand } from '../commands/reativar-rota.command';
import {
  RotaComSituacaoCotacao,
  VerificarPrecoRotaUseCase,
} from './verificar-preco-rota.use-case';

@Injectable()
export class ReativarRotaUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
    private readonly verificarPrecoRota: VerificarPrecoRotaUseCase,
  ) {}

  async execute(comando: ReativarRotaCommand): Promise<RotaComSituacaoCotacao> {
    const rota = await this.rotasRepository.buscarPorId(
      comando.rotaId,
      comando.usuarioId,
    );
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    if (RotaEntity.dataIdaJaPassou(rota.dataIda)) {
      throw new RegraDeNegocioError(MENSAGENS_ERRO.rotaComDataIdaPassada);
    }

    if (rota.ativa) return { ...rota, situacaoCotacao: 'NAO_SOLICITADA' };

    const rotaReativada = await this.rotasRepository.reativar(
      rota.id,
      comando.usuarioId,
    );
    const situacaoCotacao =
      await this.verificarPrecoRota.executarResiliente(rotaReativada);

    return { ...rotaReativada, situacaoCotacao };
  }
}
