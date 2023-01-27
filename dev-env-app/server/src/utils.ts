import { ProcessMessage } from './types'

export function stringifyMessage(msg: ProcessMessage): string {
  try {
    if (!msg?.type && !msg?.data) {
      return ''
    }

    if (!msg?.data) {
      return msg.type
    }

    if (!msg?.type) {
      return JSON.stringify(msg.data)
    }

    return `${msg.type}: ${JSON.stringify(msg.data)}`
  } catch {
    return ''
  }
}
