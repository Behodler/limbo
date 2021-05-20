FROM node:14

WORKDIR /app/
ENTRYPOINT ["node_modules/hardhat/internal/cli/cli.js"]