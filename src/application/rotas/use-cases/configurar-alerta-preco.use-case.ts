import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { AlertaPrecoEntity } from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { ConfigurarAlertaPrecoCommand } from '../commands/configurar-alerta-preco.command';

@Injectable()
export class ConfigurarAlertaPrecoUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
  ) {}

  async execute(comando: ConfigurarAlertaPrecoCommand) {
    const rota = await this.rotasRepository.buscarPorId(comando.rotaId);
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    const alerta = AlertaPrecoEntity.criar(comando);

    return this.rotasRepository.salvarAlertaPreco(alerta);
  }
}
