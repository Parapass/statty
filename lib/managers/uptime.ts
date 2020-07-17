import { BitStream } from 'bit-buffer'
import { IPlugin, IPluginReponse, Status } from '~plugins'
import { redis } from '~redis'
import { redisKey } from './persistence'

export const saveUptime: (
  plugin: IPlugin,
  timestamp: number,
  data: IPluginReponse
) => Promise<void> = async (plugin, timestamp, data) => {
  const now = new Date(timestamp)
  const minute = now.getHours() * 60 + now.getMinutes()
  const isUp =
    data.status === Status.Unreachable
      ? '1'
      : data.status === Status.Degraded
      ? '2'
      : data.status === Status.Operational
      ? '2'
      : '0'

  const key = redisKey(plugin, 'uptime')
  await redis.send_command('BITFIELD', key, 'SET', 'u2', `#${minute}`, isUp)
}

export const readUptime: (
  plugin: IPlugin
) => Promise<number | undefined> = async plugin => {
  const key = redisKey(plugin, 'uptime')
  const bytes = await redis.getBuffer(key)
  if (bytes === null) return undefined

  let upCount = 0
  let downCount = 0

  const u8 = Uint8Array.from(bytes)
  const bs = new BitStream(u8.buffer)
  while (bs.bitsLeft > 0) {
    const bit = bs.readBits(2, false)
    if (bit === 2) upCount++
    if (bit === 1) downCount++
  }

  const total = upCount + downCount
  return upCount / total
}
