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
});
