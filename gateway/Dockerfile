FROM node:22.19.0-alpine3.22

WORKDIR /app

COPY package.json ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=3000

USER node

EXPOSE 3000

CMD ["node", "src/server.mjs"]
