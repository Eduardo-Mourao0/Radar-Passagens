/*
  Warnings:

  - A unique constraint covering the columns `[chaveMonitoramento]` on the table `Rota` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `chaveMonitoramento` to the `Rota` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Rota" ADD COLUMN     "chaveMonitoramento" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Rota_chaveMonitoramento_key" ON "Rota"("chaveMonitoramento");
