import { Inject, Injectable } from '@nestjs/common';
import {
  AlertaPrecoEntity,
  HistoricoPreco,
  Rota,
} from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { NOTIFICADOR_ALERTA_PRECO } from '../ports/notificador-alerta-preco.port';
import type { NotificadorAlertaPreco } from '../ports/notificador-alerta-preco.port';

@Injectable()
export class AvaliarAlertaPrecoUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
    @Inject(NOTIFICADOR_ALERTA_PRECO)
    private readonly notificador: NotificadorAlertaPreco,
  ) {}

  async execute(rota: Rota, historico: HistoricoPreco): Promise<void> {
    const alerta = await this.rotasRepository.buscarAlertaPreco(rota.id);
    if (!alerta) return;

    // Rearme e disparo são mutuamente exclusivos pelo estado `disparado`.
    if (AlertaPrecoEntity.deveRearmar(alerta, historico.preco)) {
      await this.rotasRepository.atualizarAlertaDisparado(alerta.id, false);
      return;
    }

    if (!AlertaPrecoEntity.deveDisparar(alerta, historico.preco)) return;

    const notificacaoEnviada = await this.notificador.enviar({
      alerta,
      rota,
      historico,
    });
    if (!notificacaoEnviada) return;

    await this.rotasRepository.atualizarAlertaDisparado(alerta.id, true);
  }
}
