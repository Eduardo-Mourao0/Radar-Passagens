import {
  HistoricoPreco as PrismaHistoricoPreco,
  Rota as PrismaRota,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { HistoricoPreco, NovaRota, Rota } from '../../../../domain/rotas/entities/rota.entity';
import { RotasRepository } from '../../../../domain/rotas/repositories/rotas.repository';

@Injectable()
export class PrismaRotasRepository implements RotasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorChave(chaveMonitoramento: string): Promise<Rota | null> {
    const rota = await this.prisma.rota.findUnique({
      where: { chaveMonitoramento },
    });

    return rota ? this.mapearRota(rota) : null;
  }

  async criar(dados: NovaRota): Promise<Rota> {
    const rota = await this.prisma.rota.create({
      data: dados,
    });

    return this.mapearRota(rota);
  }

  async reativar(id: string): Promise<Rota> {
    const rota = await this.prisma.rota.update({
      where: { id },
      data: { ativa: true },
    });

    return this.mapearRota(rota);
  }

  async listar(): Promise<Rota[]> {
    const rotas = await this.prisma.rota.findMany({
      orderBy: { criadoEm: 'desc' },
    });

    return rotas.map((rota) => this.mapearRota(rota));
  }

  async listarAtivas(): Promise<Rota[]> {
    const rotas = await this.prisma.rota.findMany({
      where: { ativa: true },
      orderBy: { criadoEm: 'asc' },
    });

    return rotas.map((rota) => this.mapearRota(rota));
  }

  async buscarPorId(id: string): Promise<Rota | null> {
    const rota = await this.prisma.rota.findUnique({
      where: { id },
    });

    return rota ? this.mapearRota(rota) : null;
  }

  async listarHistorico(rotaId: string): Promise<HistoricoPreco[]> {
    const historicos = await this.prisma.historicoPreco.findMany({
      where: { rotaId },
      orderBy: { coletadoEm: 'desc' },
    });

    return historicos.map((historico) => this.mapearHistorico(historico));
  }

  private mapearRota(rota: PrismaRota): Rota {
    return {
      id: rota.id,
      chaveMonitoramento: rota.chaveMonitoramento,
      origem: rota.origem,
      destino: rota.destino,
      dataIda: rota.dataIda,
      dataVolta: rota.dataVolta,
      ativa: rota.ativa,
      criadoEm: rota.criadoEm,
    };
  }

  private mapearHistorico(historico: PrismaHistoricoPreco): HistoricoPreco {
    return {
      id: historico.id,
      rotaId: historico.rotaId,
      preco: historico.preco.toString(),
      moeda: historico.moeda,
      companhia: historico.companhia,
      coletadoEm: historico.coletadoEm,
    };
  }
}
