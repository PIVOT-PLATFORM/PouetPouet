FROM node:20-alpine AS base
RUN apk add --no-cache openssl

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY package.json tsconfig.base.json ./
RUN npm run build --workspace=@pouetpouet/api
# Compile @pouetpouet/shared to JS so Node.js can import it at runtime (no tsx in prod).
# Also patch package.json to point to dist/ instead of src/ TypeScript source.
RUN npx tsc --project packages/shared/tsconfig.json && \
    node --eval "const fs=require('fs');const p=JSON.parse(fs.readFileSync('packages/shared/package.json','utf8'));p.main='./dist/index.js';p.types='./dist/index.d.ts';p.exports={'.':'./dist/index.js'};fs.writeFileSync('packages/shared/package.json',JSON.stringify(p,null,2))"

# Run
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/package.json ./package.json
# node_modules/@pouetpouet/shared is a symlink — copy the actual target so it resolves correctly.
COPY --from=builder /app/packages/shared ./packages/shared
EXPOSE 8080
CMD ["sh", "-c", "/app/node_modules/.bin/prisma migrate deploy --schema=/app/apps/api/prisma/schema.prisma && node /app/apps/api/dist/index.js"]
