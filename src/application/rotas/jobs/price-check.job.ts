import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { Usuario } from '../../../domain/usuarios/entities/usuario.entity';
import { VerificarPrecoRotaUseCase } from '../use-cases/verificar-preco-rota.use-case';

/**
 * Orquestra as verificações periódicas; regras de negócio permanecem nos use cases.
 */
@Injectable()
export class PriceCheckJob {
  private static readonly CONCORRENCIA_MAXIMA = 5;

  private readonly logger = new Logger(PriceCheckJob.name);

  constructor(
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
    private readonly verificarPrecoRota: VerificarPrecoRotaUseCase,
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async executar(): Promise<void> {
    const inicioDeHoje = new Date();
    inicioDeHoje.setHours(0, 0, 0, 0);

    const rotasDesativadas =
      await this.rotasRepository.desativarRotasComDataIdaPassada(inicioDeHoje);
    if (rotasDesativadas > 0) {
      this.logger.log(
        JSON.stringify({
          evento: 'rotas_com_data_ida_passada_desativadas',
          quantidade: rotasDesativadas,
        }),
      );
    }

    const rotasPendentes = [...(await this.rotasRepository.listarAtivas())];
    this.logger.log(
      JSON.stringify({
        evento: 'verificacao_precos_iniciada',
        quantidadeRotas: rotasPendentes.length,
      }),
    );
    const usuarios = await this.usuariosRepository.buscarPorIds([
      ...new Set(rotasPendentes.map((rota) => rota.usuarioId)),
    ]);
    const usuariosPorId = new Map(
      usuarios.map((usuario) => [usuario.id, usuario]),
    );
    const quantidadeDeTrabalhadores = Math.min(
      PriceCheckJob.CONCORRENCIA_MAXIMA,
      rotasPendentes.length,
    );

    await Promise.all(
      Array.from({ length: quantidadeDeTrabalhadores }, () =>
        this.processarRotasPendentes(rotasPendentes, usuariosPorId),
      ),
    );
    this.logger.log(JSON.stringify({ evento: 'verificacao_precos_concluida' }));
  }

  private async processarRotasPendentes(
    rotasPendentes: Awaited<ReturnType<RotasRepository['listarAtivas']>>,
    usuariosPorId: ReadonlyMap<string, Usuario>,
  ): Promise<void> {
    while (rotasPendentes.length > 0) {
      const rota = rotasPendentes.shift();
      if (!rota) return;

      const usuario = usuariosPorId.get(rota.usuarioId);
      if (!usuario) {
        this.logger.warn(
          JSON.stringify({
            evento: 'usuario_da_rota_nao_encontrado',
            rotaId: rota.id,
            usuarioId: rota.usuarioId,
          }),
        );
      }

      await this.verificarRota(rota, usuario);
    }
  }

  private async verificarRota(
    rota: Awaited<ReturnType<RotasRepository['listarAtivas']>>[number],
    usuario: Usuario | undefined,
  ): Promise<void> {
    try {
      const resultado = await this.verificarPrecoRota.execute(rota, usuario);

      if (!resultado.ofertaEncontrada) {
        this.logger.log(
          JSON.stringify({
            evento: 'nenhuma_oferta_encontrada',
            rotaId: rota.id,
          }),
        );
        return;
      }

      this.logger.log(
        JSON.stringify({
          evento: 'verificacao_preco_concluida',
          rotaId: rota.id,
          historicoRegistrado: resultado.historicoRegistrado,
        }),
      );
    } catch {
      this.logger.error(
        JSON.stringify({
          evento: 'verificacao_preco_falhou',
          rotaId: rota.id,
        }),
      );
    }
  }
}
