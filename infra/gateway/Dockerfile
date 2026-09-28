FROM node:20-slim
WORKDIR /app
COPY gateway.js ./
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "gateway.js"]
