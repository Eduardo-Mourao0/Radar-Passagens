import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  MENSAGENS_ERRO,
  MENSAGENS_ERRO_PUBLICAS,
} from '../../../domain/errors/mensagens-erro';
import { RegraDeNegocioError } from '../../../domain/errors/regra-de-negocio.error';

@Catch(RegraDeNegocioError)
export class RegraDeNegocioExceptionFilter implements ExceptionFilter {
  catch(exception: RegraDeNegocioError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mensagem = MENSAGENS_ERRO_PUBLICAS.has(exception.message)
      ? exception.message
      : MENSAGENS_ERRO.dadosEntradaInvalidos;

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: mensagem,
      error: 'Bad Request',
    });
  }
}
