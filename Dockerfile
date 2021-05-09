FROM node:14

WORKDIR /app/
COPY package.json package.json
RUN yarn install

ENTRYPOINT ["node_modules/hardhat/internal/cli/cli.js"]