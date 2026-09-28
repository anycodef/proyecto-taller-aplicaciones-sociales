# Asistencia — imagen de producción (SPEC §2).
# Etapa 1 compila TypeScript; etapa 2 lleva solo dependencias de producción y dist/.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# En la nube el CORS lo maneja el gateway (SPEC §3): por defecto "production".
# docker-compose.yml lo sobrescribe con "development" para la demo local.
ENV NODE_ENV=production \
    PORT=3002
EXPOSE 3002
USER node
CMD ["node", "dist/main.js"]
