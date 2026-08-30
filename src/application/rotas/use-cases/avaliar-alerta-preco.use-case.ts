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
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';

@Injectable()
export class AvaliarAlertaPrecoUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
    @Inject(NOTIFICADOR_ALERTA_PRECO)
    private readonly notificador: NotificadorAlertaPreco,
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
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

    const usuario = await this.usuariosRepository.buscarPorId(rota.usuarioId);
    if (!usuario) return;

    const notificacaoEnviada = await this.notificador.enviar({
      telegramChatId: usuario.telegramChatId,
      alerta,
      rota,
      historico,
    });
    if (!notificacaoEnviada) return;

    await this.rotasRepository.atualizarAlertaDisparado(alerta.id, true);
  }
}
