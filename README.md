# RadarPassagens ✈️

Serviço backend que monitora preços de passagens aéreas para rotas de interesse, consumindo a API da **Amadeus for Developers**. Cadastre uma rota (origem, destino, datas) e o sistema consulta os preços periodicamente, mantendo um histórico para acompanhar variações e encontrar a melhor oportunidade de compra.

## 💡 Motivação

Projeto pessoal para resolver um problema real: acompanhar manualmente a variação de preços de passagens é repetitivo e fácil de perder o timing. O RadarPassagens automatiza essa busca e mantém um histórico consultável.

## 🚀 Tecnologias

- **NestJS** — framework backend (Node.js/TypeScript)
- **Prisma ORM** — modelagem e acesso ao banco
- **PostgreSQL** — persistência dos dados
- **Docker** — ambiente de banco de dados
- **@nestjs/schedule** — jobs agendados (cron)
- **@nestjs/axios** — requisições HTTP
- **Amadeus API** — fonte de dados de voos (OAuth2, tier sandbox/gratuito)

## 🧱 Arquitetura

```
src/
├── amadeus/        # Integração com a API da Amadeus (OAuth2 + busca de voos)
├── rotas/          # CRUD de rotas monitoradas + histórico de preços
│   ├── rota.controller.ts
│   ├── rota.service.ts
│   └── price-check.job.ts   # Job agendado que verifica preços periodicamente
├── prisma/         # PrismaService e schema
└── app.module.ts
```

### Modelo de dados

```prisma
model Rota {
  id         String   @id @default(uuid())
  origem     String   // código IATA, ex: "BSB"
  destino    String   // ex: "GRU"
  dataIda    DateTime
  dataVolta  DateTime?
  ativa      Boolean  @default(true)
  criadoEm   DateTime @default(now())
  historicos HistoricoPreco[]
}

model HistoricoPreco {
  id         String   @id @default(uuid())
  rotaId     String
  rota       Rota     @relation(fields: [rotaId], references: [id])
  preco      Decimal
  moeda      String
  companhia  String
  coletadoEm DateTime @default(now())
}
```

## ⚙️ Funcionalidades

- Cadastro de rotas de interesse (origem, destino, datas de ida/volta)
- Job agendado que consulta a Amadeus periodicamente e salva o menor preço encontrado
- Histórico de preços por rota, com data de coleta
- Autenticação OAuth2 client credentials com cache de token

## 📦 Como rodar localmente

### Pré-requisitos
- Node.js
- Docker
- Conta gratuita na [Amadeus for Developers](https://developers.amadeus.com) (sandbox)

### Passos

```bash
# Clonar o repositório
git clone https://github.com/Eduardo-Mourao0/radar-passagens.git
cd radar-passagens

# Instalar dependências
npm install

# Subir o banco de dados
docker compose up -d

# Configurar variáveis de ambiente
cp .env.example .env
# preencher DATABASE_URL, AMADEUS_CLIENT_ID e AMADEUS_CLIENT_SECRET

# Rodar as migrations
npx prisma migrate dev

# Iniciar o servidor
npm run start:dev
```

## 📡 Endpoints

| Método | Rota                    | Descrição                              |
|--------|--------------------------|-----------------------------------------|
| POST   | `/rotas`                 | Cadastra uma nova rota para monitorar   |
| GET    | `/rotas/:id/historico`   | Retorna o histórico de preços da rota   |

### Exemplo de requisição

```json
POST /rotas
{
  "origem": "BSB",
  "destino": "GRU",
  "dataIda": "2026-12-10",
  "dataVolta": "2026-12-20"
}
```

## 🗺️ Próximos passos

- Endpoint de variação percentual de preço
- Alertas (e-mail/notificação) quando o preço cair abaixo de um valor definido
- Suporte a múltiplas datas por rota (busca de janela de preços)

## 👤 Autor

**Eduardo Mourão**
Estudante de Engenharia de Software (UCB) | Backend Developer
[GitHub](https://github.com/Eduardo-Mourao0)