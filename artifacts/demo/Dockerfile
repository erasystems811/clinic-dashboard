FROM node:23-alpine

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy workspace root files needed to resolve catalog: references
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy only the demo package
COPY artifacts/demo ./artifacts/demo

# Install only demo dependencies
RUN pnpm install --frozen-lockfile --filter @workspace/era-demo

# Build
RUN pnpm --filter @workspace/era-demo build

EXPOSE 3002

CMD ["node", "artifacts/demo/server.cjs"]
