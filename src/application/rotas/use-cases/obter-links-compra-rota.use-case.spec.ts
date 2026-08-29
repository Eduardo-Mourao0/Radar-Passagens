/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import type { Rota } from '../../../domain/rotas/entities/rota.entity';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import type { ConsultarPrecosVoo } from '../ports/consultar-precos-voo.port';
import { ObterLinksCompraRotaUseCase } from './obter-links-compra-rota.use-case';

describe('ObterLinksCompraRotaUseCase', () => {
  const rota: Rota = {
    id: 'f417d8b9-0d9a-43ae-b1cc-36d32d4715fd',
    chaveMonitoramento: 'BSB:FOR:2026-12-01:SOMENTE_IDA',
    origem: 'BSB',
    destino: 'FOR',
    dataIda: new Date(2026, 11, 1),
    dataVolta: null,
    ativa: true,
    criadoEm: new Date(2026, 0, 1),
  };

  const repositorio = {
    buscarPorId: jest.fn(),
    listarHistorico: jest.fn(),
  } as unknown as jest.Mocked<RotasRepository>;
  const consultarPrecosVoo = {
    obterLinksCompra: jest.fn(),
  } as unknown as jest.Mocked<ConsultarPrecosVoo>;
  const useCase = new ObterLinksCompraRotaUseCase(
    repositorio,
    consultarPrecosVoo,
  );

  beforeEach(() => jest.clearAllMocks());

  it('retorna os links da cotacao mais recente', async () => {
    repositorio.buscarPorId.mockResolvedValue(rota);
    repositorio.listarHistorico.mockResolvedValue([
      {
        id: 'historico-1',
        rotaId: rota.id,
        preco: '100.00',
        moeda: 'BRL',
        companhia: 'LATAM',
        ignavId: 'ignav-1',
        coletadoEm: new Date(),
      },
    ]);
    consultarPrecosVoo.obterLinksCompra.mockResolvedValue([
      {
        fornecedor: 'LATAM',
        tipoFornecedor: 'airline',
        url: 'https://example.com/reserva',
      },
    ]);

    await expect(useCase.execute(rota.id)).resolves.toEqual([
      {
        fornecedor: 'LATAM',
        tipoFornecedor: 'airline',
        url: 'https://example.com/reserva',
      },
    ]);
    expect(consultarPrecosVoo.obterLinksCompra).toHaveBeenCalledWith('ignav-1');
  });

  it('rejeita quando a cotacao mais recente nao possui identificador da Ignav', async () => {
    repositorio.buscarPorId.mockResolvedValue(rota);
    repositorio.listarHistorico.mockResolvedValue([
      {
        id: 'historico-mais-recente',
        rotaId: rota.id,
        preco: '100.00',
        moeda: 'BRL',
        companhia: 'LATAM',
        ignavId: null,
        coletadoEm: new Date(),
      },
      {
        id: 'historico-antigo',
        rotaId: rota.id,
        preco: '120.00',
        moeda: 'BRL',
        companhia: 'LATAM',
        ignavId: 'ignav-antigo',
        coletadoEm: new Date(2026, 0, 1),
      },
    ]);

    await expect(useCase.execute(rota.id)).rejects.toEqual(
      new NotFoundException(MENSAGENS_ERRO.linksCompraIndisponiveis),
    );
    expect(consultarPrecosVoo.obterLinksCompra).not.toHaveBeenCalled();
  });
});
