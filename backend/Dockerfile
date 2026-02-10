# ---- Development stage ----
FROM node:20-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]

# ---- Production stage ----
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY --chown=appuser:appgroup package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=appuser:appgroup src ./src

USER appuser

EXPOSE 3001

CMD ["npm", "start"]
