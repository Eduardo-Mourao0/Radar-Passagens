import {
  AlertaPreco as PrismaAlertaPreco,
  HistoricoPreco as PrismaHistoricoPreco,
  Rota as PrismaRota,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  AlertaPreco,
  AtualizacaoSituacaoCotacao,
  HistoricoPreco,
  HistoricoPrecoEntity,
  NovaRota,
  NovoAlertaPreco,
  NovoHistoricoPreco,
  Rota,
  RotaComAlerta,
} from '../../../../domain/rotas/entities/rota.entity';
import { RotasRepository } from '../../../../domain/rotas/repositories/rotas.repository';

@Injectable()
export class PrismaRotasRepository implements RotasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorChave(
    usuarioId: string,
    chaveMonitoramento: string,
  ): Promise<Rota | null> {
    const rota = await this.prisma.rota.findUnique({
      where: {
        usuarioId_chaveMonitoramento: { usuarioId, chaveMonitoramento },
      },
    });

    return rota ? this.mapearRota(rota) : null;
  }

  async criar(dados: NovaRota): Promise<Rota> {
    const rota = await this.prisma.rota.create({
      data: dados,
    });

    return this.mapearRota(rota);
  }

  async reativar(id: string, usuarioId: string): Promise<Rota> {
    const rota = await this.prisma.rota.update({
      where: { id, usuarioId },
      data: {
        ativa: true,
        situacaoCotacao: 'PENDENTE',
        ultimaCotacaoEm: null,
        proximaTentativaCotacaoEm: null,
        tentativasCotacao: 0,
      },
    });

    return this.mapearRota(rota);
  }

  async desativar(id: string, usuarioId: string): Promise<Rota> {
    const rota = await this.prisma.rota.update({
      where: { id, usuarioId },
      data: { ativa: false },
    });

    return this.mapearRota(rota);
  }

  async excluir(id: string, usuarioId: string): Promise<void> {
    await this.prisma.rota.deleteMany({ where: { id, usuarioId } });
  }

  async listar(usuarioId: string): Promise<RotaComAlerta[]> {
    const rotas = await this.prisma.rota.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
      include: {
        alertaPreco: true,
        historicos: {
          orderBy: { coletadoEm: 'desc' },
          take: 1,
        },
      },
    });

    return rotas.map((rota) => this.mapearRotaComAlerta(rota));
  }

  async listarAtivas(): Promise<Rota[]> {
    const rotas = await this.prisma.rota.findMany({
      where: { ativa: true },
      orderBy: { criadoEm: 'asc' },
    });

    return rotas.map((rota) => this.mapearRota(rota));
  }

  async listarComRetentativaCotacaoPendente(
    dataReferencia: Date,
    limite: number,
  ): Promise<Rota[]> {
    const rotas = await this.prisma.rota.findMany({
      where: {
        ativa: true,
        situacaoCotacao: 'INDISPONIVEL',
        proximaTentativaCotacaoEm: { lte: dataReferencia },
      },
      orderBy: { proximaTentativaCotacaoEm: 'asc' },
      take: limite,
    });

    return rotas.map((rota) => this.mapearRota(rota));
  }

  async desativarRotasComDataIdaPassada(dataReferencia: Date): Promise<number> {
    const resultado = await this.prisma.rota.updateMany({
      where: {
        ativa: true,
        dataIda: { lt: dataReferencia },
      },
      data: { ativa: false },
    });

    return resultado.count;
  }

  async buscarPorId(id: string, usuarioId: string): Promise<Rota | null> {
    const rota = await this.prisma.rota.findFirst({
      where: { id, usuarioId },
    });

    return rota ? this.mapearRota(rota) : null;
  }

  async listarHistorico(
    rotaId: string,
    usuarioId: string,
  ): Promise<HistoricoPreco[]> {
    const historicos = await this.prisma.historicoPreco.findMany({
      where: {
        rotaId,
        rota: { usuarioId },
      },
      orderBy: { coletadoEm: 'desc' },
    });

    return historicos.map((historico) => this.mapearHistorico(historico));
  }

  async buscarAlertaPreco(rotaId: string): Promise<AlertaPreco | null> {
    const alerta = await this.prisma.alertaPreco.findUnique({
      where: { rotaId },
    });

    return alerta ? this.mapearAlerta(alerta) : null;
  }

  async salvarAlertaPreco(dados: NovoAlertaPreco): Promise<AlertaPreco> {
    const alerta = await this.prisma.alertaPreco.upsert({
      where: { rotaId: dados.rotaId },
      create: dados,
      update: {
        precoAlvo: dados.precoAlvo,
        disparado: false,
      },
    });

    return this.mapearAlerta(alerta);
  }

  async atualizarAlertaDisparado(
    id: string,
    disparado: boolean,
  ): Promise<void> {
    await this.prisma.alertaPreco.update({
      where: { id },
      data: { disparado },
    });
  }

  async atualizarSituacaoCotacao(
    id: string,
    dados: AtualizacaoSituacaoCotacao,
  ): Promise<void> {
    await this.prisma.rota.update({ where: { id }, data: dados });
  }

  async registrarHistorico(dados: NovoHistoricoPreco): Promise<HistoricoPreco> {
    const historico = await this.prisma.$transaction(async (transacao) => {
      await transacao.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${dados.rotaId}, 0))
      `;

      return transacao.historicoPreco.create({ data: dados });
    });

    return this.mapearHistorico(historico);
  }

  private mapearRota(rota: PrismaRota): Rota {
    return {
      id: rota.id,
      usuarioId: rota.usuarioId,
      chaveMonitoramento: rota.chaveMonitoramento,
      origem: rota.origem,
      destino: rota.destino,
      dataIda: rota.dataIda,
      dataVolta: rota.dataVolta,
      ativa: rota.ativa,
      situacaoCotacao: rota.situacaoCotacao,
      ultimaCotacaoEm: rota.ultimaCotacaoEm,
      proximaTentativaCotacaoEm: rota.proximaTentativaCotacaoEm,
      tentativasCotacao: rota.tentativasCotacao,
      criadoEm: rota.criadoEm,
    };
  }

  private mapearRotaComAlerta(
    rota: PrismaRota & {
      alertaPreco: PrismaAlertaPreco | null;
      historicos: PrismaHistoricoPreco[];
    },
  ): RotaComAlerta {
    return {
      ...this.mapearRota(rota),
      alertaPreco: rota.alertaPreco
        ? {
            precoAlvo: rota.alertaPreco.precoAlvo.toString(),
            disparado: rota.alertaPreco.disparado,
          }
        : null,
      ultimoPreco: rota.historicos[0]
        ? this.mapearHistorico(rota.historicos[0])
        : null,
    };
  }

  private mapearHistorico(historico: PrismaHistoricoPreco): HistoricoPreco {
    return {
      id: historico.id,
      rotaId: historico.rotaId,
      preco: HistoricoPrecoEntity.normalizarPreco(historico.preco.toString()),
      moeda: historico.moeda,
      companhia: historico.companhia,
      ignavId: historico.ignavId,
      coletadoEm: historico.coletadoEm,
    };
  }

  private mapearAlerta(alerta: PrismaAlertaPreco): AlertaPreco {
    return {
      id: alerta.id,
      rotaId: alerta.rotaId,
      precoAlvo: HistoricoPrecoEntity.normalizarPreco(
        alerta.precoAlvo.toString(),
      ),
      disparado: alerta.disparado,
      criadoEm: alerta.criadoEm,
      atualizadoEm: alerta.atualizadoEm,
    };
  }
}
