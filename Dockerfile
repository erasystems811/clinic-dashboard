FROM node:23-alpine

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Workspace metadata
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json tsconfig.json ./

# Shared libraries (api-zod, db, etc.)
COPY lib ./lib

# All service source files
COPY artifacts/api-server ./artifacts/api-server
COPY artifacts/era-me ./artifacts/era-me
COPY artifacts/era-patient ./artifacts/era-patient
COPY artifacts/era-super-admin ./artifacts/era-super-admin
COPY artifacts/demo ./artifacts/demo

# Service dispatcher
COPY _start.cjs ./

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build all services
RUN pnpm --filter @workspace/api-server run build && \
    pnpm --filter @workspace/era-me run build && \
    pnpm --filter @workspace/era-patient run build && \
    pnpm --filter @workspace/era-super-admin run build && \
    pnpm --filter @workspace/era-demo run build

EXPOSE 3000

CMD ["node", "_start.cjs"]
