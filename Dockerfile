FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Fail fast if an old checkout still has Supabase entrypoints under src/ (they compile into .next).
RUN if [ -f src/lib/supabase_admin.ts ]; then echo "BUILD BLOCKED: remove src/lib/supabase_admin.ts from the build context."; exit 1; fi \
 && if [ -f src/lib/supabase.ts ]; then echo "BUILD BLOCKED: remove src/lib/supabase.ts from the build context."; exit 1; fi

RUN npm run build

EXPOSE 3000

# Run migrations then standalone (if built) or next start — do not use plain "next start" here;
# Coolify "Start Command" must match this or be empty so image CMD is used (avoid overriding with `next start`).
CMD ["node", "scripts/run-prod-server.mjs"]
