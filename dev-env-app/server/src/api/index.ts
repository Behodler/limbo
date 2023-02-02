import { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'

import { BehodlerDevEnvFastifyInstance } from '../types'
import createSnapshot from './create-snapshot'
import restoreSnapshot from './restore-snapshot'
import getSnapshots from './get-snapshots'
import getDeploymentAddresses from './get-deployment-addresses'

export function api(fastify: BehodlerDevEnvFastifyInstance, _, done) {
  fastify.register(createSnapshot)
  fastify.register(restoreSnapshot)
  fastify.register(getSnapshots)
  fastify.register(getDeploymentAddresses)

  fastify.get('/test-get-balances', async () => {
    const [sender, receiver] = await ethers.getSigners()
    const senderETHBalance = ethers.utils.formatEther(await sender.getBalance())
    const receiverETHBalance = ethers.utils.formatEther(await receiver.getBalance())
    fastify.log.info(
      `ETH balances: sender has ${senderETHBalance}, receiver has ${receiverETHBalance}`,
    )
    return { senderETHBalance, receiverETHBalance }
  })

  fastify.post('/test-send-eth', async () => {
    const [sender, receiver] = await ethers.getSigners()
    fastify.log.info('Sending 1 ETH from sender to receiver')
    const tx = await sender.sendTransaction({
      to: receiver.address,
      value: ethers.utils.parseEther('1'),
    })
    fastify.log.info(`Tx sent: ${tx.hash}`)
    return { txHash: tx.hash }
  })

  done()
}
