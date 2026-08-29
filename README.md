# RadarPassagens

Backend para cadastrar rotas aéreas e manter o histórico de preços de passagens. O projeto é construído em NestJS, com PostgreSQL e Prisma, e foi organizado em camadas para manter as regras de negócio independentes de HTTP e banco de dados.

> A integração com a Ignav consulta tarifas verificadas e o job agendado registra o menor preço encontrado a cada seis horas.

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
├── infra/                    # Adaptadores: HTTP, Prisma e Ignav
│   ├── database/prisma/
│   ├── http/
│   └── ignav/
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

| Variável             | Descrição                                            |
| -------------------- | ---------------------------------------------------- |
| `PORT`               | Porta HTTP da API. Padrão: `3000`.                   |
| `NODE_ENV`           | Ambiente da aplicação. Use `development` localmente. |
| `FRONTEND_URL`       | Domínio do frontend permitido pelo CORS em produção. |
| `POSTGRES_USER`      | Usuário do PostgreSQL no container.                  |
| `POSTGRES_PASSWORD`  | Senha do PostgreSQL no container.                    |
| `POSTGRES_DB`        | Nome do banco de dados.                              |
| `POSTGRES_PORT`      | Porta exposta pelo PostgreSQL.                       |
| `DATABASE_URL`       | String de conexão usada pelo Prisma.                 |
| `IGNAV_API_KEY`      | Chave privada da API Ignav.                          |
| `IGNAV_BASE_URL`     | URL base da API Ignav.                               |
| `TELEGRAM_BOT_TOKEN` | Token privado do bot criado no BotFather.            |
| `TELEGRAM_CHAT_ID`   | Identificador do chat ou grupo que recebe alertas.   |

Nunca envie o arquivo `.env` para o repositório.

Em desenvolvimento, o CORS aceita somente `http://localhost:5173`. Em produção, defina `FRONTEND_URL` com o domínio público do frontend, por exemplo `https://radar-passagens-web.example.com`.

### Configurar o Telegram

1. No Telegram, abra o perfil `@BotFather`, envie `/newbot` e copie o token fornecido.
2. Envie qualquer mensagem para o bot criado.
3. Acesse `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates` no navegador e copie o valor de `message.chat.id` retornado.
4. Preencha no seu `.env`:

```env
TELEGRAM_BOT_TOKEN=seu_token
TELEGRAM_CHAT_ID=seu_chat_id
```

Para receber em um grupo, adicione o bot ao grupo, envie uma mensagem nele e repita o passo 3. O `chat_id` de grupos normalmente é negativo.

## Endpoints disponíveis

| Método   | Rota                      | Descrição                                        |
| -------- | ------------------------- | ------------------------------------------------ |
| `POST`   | `/rotas`                  | Cadastra uma rota para monitoramento.            |
| `GET`    | `/rotas`                  | Lista as rotas cadastradas, com suas metas.      |
| `PATCH`  | `/rotas/:id/desativar`    | Interrompe o monitoramento de uma rota.          |
| `PATCH`  | `/rotas/:id/reativar`     | Retoma o monitoramento de uma rota.              |
| `DELETE` | `/rotas/:id`              | Exclui uma rota e todos os dados vinculados.     |
| `GET`    | `/rotas/:id/historico`    | Retorna o histórico de preços da rota.           |
| `PUT`    | `/rotas/:id/alerta-preco` | Define o preço-alvo para alertar sobre uma rota. |
| `POST`   | `/rotas/verificar-precos` | Executa a coleta manualmente em desenvolvimento. |

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

### Desativar rota

```http
PATCH /rotas/:id/desativar
```

A rota deixa de ser consultada pelo job, mas o histórico e o alerta configurado são preservados. Repetir a requisição não causa erro.

### Reativar rota

```http
PATCH /rotas/:id/reativar
```

A rota volta a participar das coletas periódicas. Repetir a requisição não causa erro. Rotas cuja data de ida já passou não podem ser reativadas; o job também desativa automaticamente rotas vencidas antes de cada ciclo de coleta.

### Excluir rota

```http
DELETE /rotas/:id
```

A exclusão é permanente. O banco remove em cascata o alerta configurado e todo o histórico de preços associado à rota.

### Respostas de erro

- `400 Bad Request`: formato inválido ou regra de negócio não atendida;
- `404 Not Found`: rota não encontrada ao consultar histórico;
- `409 Conflict`: rota idêntica já está ativa.

### Executar verificação manual

Em desenvolvimento, envie uma requisição sem body:

```http
POST /rotas/verificar-precos
```

O endpoint espera a consulta e a persistência terminarem. Em produção ele é bloqueado para impedir disparos públicos de consultas pagas.

### Configurar alerta de preço

Defina o valor máximo que você aceita pagar pela rota:

```http
PUT /rotas/:id/alerta-preco
Content-Type: application/json

{
  "precoAlvo": "1500.00"
}
```

Quando uma nova coleta encontrar um preço menor ou igual ao valor definido, a aplicação dispara o alerta. Enquanto o preço permanecer nessa faixa, não há avisos repetidos. Se o preço subir acima da meta, o alerta é rearmado para uma próxima queda. Atualizar a meta também o rearma, para que uma próxima coleta elegível possa gerar um novo aviso.

O alerta é entregue pelo Telegram. A regra foi isolada do canal de entrega, permitindo acrescentar e-mail ou outro canal depois sem mudar a regra de negócio.

## Dados persistidos

Uma `Rota` possui origem, destino, datas, status e uma chave de monitoramento única. Cada `HistoricoPreco` pertence a uma rota e armazena preço decimal, moeda, companhia e horário da coleta. Uma rota pode ter um `AlertaPreco`, com preço-alvo e o estado do último disparo.

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

- Adicionar um segundo canal de entrega, como e-mail.

## Autor

Eduardo Mourão — [GitHub](https://github.com/Eduardo-Mourao0)
