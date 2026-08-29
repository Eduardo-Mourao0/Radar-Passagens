import { PrismaService } from '../prisma.service';
import { PrismaRotasRepository } from './prisma-rotas.repository';

describe('PrismaRotasRepository', () => {
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
        ignavId: 'ignav-novo',
      }),
    ).resolves.toBeNull();

    expect(transacao.historicoPreco.update).toHaveBeenCalledWith({
      where: { id: 'historico-1' },
      data: { ignavId: 'ignav-novo' },
    });
    expect(transacao.historicoPreco.create).not.toHaveBeenCalled();
  });
});
