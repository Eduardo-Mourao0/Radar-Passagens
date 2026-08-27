import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { RegraDeNegocioError } from '../../../domain/errors/regra-de-negocio.error';

@Catch(RegraDeNegocioError)
export class RegraDeNegocioExceptionFilter implements ExceptionFilter {
  catch(exception: RegraDeNegocioError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: exception.message,
      error: 'Bad Request',
    });
  }
}
