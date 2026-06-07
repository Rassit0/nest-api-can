# 1. Fase de construcción
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Generamos el cliente de Prisma local y compilamos con el comando nativo de Nest
RUN npx prisma generate
RUN npm run build

# 2. Fase de producción
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./

# Instalamos solo las dependencias de producción
RUN npm ci --omit=dev

# Copiamos lo compilado y todo lo necesario de Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma 

EXPOSE 3000

# Cuando el contenedor se encienda en Coolify, ejecutará las migraciones,
# el seed y finalmente arrancará tu API de NestJS en vivo.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]