import { Inject, Injectable } from '@nestjs/common';
import type { Rota } from '../../../domain/rotas/entities/rota.entity';
import type { Usuario } from '../../../domain/usuarios/entities/usuario.entity';
import { CONSULTAR_PRECOS_VOO } from '../ports/consultar-precos-voo.port';
import type { ConsultarPrecosVoo } from '../ports/consultar-precos-voo.port';
import { RegistrarHistoricoPrecoUseCase } from './registrar-historico-preco.use-case';

export type ResultadoVerificacaoPreco = Readonly<{
  ofertaEncontrada: boolean;
  historicoRegistrado: boolean;
}>;

@Injectable()
export class VerificarPrecoRotaUseCase {
  constructor(
    @Inject(CONSULTAR_PRECOS_VOO)
    private readonly consultarPrecosVoo: ConsultarPrecosVoo,
    private readonly registrarHistoricoPreco: RegistrarHistoricoPrecoUseCase,
  ) {}

  async execute(
    rota: Rota,
    usuario?: Usuario,
  ): Promise<ResultadoVerificacaoPreco> {
    const cotacao = await this.consultarPrecosVoo.consultarMenorPreco(rota);
    if (!cotacao) {
      return { ofertaEncontrada: false, historicoRegistrado: false };
    }

    const resultado = await this.registrarHistoricoPreco.execute(
      { rotaId: rota.id, ...cotacao },
      rota,
      usuario,
    );

    return {
      ofertaEncontrada: true,
      historicoRegistrado: resultado.registrado,
    };
  }
}
