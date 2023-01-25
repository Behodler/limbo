import Fastify, { FastifyInstance } from 'fastify'
import hre from 'hardhat'

export const fastify: FastifyInstance = Fastify({
  logger: true,
})

fastify.get('/start-hardhat-node', async () => {
  await hre.run('node', { noDeploy: true });
})

fastify.listen({ port: 6667 })
