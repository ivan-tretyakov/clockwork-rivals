FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/clockwork-rules/package.json packages/clockwork-rules/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=2567 DATA_DIR=/data
COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/web/package.json apps/web/package.json
COPY --from=build /app/apps/server/package.json apps/server/package.json
COPY --from=build /app/packages/clockwork-rules/package.json packages/clockwork-rules/package.json
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
VOLUME /data
EXPOSE 2567
CMD ["node", "dist/server/index.js"]
