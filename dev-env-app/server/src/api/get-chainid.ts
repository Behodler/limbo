import { BehodlerDevEnvFastifyInstance } from '../types'

export default function (fastify: BehodlerDevEnvFastifyInstance, _, done): void {
    fastify.get('/get-chain-id', getChainid)
    done()

    function getChainid() {
        if (fastify.behodlerDevEnv?.active) {
            return fastify.behodlerDevEnv?.set?.chainId
                ? fastify?.createInfoResponse?.('chainid fetched', {
                    chainDetails: { chainId: fastify.behodlerDevEnv?.set.chainId, primeAccount: fastify.behodlerDevEnv?.set.primeAccount },
                })
                : fastify?.createInfoResponse?.('no chainid found')
        } else {
            return fastify?.createInfoResponse?.('dev env not started')
        }
    }
}
