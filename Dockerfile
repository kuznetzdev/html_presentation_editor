FROM node:20-alpine

WORKDIR /app

COPY . .

ENV HOST=0.0.0.0
ENV PORT=4173

EXPOSE 4173

CMD ["sh", "-c", "node scripts/static-server.js . ${PORT:-4173} ${HOST:-0.0.0.0}"]
