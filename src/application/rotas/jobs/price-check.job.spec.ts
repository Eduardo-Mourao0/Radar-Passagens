import { Logger } from '@nestjs/common';
import { PriceCheckJob } from './price-check.job';

const rota = {
  id: 'rota-1',
  chaveMonitoramento: 'GRU:REC:2026-09-10:SOMENTE_IDA',
  origem: 'GRU',
  destino: 'REC',
  dataIda: new Date(2026, 8, 10),
  dataVolta: null,
  ativa: true,
  criadoEm: new Date(2026, 0, 1),
} as const;

describe('PriceCheckJob', () => {
  it('continua a verificação após a falha de uma rota', async () => {
    const rotasRepository = {
      listarAtivas: jest
        .fn()
        .mockResolvedValue([rota, { ...rota, id: 'rota-2' }]),
    };
    const consultarPrecosVoo = {
      consultarMenorPreco: jest
        .fn()
        .mockRejectedValueOnce(new Error('falha externa'))
        .mockResolvedValueOnce({
          preco: '350.00',
          moeda: 'BRL',
          companhia: 'Azul',
        }),
    };
    const registrarHistoricoPreco = {
      execute: jest.fn().mockResolvedValue({ registrado: true }),
    };
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const infoLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const job = new PriceCheckJob(
      rotasRepository,
      consultarPrecosVoo,
      registrarHistoricoPreco,
    );

    await job.executar();

    expect(consultarPrecosVoo.consultarMenorPreco).toHaveBeenCalledTimes(2);
    expect(registrarHistoricoPreco.execute).toHaveBeenCalledWith({
      rotaId: 'rota-2',
      preco: '350.00',
      moeda: 'BRL',
      companhia: 'Azul',
    });
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(infoLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
    infoLog.mockRestore();
  });

  it('limita a cinco verificações simultâneas', async () => {
    const rotas = Array.from({ length: 6 }, (_, indice) => ({
      ...rota,
      id: `rota-${indice}`,
    }));
    const rotasRepository = {
      listarAtivas: jest.fn().mockResolvedValue(rotas),
    };
    let verificacoesEmAndamento = 0;
    let maiorConcorrencia = 0;
    const consultarPrecosVoo = {
      consultarMenorPreco: jest.fn().mockImplementation(async () => {
        verificacoesEmAndamento += 1;
        maiorConcorrencia = Math.max(
          maiorConcorrencia,
          verificacoesEmAndamento,
        );

        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        verificacoesEmAndamento -= 1;

        return { preco: '350.00', moeda: 'BRL', companhia: 'Azul' };
      }),
    };
    const registrarHistoricoPreco = {
      execute: jest.fn().mockResolvedValue({ registrado: true }),
    };
    const infoLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const job = new PriceCheckJob(
      rotasRepository,
      consultarPrecosVoo,
      registrarHistoricoPreco,
    );

    await job.executar();

    expect(consultarPrecosVoo.consultarMenorPreco).toHaveBeenCalledTimes(6);
    expect(maiorConcorrencia).toBe(5);
    infoLog.mockRestore();
  });

  it('registra ausência de oferta no nível info', async () => {
    const rotasRepository = {
      listarAtivas: jest.fn().mockResolvedValue([rota]),
    };
    const consultarPrecosVoo = {
      consultarMenorPreco: jest.fn().mockResolvedValue(null),
    };
    const registrarHistoricoPreco = { execute: jest.fn() };
    const infoLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const job = new PriceCheckJob(
      rotasRepository,
      consultarPrecosVoo,
      registrarHistoricoPreco,
    );

    await job.executar();

    expect(infoLog).toHaveBeenCalledWith(
      JSON.stringify({
        evento: 'nenhuma_oferta_encontrada',
        rotaId: rota.id,
      }),
    );
    expect(warnLog).not.toHaveBeenCalled();
    expect(registrarHistoricoPreco.execute).not.toHaveBeenCalled();
    infoLog.mockRestore();
    warnLog.mockRestore();
  });
});
