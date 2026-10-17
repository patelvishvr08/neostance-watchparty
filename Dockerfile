# The prebuilt client is included, so deployment needs no package install.
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/.afterhours TRUST_PROXY=1
COPY local-dist ./local-dist
COPY core ./core
COPY scripts/local-server.mjs ./scripts/local-server.mjs
RUN mkdir -p /app/.afterhours
EXPOSE 3000
CMD ["node", "scripts/local-server.mjs"]
