FROM node:22-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/pgi-mock/package.json ./apps/pgi-mock/
COPY packages/mock-service-kit/package.json ./packages/mock-service-kit/
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/mock-service-kit/ ./packages/mock-service-kit/
COPY apps/pgi-mock/ ./apps/pgi-mock/
COPY package.json tsconfig.base.json ./
RUN npm run build --workspace=@pouetpouet/pgi-mock
# Compile @pouetpouet/mock-service-kit to JS so Node.js can import it at runtime (no tsx in prod).
RUN npx tsc --project packages/mock-service-kit/tsconfig.json && \
    node --eval "const fs=require('fs');const p=JSON.parse(fs.readFileSync('packages/mock-service-kit/package.json','utf8'));p.main='./dist/index.js';p.types='./dist/index.d.ts';p.exports={'.':'./dist/index.js'};fs.writeFileSync('packages/mock-service-kit/package.json',JSON.stringify(p,null,2))"

# Run
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/pgi-mock/dist ./apps/pgi-mock/dist
COPY --from=builder /app/apps/pgi-mock/package.json ./apps/pgi-mock/package.json
COPY --from=builder /app/package.json ./package.json
# node_modules/@pouetpouet/mock-service-kit is a symlink — copy the actual target so it resolves correctly.
COPY --from=builder /app/packages/mock-service-kit ./packages/mock-service-kit
EXPOSE 4100
CMD ["node", "/app/apps/pgi-mock/dist/index.js"]
