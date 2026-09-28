FROM node:24-bookworm-slim

WORKDIR /app

# Install only the server's production dependencies. The generated browser
# bundles are committed under apps/nexus-web/public and do not need rebuilding.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY apps/nexus-web ./apps/nexus-web

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    NEXUS_DATA_DIR=/data

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "apps/nexus-web/server.js"]
