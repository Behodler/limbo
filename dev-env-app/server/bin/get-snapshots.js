const http = require('http')

const { getRequestOptions, responseHandler } = require('./common')

const createSnapshot = http.request(
  getRequestOptions({
    path: '/get-snapshots',
  }),
  responseHandler,
)

createSnapshot.write('{}')
createSnapshot.end()
