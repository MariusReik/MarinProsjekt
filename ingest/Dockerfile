# Build stage: compile TypeScript
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Runtime stage: production deps only
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
# Default: AIS stream ingest. The localities refresher runs from the same
# image with: node dist/localities-main.js (see docker-compose.prod.yml).
CMD ["node", "dist/stream-main.js"]
