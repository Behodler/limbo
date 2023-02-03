const http = require('http')

const { getRequestOptions, responseHandler, parsedArgv } = require('./common')

const snapshotId = parsedArgv.id || parsedArgv.snapshotId

if (!snapshotId) {
  console.error('Please provide a snapshot id using --id or --snapshotId argument')
  process.exit(1)
}

if (typeof snapshotId !== 'string') {
  console.error('snapshot id must be a string, try eg. yarn restore-snapshot --id \'"my-snapshot-id"\'')
  process.exit(1)
}

const createSnapshot = http.request(
  getRequestOptions({
    path: '/restore-snapshot',
    method: 'POST',
  }),
  responseHandler,
)

console.log(`{ "snapshotId": ${snapshotId} }`)

createSnapshot.write(`{ "snapshotId": ${snapshotId} }`)
createSnapshot.end()
