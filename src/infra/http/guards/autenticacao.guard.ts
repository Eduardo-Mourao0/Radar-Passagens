import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessaoService } from '../../autenticacao/sessao.service';

@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(private readonly sessaoService: SessaoService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const partes = request.headers.authorization?.split(' ') ?? [];
    const [tipo, token] = partes;
    if (partes.length !== 2 || tipo !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    const payload = this.sessaoService.validarAccessToken(token);
    request.usuario = { id: payload.sub };
    return true;
  }
}
