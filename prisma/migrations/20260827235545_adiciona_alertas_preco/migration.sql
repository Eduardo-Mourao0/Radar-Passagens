-- CreateTable
CREATE TABLE "AlertaPreco" (
    "id" TEXT NOT NULL,
    "rotaId" TEXT NOT NULL,
    "precoAlvo" DECIMAL(10,2) NOT NULL,
    "disparado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertaPreco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertaPreco_rotaId_key" ON "AlertaPreco"("rotaId");

-- AddForeignKey
ALTER TABLE "AlertaPreco" ADD CONSTRAINT "AlertaPreco_rotaId_fkey" FOREIGN KEY ("rotaId") REFERENCES "Rota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
