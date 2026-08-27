import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { RegraDeNegocioError } from '../../../domain/errors/regra-de-negocio.error';
import { RegraDeNegocioExceptionFilter } from './regra-de-negocio-exception.filter';

describe('RegraDeNegocioExceptionFilter', () => {
  const criarHost = () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    return { host, response };
  };

  it('expõe somente mensagens de negócio pré-definidas', () => {
    const { host, response } = criarHost();

    new RegraDeNegocioExceptionFilter().catch(
      new RegraDeNegocioError(MENSAGENS_ERRO.precoInvalido),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: MENSAGENS_ERRO.precoInvalido }),
    );
  });

  it('omite mensagens não catalogadas', () => {
    const { host, response } = criarHost();

    new RegraDeNegocioExceptionFilter().catch(
      new RegraDeNegocioError('detalhe interno'),
      host,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: MENSAGENS_ERRO.dadosEntradaInvalidos,
      }),
    );
  });
});
