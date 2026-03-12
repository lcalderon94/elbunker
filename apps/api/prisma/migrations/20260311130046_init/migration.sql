-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "mapWidth" INTEGER NOT NULL DEFAULT 720,
    "mapHeight" INTEGER NOT NULL DEFAULT 520,
    "furniture" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "posX" DOUBLE PRECISION NOT NULL,
    "posY" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 65,
    "shape" TEXT NOT NULL DEFAULT 'rect',
    "adjacentIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hour" TEXT NOT NULL,
    "people" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "eventType" TEXT,
    "notes" TEXT,
    "isCombined" BOOLEAN NOT NULL DEFAULT false,
    "isSpecialRequest" BOOLEAN NOT NULL DEFAULT false,
    "staffNotes" TEXT,
    "cancelToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationTable" (
    "reservationId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,

    CONSTRAINT "ReservationTable_pkey" PRIMARY KEY ("reservationId","tableId")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "reservationId" TEXT,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "externalId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "playersMin" INTEGER NOT NULL,
    "playersMax" INTEGER NOT NULL,
    "playersBest" INTEGER,
    "durationMin" INTEGER NOT NULL,
    "durationMax" INTEGER NOT NULL,
    "ageMin" INTEGER NOT NULL DEFAULT 8,
    "difficulty" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mechanic" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Mechanic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Type" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameCategory" (
    "gameId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "GameCategory_pkey" PRIMARY KEY ("gameId","categoryId")
);

-- CreateTable
CREATE TABLE "GameMechanic" (
    "gameId" TEXT NOT NULL,
    "mechanicId" INTEGER NOT NULL,

    CONSTRAINT "GameMechanic_pkey" PRIMARY KEY ("gameId","mechanicId")
);

-- CreateTable
CREATE TABLE "GameType" (
    "gameId" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,

    CONSTRAINT "GameType_pkey" PRIMARY KEY ("gameId","typeId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_slug_key" ON "Zone"("slug");

-- CreateIndex
CREATE INDEX "Table_zoneId_idx" ON "Table"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Table_zoneId_code_key" ON "Table"("zoneId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_cancelToken_key" ON "Reservation"("cancelToken");

-- CreateIndex
CREATE INDEX "Reservation_date_hour_idx" ON "Reservation"("date", "hour");

-- CreateIndex
CREATE INDEX "Reservation_customerEmail_idx" ON "Reservation"("customerEmail");

-- CreateIndex
CREATE INDEX "Reservation_cancelToken_idx" ON "Reservation"("cancelToken");

-- CreateIndex
CREATE UNIQUE INDEX "Game_externalId_key" ON "Game"("externalId");

-- CreateIndex
CREATE INDEX "Game_name_idx" ON "Game"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationTable" ADD CONSTRAINT "ReservationTable_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationTable" ADD CONSTRAINT "ReservationTable_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCategory" ADD CONSTRAINT "GameCategory_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCategory" ADD CONSTRAINT "GameCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMechanic" ADD CONSTRAINT "GameMechanic_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMechanic" ADD CONSTRAINT "GameMechanic_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Mechanic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameType" ADD CONSTRAINT "GameType_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameType" ADD CONSTRAINT "GameType_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
