# RadarPassagens

Backend para cadastrar rotas aéreas e manter o histórico de preços de passagens. O projeto é construído em NestJS, com PostgreSQL e Prisma, e foi organizado em camadas para manter as regras de negócio independentes de HTTP e banco de dados.

> A integração com a Amadeus e o job agendado já possuem a estrutura inicial, mas a consulta automática de preços ainda está em desenvolvimento.

## Tecnologias

- Node.js e TypeScript
- NestJS 11
- PostgreSQL 16
- Prisma ORM
- Zod para validação de entradas HTTP
- Docker Compose para o ambiente local do banco

## Arquitetura

```text
src/
├── application/              # Casos de uso e comandos da aplicação
│   └── rotas/
├── domain/                   # Entidades, erros e contratos de repositório
│   └── rotas/
├── infra/                    # Adaptadores: HTTP, Prisma e Amadeus
│   ├── database/prisma/
│   ├── http/
│   └── amadeus/
└── main/                     # Bootstrap e composição dos módulos NestJS
```

O domínio depende apenas de abstrações. Por exemplo, os casos de uso recebem o contrato `RotasRepository`; a implementação com Prisma fica em `infra/database`.

## Pré-requisitos

- Node.js 20 ou superior
- Docker Desktop com Docker Compose

## Como executar

```bash
git clone https://github.com/Eduardo-Mourao0/Radar-Passagens.git
cd Radar-Passagens
npm install
```

Crie o arquivo de ambiente a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Suba o PostgreSQL e aplique as migrations:

```bash
docker compose up -d
npx prisma migrate dev
```

Por fim, inicie a API:

```bash
npm run start:dev
```

A aplicação fica disponível em `http://localhost:3000`.

## Variáveis de ambiente

O arquivo `.env.example` contém valores locais prontos para o Docker.

| Variável            | Descrição                            |
| ------------------- | ------------------------------------ |
| `PORT`              | Porta HTTP da API. Padrão: `3000`.   |
| `POSTGRES_USER`     | Usuário do PostgreSQL no container.  |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL no container.    |
| `POSTGRES_DB`       | Nome do banco de dados.              |
| `POSTGRES_PORT`     | Porta exposta pelo PostgreSQL.       |
| `DATABASE_URL`      | String de conexão usada pelo Prisma. |

Nunca envie o arquivo `.env` para o repositório.

## Endpoints disponíveis

| Método | Rota                   | Descrição                              |
| ------ | ---------------------- | -------------------------------------- |
| `POST` | `/rotas`               | Cadastra uma rota para monitoramento.  |
| `GET`  | `/rotas`               | Lista as rotas cadastradas.            |
| `GET`  | `/rotas/:id/historico` | Retorna o histórico de preços da rota. |

### Criar rota

```http
POST /rotas
Content-Type: application/json

{
  "origem": "BSB",
  "destino": "GRU",
  "dataIda": "2026-12-10",
  "dataVolta": "2026-12-20"
}
```

Regras aplicadas no cadastro:

- origem e destino devem ser códigos IATA de três letras maiúsculas e diferentes;
- a ida deve ser hoje ou uma data futura;
- a volta, quando informada, não pode ser anterior à ida;
- uma rota idêntica ativa não pode ser cadastrada novamente;
- ao cadastrar novamente uma rota idêntica inativa, ela é reativada.

### Respostas de erro

- `400 Bad Request`: formato inválido ou regra de negócio não atendida;
- `404 Not Found`: rota não encontrada ao consultar histórico;
- `409 Conflict`: rota idêntica já está ativa.

## Dados persistidos

Uma `Rota` possui origem, destino, datas, status e uma chave de monitoramento única. Cada `HistoricoPreco` pertence a uma rota e armazena preço decimal, moeda, companhia e horário da coleta.

O histórico usa o índice `(rotaId, coletadoEm DESC)` para consultas eficientes dos registros mais recentes.

## Comandos úteis

```bash
# Desenvolvimento
npm run start:dev

# Build de produção
npm run build

# Testes unitários
npm test

# Testes end-to-end
npm run test:e2e

# Gerar cliente Prisma
npm run prisma:generate

# Criar migration após alterar prisma/schema.prisma
npx prisma migrate dev --name descricao_da_mudanca

# Interface visual do banco
npm run prisma:studio
```

## Próximos passos

- Implementar autenticação OAuth2 e busca de ofertas pela API Amadeus.
- Executar a coleta periódica pelo job agendado.
- Registrar preços encontrados usando o caso de uso de histórico.
- Adicionar alertas para quedas de preço.

## Autor

Eduardo Mourão — [GitHub](https://github.com/Eduardo-Mourao0)
