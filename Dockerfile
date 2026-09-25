# syntax=docker/dockerfile:1

# =========================================================
# 1. Dependencias completas (build)
# =========================================================
FROM node:24-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci


# =========================================================
# 2. Dependencias de producción
# BuildKit puede ejecutar esta fase EN PARALELO con deps
# =========================================================
FROM node:24-alpine AS prod-deps

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev


# =========================================================
# 3. Build
# =========================================================
FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npx prisma generate

RUN npx nest build


# =========================================================
# 4. Runtime
# =========================================================
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

# Dependencias de producción ya preparadas en paralelo
COPY --from=prod-deps /app/node_modules ./node_modules

# Aplicación compilada
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Prisma Client generado en ruta personalizada
COPY --from=builder /app/src/generated ./src/generated

# Configuración necesaria para Prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Mantener esto SOLO si `prisma` está en devDependencies y
# start:migrate:prod ejecuta `prisma migrate deploy`
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

EXPOSE 3000

CMD ["sh", "-c", "npm run start:migrate:prod"]