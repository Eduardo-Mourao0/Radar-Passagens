import { PrismaService } from '../prisma.service';
import { PrismaRotasRepository } from './prisma-rotas.repository';

describe('PrismaRotasRepository', () => {
  it('inclui a meta de alerta ao listar rotas', async () => {
    const prismaMock = {
      rota: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rota-1',
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
          },
        ]),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;
    const repositorio = new PrismaRotasRepository(prisma);

    await expect(repositorio.listar()).resolves.toEqual([
      expect.objectContaining({
        id: 'rota-1',
        alertaPreco: { precoAlvo: '1500.00', disparado: false },
      }),
    ]);
    expect(prismaMock.rota.findMany).toHaveBeenCalledWith({
      orderBy: { criadoEm: 'desc' },
      include: { alertaPreco: true },
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

    await expect(repositorio.excluir('rota-1')).resolves.toBeUndefined();
    expect(prismaMock.rota.deleteMany).toHaveBeenCalledWith({
      where: { id: 'rota-1' },
    });
  });

  it('atualiza o identificador da Ignav quando a cotacao nao mudou', async () => {
    const historicoExistente = {
      id: 'historico-1',
      rotaId: 'rota-1',
      preco: { toString: () => '100.00' },
      moeda: 'BRL',
      companhia: 'LATAM',
      ignavId: null,
      coletadoEm: new Date(2026, 0, 1),
    };
    const transacao = {
      $executeRaw: jest.fn(),
      historicoPreco: {
        findFirst: jest.fn().mockResolvedValue(historicoExistente),
        update: jest.fn().mockResolvedValue({
          ...historicoExistente,
          ignavId: 'ignav-novo',
        }),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (executar: (cliente: typeof transacao) => Promise<unknown>) =>
          executar(transacao),
      ),
    } as unknown as PrismaService;
    const repositorio = new PrismaRotasRepository(prisma);

    await expect(
      repositorio.registrarHistoricoSeDiferente({
        rotaId: 'rota-1',
        preco: '100.00',
        moeda: 'BRL',
        companhia: 'LATAM',
        ignavId: ' ignav-novo ',
      }),
    ).resolves.toBeNull();

    expect(transacao.historicoPreco.update).toHaveBeenCalledWith({
      where: { id: 'historico-1' },
      data: { ignavId: 'ignav-novo' },
    });
    expect(transacao.historicoPreco.create).not.toHaveBeenCalled();
  });
});
