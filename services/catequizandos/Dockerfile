FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
ENV PORT=3001
# Solo se usa con REPOSITORIO=sqlite (por defecto el almacén es en memoria)
RUN mkdir -p /app/data && chown node:node /app/data
EXPOSE 3001
USER node
CMD ["node", "dist/main.js"]
