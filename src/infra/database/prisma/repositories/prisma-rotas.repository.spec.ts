import { PrismaService } from '../prisma.service';
import { PrismaRotasRepository } from './prisma-rotas.repository';

describe('PrismaRotasRepository', () => {
  it('inclui a meta de alerta ao listar rotas', async () => {
    const prismaMock = {
      rota: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rota-1',
            usuarioId: 'usuario-1',
            chaveMonitoramento: 'BSB:GRU:2026-12-10:SOMENTE_IDA',
            origem: 'BSB',
            destino: 'GRU',
            dataIda: new Date(2026, 11, 10),
            dataVolta: null,
            ativa: true,
            criadoEm: new Date(2026, 0, 1),
            alertaPreco: {
              precoAlvo: { toString: () => '1500.00' },
              disparado: false,
            },
            historicos: [],
          },
        ]),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;
    const repositorio = new PrismaRotasRepository(prisma);

    await expect(repositorio.listar('usuario-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'rota-1',
        alertaPreco: { precoAlvo: '1500.00', disparado: false },
        ultimoPreco: null,
      }),
    ]);
    expect(prismaMock.rota.findMany).toHaveBeenCalledWith({
      orderBy: { criadoEm: 'desc' },
      include: {
        alertaPreco: true,
        historicos: {
          orderBy: { coletadoEm: 'desc' },
          take: 1,
        },
      },
      where: { usuarioId: 'usuario-1' },
    });
  });

  it('nao falha quando a rota ja foi excluida em outra requisicao', async () => {
    const prismaMock = {
      rota: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;
    const repositorio = new PrismaRotasRepository(prisma);

    await expect(
      repositorio.excluir('rota-1', 'usuario-1'),
    ).resolves.toBeUndefined();
    expect(prismaMock.rota.deleteMany).toHaveBeenCalledWith({
      where: { id: 'rota-1', usuarioId: 'usuario-1' },
    });
  });

  it('registra uma nova amostra mesmo quando a cotacao nao mudou', async () => {
    const historicoCriado = {
      id: 'historico-1',
      rotaId: 'rota-1',
      preco: { toString: () => '100.00' },
      moeda: 'BRL',
      companhia: 'LATAM',
      ignavId: 'ignav-novo',
      coletadoEm: new Date(2026, 0, 1),
    };
    const transacao = {
      $executeRaw: jest.fn(),
      historicoPreco: {
        create: jest.fn().mockResolvedValue(historicoCriado),
      },
    };
    const prismaMock = {
      $transaction: jest.fn(
        async (executar: (cliente: typeof transacao) => Promise<unknown>) =>
          executar(transacao),
      ),
    };
    const prisma = prismaMock as unknown as PrismaService;
    const repositorio = new PrismaRotasRepository(prisma);

    const dados = {
      rotaId: 'rota-1',
      preco: '100.00',
      moeda: 'BRL',
      companhia: 'LATAM',
      ignavId: 'ignav-novo',
    };

    await expect(repositorio.registrarHistorico(dados)).resolves.toEqual({
      id: 'historico-1',
      rotaId: 'rota-1',
      preco: '100.00',
      moeda: 'BRL',
      companhia: 'LATAM',
      ignavId: 'ignav-novo',
      coletadoEm: new Date(2026, 0, 1),
    });
    await repositorio.registrarHistorico(dados);

    expect(transacao.$executeRaw).toHaveBeenCalledTimes(2);
    expect(transacao.$executeRaw).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining('pg_advisory_xact_lock'),
      ]),
      dados.rotaId,
    );
    expect(transacao.historicoPreco.create).toHaveBeenCalledTimes(2);
    expect(transacao.historicoPreco.create).toHaveBeenLastCalledWith({
      data: dados,
    });
  });
});
