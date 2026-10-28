FROM node:24-bookworm-slim

WORKDIR /app

# Install only the server's production dependencies. The generated browser
# bundles are committed under apps/nexus-web/public and do not need rebuilding.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY apps/nexus-web ./apps/nexus-web

# The commit the image was built from, when the builder can pass one in (`--build-arg
# NEXUS_BUILD_COMMIT=<sha>`). Railway exports `RAILWAY_GIT_COMMIT_SHA` to the built service on its own,
# and `lib/build-info.js` reads that when this is empty, so `GET /api/version` can always name the
# deployment — and a phone can refuse to publish an authored page to a build that predates it.
ARG NEXUS_BUILD_COMMIT=""
ENV NEXUS_BUILD_COMMIT=${NEXUS_BUILD_COMMIT}

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    NEXUS_DATA_DIR=/data

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "apps/nexus-web/server.js"]
