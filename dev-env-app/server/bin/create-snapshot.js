const http = require('http')

const { getRequestOptions, responseHandler } = require('./common')

const createSnapshot = http.request(
  getRequestOptions({
    path: '/create-snapshot',
    method: 'POST',
  }),
  responseHandler,
)

createSnapshot.write('{}')
createSnapshot.end()
