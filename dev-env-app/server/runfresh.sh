cd ../../
yarn build:freshABI
cd dev-env-app/server
rm /tmp/deploy.lock
yarn start
