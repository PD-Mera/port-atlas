FROM node:22.18.0-bookworm-slim

WORKDIR /app

COPY frontend/package.json ./package.json
RUN npm install --include=dev --no-audit --no-fund

COPY frontend/ ./
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["npm", "run", "dev"]
