import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { RegraDeNegocioError } from '../../../domain/errors/regra-de-negocio.error';
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
    let novaRota;

    try {
      novaRota = RotaEntity.criarNova(comando);
    } catch (erro) {
      if (erro instanceof RegraDeNegocioError) {
        throw new BadRequestException(erro.message);
      }

      throw erro;
    }

    const rotaExistente = await this.rotasRepository.buscarPorChave(
      novaRota.chaveMonitoramento,
    );

    if (rotaExistente) {
      if (!rotaExistente.ativa) {
        return this.rotasRepository.reativar(rotaExistente.id);
      }

      throw new ConflictException(MENSAGENS_ERRO.rotaDuplicada);
    }

    return this.rotasRepository.criar(novaRota);
  }
}
