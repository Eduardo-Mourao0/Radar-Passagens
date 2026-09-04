import { Logger } from '@nestjs/common';
import { PriceCheckJob } from './price-check.job';

const rota = {
  id: 'rota-1',
  usuarioId: 'usuario-1',
  chaveMonitoramento: 'GRU:REC:2026-09-10:SOMENTE_IDA',
  origem: 'GRU',
  destino: 'REC',
  dataIda: new Date(2026, 8, 10),
  dataVolta: null,
  ativa: true,
  criadoEm: new Date(2026, 0, 1),
} as const;

const usuariosRepository = {
  buscarPorIds: jest
    .fn()
    .mockResolvedValue([{ id: 'usuario-1', telegramChatId: '123456' }]),
};

describe('PriceCheckJob', () => {
  it('continua a verificação após a falha de uma rota', async () => {
    const rotasRepository = {
      desativarRotasComDataIdaPassada: jest.fn().mockResolvedValue(0),
      listarAtivas: jest
        .fn()
        .mockResolvedValue([rota, { ...rota, id: 'rota-2' }]),
    };
    const verificarPrecoRota = {
      execute: jest
        .fn()
        .mockRejectedValueOnce(new Error('falha externa'))
        .mockResolvedValueOnce({
          ofertaEncontrada: true,
          historicoRegistrado: true,
          historico: {
            id: 'historico-1',
            rotaId: 'rota-2',
            preco: '350.00',
            moeda: 'BRL',
            companhia: 'Azul',
            ignavId: null,
            coletadoEm: new Date(2026, 0, 1),
          },
        }),
    };
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const infoLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const job = new PriceCheckJob(
      rotasRepository,
      verificarPrecoRota,
      usuariosRepository,
    );

    await expect(job.executar()).resolves.toEqual([
      {
        rotaId: 'rota-1',
        situacao: 'INDISPONIVEL',
        ultimoPreco: null,
      },
      {
        rotaId: 'rota-2',
        situacao: 'ATUALIZADA',
        ultimoPreco: {
          id: 'historico-1',
          rotaId: 'rota-2',
          preco: '350.00',
          moeda: 'BRL',
          companhia: 'Azul',
          ignavId: null,
          coletadoEm: new Date(2026, 0, 1),
        },
      },
    ]);

    expect(verificarPrecoRota.execute).toHaveBeenCalledTimes(2);
    expect(usuariosRepository.buscarPorIds).toHaveBeenCalledWith(['usuario-1']);
    expect(verificarPrecoRota.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rota-2' }),
      expect.objectContaining({ id: 'usuario-1' }),
      true,
    );
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(infoLog).toHaveBeenCalledTimes(3);
    errorLog.mockRestore();
    infoLog.mockRestore();
  });

  it('limita a cinco verificações simultâneas', async () => {
    const rotas = Array.from({ length: 6 }, (_, indice) => ({
      ...rota,
      id: `rota-${indice}`,
    }));
    const rotasRepository = {
      desativarRotasComDataIdaPassada: jest.fn().mockResolvedValue(0),
      listarAtivas: jest.fn().mockResolvedValue(rotas),
    };
    let verificacoesEmAndamento = 0;
    let maiorConcorrencia = 0;
    const verificarPrecoRota = {
      execute: jest.fn().mockImplementation(async () => {
        verificacoesEmAndamento += 1;
        maiorConcorrencia = Math.max(
          maiorConcorrencia,
          verificacoesEmAndamento,
        );

        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        verificacoesEmAndamento -= 1;

        return {
          ofertaEncontrada: true,
          historicoRegistrado: true,
          historico: null,
        };
      }),
    };
    const infoLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const job = new PriceCheckJob(
      rotasRepository,
      verificarPrecoRota,
      usuariosRepository,
    );

    await job.executar();

    expect(verificarPrecoRota.execute).toHaveBeenCalledTimes(6);
    expect(maiorConcorrencia).toBe(5);
    infoLog.mockRestore();
  });

  it('registra ausência de oferta no nível info', async () => {
    const rotasRepository = {
      desativarRotasComDataIdaPassada: jest.fn().mockResolvedValue(0),
      listarAtivas: jest.fn().mockResolvedValue([rota]),
    };
    const verificarPrecoRota = {
      execute: jest.fn().mockResolvedValue({
        ofertaEncontrada: false,
        historicoRegistrado: false,
        historico: null,
      }),
    };
    const infoLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const job = new PriceCheckJob(
      rotasRepository,
      verificarPrecoRota,
      usuariosRepository,
    );

    await expect(job.executar()).resolves.toEqual([
      {
        rotaId: 'rota-1',
        situacao: 'SEM_OFERTA',
        ultimoPreco: null,
      },
    ]);

    expect(infoLog).toHaveBeenCalledWith(
      JSON.stringify({
        evento: 'nenhuma_oferta_encontrada',
        rotaId: rota.id,
      }),
    );
    expect(warnLog).not.toHaveBeenCalled();
    expect(verificarPrecoRota.execute).toHaveBeenCalledWith(
      rota,
      expect.anything(),
      true,
    );
    infoLog.mockRestore();
    warnLog.mockRestore();
  });

  it('não repete consultas de links quando a verificação é manual', async () => {
    const rotasRepository = {
      desativarRotasComDataIdaPassada: jest.fn().mockResolvedValue(0),
      listarAtivas: jest.fn().mockResolvedValue([rota]),
    };
    const verificarPrecoRota = {
      execute: jest.fn().mockResolvedValue({
        ofertaEncontrada: false,
        historicoRegistrado: false,
        historico: null,
      }),
    };
    const job = new PriceCheckJob(
      rotasRepository,
      verificarPrecoRota,
      usuariosRepository,
    );

    await job.executar({ repetirLinks: false });

    expect(verificarPrecoRota.execute).toHaveBeenCalledWith(
      rota,
      expect.anything(),
      false,
    );
  });

  it('avisa quando não encontra o dono de uma rota ativa no lote', async () => {
    const rotasRepository = {
      desativarRotasComDataIdaPassada: jest.fn().mockResolvedValue(0),
      listarAtivas: jest.fn().mockResolvedValue([rota]),
    };
    const verificarPrecoRota = {
      execute: jest.fn().mockResolvedValue({
        ofertaEncontrada: false,
        historicoRegistrado: false,
        historico: null,
      }),
    };
    const repositorioSemUsuario = {
      buscarPorIds: jest.fn().mockResolvedValue([]),
    };
    const warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const job = new PriceCheckJob(
      rotasRepository,
      verificarPrecoRota,
      repositorioSemUsuario,
    );

    await job.executar();

    expect(warnLog).toHaveBeenCalledWith(
      JSON.stringify({
        evento: 'usuario_da_rota_nao_encontrado',
        rotaId: rota.id,
        usuarioId: rota.usuarioId,
      }),
    );
    warnLog.mockRestore();
  });

  it('desativa rotas cuja data de ida já passou antes de consultar preços', async () => {
    const rotasRepository = {
      desativarRotasComDataIdaPassada: jest.fn().mockResolvedValue(2),
      listarAtivas: jest.fn().mockResolvedValue([]),
    };
    const verificarPrecoRota = { execute: jest.fn() };
    const infoLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const job = new PriceCheckJob(
      rotasRepository,
      verificarPrecoRota,
      usuariosRepository,
    );

    await job.executar();

    expect(
      rotasRepository.desativarRotasComDataIdaPassada,
    ).toHaveBeenCalledWith(expect.any(Date));
    const chamada: unknown =
      rotasRepository.desativarRotasComDataIdaPassada.mock.calls[0];
    if (!Array.isArray(chamada) || !(chamada[0] instanceof Date)) {
      throw new Error('A data de referência não foi informada ao repositório.');
    }
    const inicioDeHoje = chamada[0];
    expect(inicioDeHoje).toEqual(
      new Date(
        inicioDeHoje.getFullYear(),
        inicioDeHoje.getMonth(),
        inicioDeHoje.getDate(),
      ),
    );
    expect(infoLog).toHaveBeenCalledWith(
      JSON.stringify({
        evento: 'rotas_com_data_ida_passada_desativadas',
        quantidade: 2,
      }),
    );
    infoLog.mockRestore();
  });
});
