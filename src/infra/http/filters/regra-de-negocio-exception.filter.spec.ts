import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { RegraDeNegocioError } from '../../../domain/errors/regra-de-negocio.error';
import { RegraDeNegocioExceptionFilter } from './regra-de-negocio-exception.filter';

describe('RegraDeNegocioExceptionFilter', () => {
  const criarHost = (json = jest.fn()) => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json,
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    return { host, response };
  };

  it('expõe somente mensagens de negócio pré-definidas', () => {
    const { host, response } = criarHost();
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    new RegraDeNegocioExceptionFilter().catch(
      new RegraDeNegocioError(MENSAGENS_ERRO.precoInvalido),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: MENSAGENS_ERRO.precoInvalido }),
    );
    expect(log).toHaveBeenCalledWith(
      `Regra de negócio rejeitada: ${MENSAGENS_ERRO.precoInvalido}`,
    );
    log.mockRestore();
  });

  it('omite mensagens não catalogadas', () => {
    const { host, response } = criarHost();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    new RegraDeNegocioExceptionFilter().catch(
      new RegraDeNegocioError('detalhe interno'),
      host,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: MENSAGENS_ERRO.dadosEntradaInvalidos,
      }),
    );
    expect(warn).toHaveBeenCalledWith(
      'RegraDeNegocioError com mensagem não catalogada; resposta genérica enviada.',
    );
    warn.mockRestore();
  });

  it('registra erro quando a resposta HTTP não pode ser serializada', () => {
    const erro = new Error('falha de escrita');
    const { host } = criarHost(
      jest.fn().mockImplementation(() => {
        throw erro;
      }),
    );
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    expect(() =>
      new RegraDeNegocioExceptionFilter().catch(
        new RegraDeNegocioError(MENSAGENS_ERRO.precoInvalido),
        host,
      ),
    ).toThrow(erro);
    expect(error).toHaveBeenCalledWith(
      'Falha ao serializar a resposta de regra de negócio.',
      erro.stack,
    );
    error.mockRestore();
  });
});
