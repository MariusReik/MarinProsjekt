# Build stage: Vite production build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Edge stage: Caddy serves the SPA and terminates TLS, proxying /api and /ws
# to the Spring Boot container (mirrors the Vite dev proxy).
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
