import { takeSnapshot, SnapshotRestorer } from '@nomicfoundation/hardhat-network-helpers'
import path from 'path'
import fs from 'fs'
import { fork } from 'child_process'

import { ProcessMessage } from './types'
import { stringifyMessage } from './utils'

const paths = {
  hardhatDeployedAddresses: path.resolve(
    __dirname,
    '../../../scripts/networks/addresses/hardhat.json',
  ),
  startDevEnvScript: path.resolve(__dirname, '../../../scripts/start-dev-node.ts'),
  testDevEnvScript: path.resolve(__dirname, '../../../scripts/test-dev-env.ts'),
}

const snapshots: SnapshotRestorer[] = []

process.on('message', async (msg: ProcessMessage) => {
  console.log(`child process: message received: ${stringifyMessage(msg)}`)

  if (msg.type === 'start') {
    try {
      if (fs.existsSync(paths.hardhatDeployedAddresses)) {
        console.log(`removing ${paths.hardhatDeployedAddresses}`)
        fs.rmSync(paths.hardhatDeployedAddresses)
        console.log('file removed, starting dev env')
      }

      fork(paths.startDevEnvScript)
      // hre.run('run', { script: paths.startDevEnvScript })
    } catch (error) {
      console.error('start task error', error)
    }
  }

  if (msg.type === 'createSnapshot') {
    try {
      const snapshot = await takeSnapshot()
      snapshots.push(snapshot)
      console.log(`snapshot ${snapshot.snapshotId} saved`)
    } catch (error) {
      console.error('createSnapshot task error', error)
    }
  }

  if (msg.type === 'getSnapshots') {
    try {
      process?.send?.({ type: 'snapshots', data: snapshots })
    } catch (error) {
      console.error('getSnapshots task error', error)
    }
  }

  if (msg.type === 'restoreSnapshot') {
    try {
      const snapshot = snapshots.find(({ snapshotId }) => snapshotId === msg.data)

      if (snapshot) {
        await snapshot.restore()
        process?.send?.({
          type: 'snapshotRestored',
          data: `snapshot ${snapshot?.snapshotId} restored`,
        })
        console.log(`snapshot ${snapshot?.snapshotId} restored`)
      }
    } catch (error) {
      process?.send?.({ type: 'snapshotRestoringFailed', data: error })
      console.error('restoreSnapshot task error', error)
    }
  }

  if (msg.type === 'test') {
    try {
      fork(paths.testDevEnvScript)
      console.log('test script started')
    } catch (error) {
      console.error('test task error', error)
    }
  }
})
