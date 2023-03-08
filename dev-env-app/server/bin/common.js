const parseArgv = require('minimist');

const parsedArgv = parseArgv(process.argv)
const serverPort = parsedArgv.p || parsedArgv.port || 6667

const getRequestOptions = ({ path, method = 'GET' }) => ({
  hostname: 'localhost',
  port: serverPort,
  path,
  method,
  headers: {
    'Content-Type': 'application/json',
  },
})

const responseHandler = res => {
  res.on('data', data => {
    console.log(`${res.statusCode} ${res.statusMessage}`, data.toString())
  })
}

module.exports = { getRequestOptions, responseHandler, parsedArgv }
