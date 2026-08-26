# AGENTS.md — RadarPassagens

Este arquivo orienta agentes de IA (Codex e similares) trabalhando neste repositório. Siga estas diretrizes antes de gerar ou alterar código.

## Sobre o projeto

RadarPassagens é um backend em NestJS que monitora preços de passagens aéreas via API da Amadeus. Rotas cadastradas (origem, destino, datas) são consultadas periodicamente por um job agendado, e o histórico de preços é persistido no PostgreSQL via Prisma.

## Stack

- **Node.js + TypeScript**
- **NestJS** — framework principal (módulos, controllers, services, DI)
- **Prisma ORM** — acesso a dados, sempre via `PrismaService`, nunca instanciar `PrismaClient` direto fora dele
- **PostgreSQL** — banco relacional
- **@nestjs/schedule** — jobs/cron
- **@nestjs/axios** — chamadas HTTP externas
- **Docker Compose** — ambiente local de banco

## Estrutura de pastas

```
src/
├── amadeus/     # integração externa (OAuth2 + busca de voos)
├── rotas/       # domínio principal: rota + histórico de preço
├── prisma/      # PrismaService
└── app.module.ts
```

Novos domínios seguem o mesmo padrão: cada módulo tem `*.module.ts`, `*.controller.ts`, `*.service.ts`, e `dto/` quando houver payloads de entrada.

## Convenções de código

- **Nomenclatura de domínio em português** (Rota, HistoricoPreco, verificarPreco), mantendo consistência com o schema Prisma já existente. Nomes técnicos genéricos (DTO, Service, Controller, Module) seguem o padrão do NestJS em inglês.
- **DTOs** para toda entrada de dados em endpoints — usar `class-validator` para validação (`@IsString()`, `@IsISO8601()`, etc.), não validar manualmente dentro do service.
- **Injeção de dependência** via construtor, nunca instanciar services manualmente.
- **Erros** — usar as exceptions do Nest (`NotFoundException`, `BadRequestException`, etc.), nunca lançar `Error` genérico em código de aplicação.
- **Variáveis de ambiente** — sempre via `@nestjs/config` (`ConfigService`), nunca `process.env` direto dentro de services (exceção: bootstrap/config module).
- **Sem lógica de negócio no controller** — controller só recebe requisição, valida via DTO e delega ao service.
- **Chamadas externas (Amadeus)** ficam isoladas no módulo `amadeus/`; outros módulos nunca chamam a API externa diretamente.

## Clean Architecture

O projeto segue os princípios de Clean Architecture adaptados à estrutura modular do NestJS. Objetivo: regra de negócio isolada de detalhes de infraestrutura (banco, API externa, framework).

- **Camadas por módulo:**
  - **Controller** — camada de entrada (HTTP), só traduz requisição/resposta, sem regra de negócio.
  - **Service** — camada de aplicação/domínio, onde vive a regra de negócio (ex: decidir se um novo preço deve gerar um registro de histórico).
  - **Integrações externas** (`amadeus/`) — camada de infraestrutura, isolada atrás de uma interface clara (`AmadeusService`), para que o domínio nunca dependa diretamente de detalhes da API da Amadeus (formato de resposta, autenticação, etc.).
  - **Prisma** (`prisma/`) — também é infraestrutura; o domínio não deve depender de tipos gerados pelo Prisma além do necessário para persistência.

- **Regra de dependência:** camadas internas (regra de negócio) nunca dependem de camadas externas (framework, banco, API). O `RotaService` não deve saber como a Amadeus formata sua resposta — isso é responsabilidade do `AmadeusService`, que devolve um objeto já normalizado ao domínio.

- **Inversão de dependência:** ao evoluir o projeto, preferir depender de abstrações (interfaces) em vez de implementações concretas quando a lógica de negócio crescer — por exemplo, se no futuro trocar a Amadeus por outro provedor de voos, a mudança deve ficar isolada em `amadeus/`, sem tocar em `rotas/`.

- **Idempotência e integridade:** operações que persistem dados (ex: salvar um novo preço) devem ser pensadas para não duplicar registros inconsistentes — validar antes de persistir, não confiar apenas na camada de banco.

- **Sem regra de negócio em DTOs ou entidades do Prisma:** DTOs validam formato de entrada; entidades do Prisma representam persistência. Regra de negócio fica sempre no service.

## Banco de dados

- Toda alteração de schema passa por `npx prisma migrate dev --name <descricao>` — nunca editar o banco manualmente.
- Nunca commitar migration gerada sem revisar o SQL resultante.
- Queries complexas ficam no service, não no controller.

## Segurança e boas práticas

- Nunca commitar `.env` ou credenciais da Amadeus — manter `.env.example` atualizado sempre que uma nova variável for adicionada.
- Tratar falhas de chamada externa (timeout, rate limit, resposta vazia) sem deixar o job quebrar para as demais rotas — logar e continuar o loop.
- Cache do token OAuth2 da Amadeus deve respeitar o tempo de expiração retornado pela API, nunca hardcoded.
- Não expor detalhes de erro interno (stack trace, mensagens de exceptions de terceiros) diretamente nas respostas da API.

## Testes

- Novo service ou lógica de negócio relevante deve vir acompanhado de teste unitário (`*.spec.ts`), usando o padrão de testes do Nest (`Test.createTestingModule`).
- Mockar chamadas HTTP externas (Amadeus) nos testes — nunca bater na API real durante testes automatizados.

## O que evitar

- Não usar `any` sem justificativa — tipar DTOs, respostas de service e retornos de método.
- Não duplicar lógica de consulta à Amadeus fora do `AmadeusService`.
- Não misturar responsabilidade de agendamento (`price-check.job.ts`) com regra de negócio — o job apenas orquestra, a lógica fica no `RotaService`.
- Não adicionar dependências novas sem necessidade clara — o projeto prioriza stack enxuta.

## Ao propor mudanças

Explique brevemente o racional antes de gerar código extenso. Priorize consistência com os padrões já estabelecidos no repositório em vez de introduzir estilos novos.