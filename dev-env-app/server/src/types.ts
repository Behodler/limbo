import { SnapshotRestorer } from '@nomicfoundation/hardhat-network-helpers'
import { FastifyInstance } from 'fastify'

export type BehodlerDevEnv = {
  active: boolean
  snapshots: SnapshotRestorer[]
  node?: Promise<void>
  deployedAddresses?: { [name: string]: string }
}

export type StartDevEnv = () => Promise<void>

export interface BehodlerDevEnvFastifyInstance extends FastifyInstance {
  behodlerDevEnv?: BehodlerDevEnv
  startDevEnv?: StartDevEnv
}
