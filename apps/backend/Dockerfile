FROM node:22-bookworm-slim
WORKDIR /app
COPY apps/backend/package*.json ./
RUN npm ci --include=dev
COPY apps/backend/ ./
RUN npm run build
ENV NODE_ENV=production
CMD ["sh","-c","node importar-cuentas.cjs && exec npm start"]

