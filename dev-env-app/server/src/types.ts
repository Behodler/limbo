import { SnapshotRestorer } from '@nomicfoundation/hardhat-network-helpers'
import { FastifyInstance } from 'fastify'

//Clean code: microservices should always duplicate type definitions to avoid tight coupling, even if this increases the risk of type errors.
export type recipeNames = 'testnet' | 'statusquo' | 'onlyPyroV3' | 'onlyLimbo'

export interface ITokenConfig {
  displayName: string,
  pyroDisplayName: string,
  address: string,
  pyroV2Address: string
  pyroV3Address:string
}

export interface ContractSet {
  protocol:  { [name: string]: string },
  tokens: ITokenConfig[]
}
export type BehodlerDevEnv = {
  active: boolean
  snapshots: SnapshotRestorer[]
  node?: Promise<void>
  set?: ContractSet
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
