FROM node:22-bookworm-slim
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci --include=dev
COPY apps/web/ ./
ARG NEXT_PUBLIC_API_URL
ARG API_INTERNA
RUN npm run build
ENV NODE_ENV=production
CMD ["npm","start"]
