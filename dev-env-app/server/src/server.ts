import Fastify, { FastifyInstance } from 'fastify'
import hre from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import path from 'path'
import { safeDeploy } from '../../../scripts/networks/orchestrate'

export const fastify: FastifyInstance = Fastify({
  logger: {
    transport: {
      target: "@fastify/one-line-logger",
    },
  },
})

function hreManager() {

}

fastify.get('/start', async () => {
  // const { chainId } = await hre.ethers.provider.getNetwork()
  const node = hre.run('run', { script: path.resolve(__dirname, '../../../scripts/start-dev-node.ts') })
  // await safeDeploy(chainId, 2, 9)
  return await node
})

fastify.listen({ port: 6667 })
