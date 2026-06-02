FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/toolkit/package.json packages/toolkit/
COPY packages/api/package.json packages/api/
RUN pnpm install --frozen-lockfile
COPY packages/toolkit/tsconfig.json packages/toolkit/
COPY packages/toolkit/src/ packages/toolkit/src/
COPY packages/api/tsconfig.json packages/api/
COPY packages/api/src/ packages/api/src/
RUN pnpm --filter @outbound-tools/toolkit run build && pnpm --filter @outbound-tools/api run build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/toolkit/package.json packages/toolkit/
COPY packages/api/package.json packages/api/
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/packages/toolkit/dist packages/toolkit/dist
COPY --from=builder /app/packages/api/dist packages/api/dist
CMD ["node", "packages/api/dist/index.js"]
