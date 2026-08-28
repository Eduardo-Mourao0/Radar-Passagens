import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { HistoricoPrecoEntity } from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { RegistrarHistoricoPrecoCommand } from '../commands/registrar-historico-preco.command';
import { AvaliarAlertaPrecoUseCase } from './avaliar-alerta-preco.use-case';

@Injectable()
export class RegistrarHistoricoPrecoUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
    private readonly avaliarAlertaPrecoUseCase: AvaliarAlertaPrecoUseCase,
  ) {}

  async execute(comando: RegistrarHistoricoPrecoCommand) {
    const rota = await this.rotasRepository.buscarPorId(comando.rotaId);
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    const novoHistorico = HistoricoPrecoEntity.criar(comando);
    const historico =
      await this.rotasRepository.registrarHistoricoSeDiferente(novoHistorico);

    if (!historico) {
      return { registrado: false };
    }

    await this.avaliarAlertaPrecoUseCase.execute(rota, historico);

    return { registrado: true, historico };
  }
}
