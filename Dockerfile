FROM oven/bun:1.3.14 AS bun
FROM node:22-bookworm-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/nut-fountain/package.json packages/nut-fountain/package.json
COPY apps/playground/package.json apps/playground/package.json
RUN bun install --frozen-lockfile
COPY packages/nut-fountain packages/nut-fountain
COPY apps/playground apps/playground
RUN bun run build

FROM nginx:stable-alpine
COPY apps/playground/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/playground/dist /usr/share/nginx/html
EXPOSE 8080
