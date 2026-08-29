import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { CONSULTAR_PRECOS_VOO } from '../ports/consultar-precos-voo.port';
import type { ConsultarPrecosVoo } from '../ports/consultar-precos-voo.port';

@Injectable()
export class ObterLinksCompraRotaUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
    @Inject(CONSULTAR_PRECOS_VOO) private readonly consultarPrecosVoo: ConsultarPrecosVoo,
  ) {}

  async execute(rotaId: string) {
    const rota = await this.rotasRepository.buscarPorId(rotaId);
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);
    const historico = await this.rotasRepository.listarHistorico(rotaId);
    const cotacao = historico.find((item) => item.ignavId);
    if (!cotacao?.ignavId) throw new NotFoundException('Nenhum link de compra estÃ¡ disponÃ­vel para a Ãºltima cotaÃ§Ã£o desta rota.');
    return this.consultarPrecosVoo.obterLinksCompra(cotacao.ignavId);
  }
}
