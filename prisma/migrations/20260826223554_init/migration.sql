-- CreateTable
CREATE TABLE "Rota" (
    "id" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "dataIda" TIMESTAMP(3) NOT NULL,
    "dataVolta" TIMESTAMP(3),
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoPreco" (
    "id" TEXT NOT NULL,
    "rotaId" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "moeda" TEXT NOT NULL,
    "companhia" TEXT NOT NULL,
    "coletadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoPreco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rota_ativa_idx" ON "Rota"("ativa");

-- CreateIndex
CREATE INDEX "HistoricoPreco_rotaId_coletadoEm_idx" ON "HistoricoPreco"("rotaId", "coletadoEm");

-- AddForeignKey
ALTER TABLE "HistoricoPreco" ADD CONSTRAINT "HistoricoPreco_rotaId_fkey" FOREIGN KEY ("rotaId") REFERENCES "Rota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
