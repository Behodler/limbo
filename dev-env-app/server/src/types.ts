import { SnapshotRestorer } from '@nomicfoundation/hardhat-network-helpers'
import { FastifyInstance } from 'fastify'

import { recipeNames } from '../../../scripts/networks/common'

export type BehodlerDevEnv = {
  active: boolean
  snapshots: SnapshotRestorer[]
  node?: Promise<void>
  deployedAddresses?: { [name: string]: string }
}

export type StartDevEnv = () => Promise<void>

export type ResponseObject = {
  message: string
  data?: {}
}

export type CreateResponse = (message: string, data?: {}) => ResponseObject

export interface BehodlerDevEnvFastifyInstance extends FastifyInstance {
  behodlerDevEnv?: BehodlerDevEnv
  startDevEnv?: StartDevEnv
  createInfoResponse?: CreateResponse
  createErrorResponse?: CreateResponse
}

export interface BehodlerDevEnvDeploymentConfig {
  miningIntervalMs: number
  autoMining: boolean
  recipeName: recipeNames
  confirmationsNumber: number
  addressesJSONFilePath: string
}

export interface BehodlerDevEnvRuntimeConfig {
  miningIntervalMs: number
  autoMining: boolean
}

export interface BehodlerDevEnvNodeSettings {
  noDeploy: boolean
  silent: boolean
  port: number
}
