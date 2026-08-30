import { Inject, Injectable } from '@nestjs/common';
import {
  HistoricoPrecoEntity,
  Rota,
} from '../../../domain/rotas/entities/rota.entity';
import type { Usuario } from '../../../domain/usuarios/entities/usuario.entity';
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

  async execute(
    comando: RegistrarHistoricoPrecoCommand,
    rota: Rota,
    usuario?: Usuario,
  ) {
    const novoHistorico = HistoricoPrecoEntity.criar(comando);
    const historico =
      await this.rotasRepository.registrarHistoricoSeDiferente(novoHistorico);

    if (!historico) {
      return { registrado: false };
    }

    await this.avaliarAlertaPrecoUseCase.execute(rota, historico, usuario);

    return { registrado: true, historico };
  }
}
