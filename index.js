const WebSocket = require('ws')
const util = require('util')
const debug = require('debug')('vci-proxy')
const GsUsb = require('gs_usb')
const Cp2102 = require('cp2102')

const requestArbitrationId = parseInt(process.env.REQUEST_ARBITRATION_ID, 16)
const replyArbitrationId = parseInt(process.env.REPLY_ARBITRATION_ID, 16)
const deviceType = process.env.DEVICE_TYPE

const buildUsbDevice = () => {
  if (deviceType === 'gs_usb') {
    return new GsUsb()
  } else if (deviceType === 'cp2102') {
    return new Cp2102()
  } else {
    throw new Error(`Invalid device type: ${deviceType}`)
  }
}

const run = async () => {
  // setup usb device
  const device = buildUsbDevice()
  await device.init()
  // setup socket
  let wss = null
  let connections = []
  wss = new WebSocket.Server({
    host: process.env.SERVER_ADDR,
    port: process.env.SERVER_PORT
  })
  wss.on('connection', (ws) => {
    // send incoming socket frames to USB device
    ws.on('message', async (frame) => {
      const arbitrationId = frame.readUInt32LE(0)
      const data = frame.slice(4)
      debug(`socketMessage: arbitrationId=${arbitrationId.toString(16)} data=${data.toString('hex')}`)
      await device.sendCanFrame(arbitrationId, data)
    })
    // register connection in array
    connections.push(ws)
  })
  // send incoming USB device frames to socket
  device.on('frame', (frame) => {
    const arbitrationId = frame.readUInt32LE(0)
    const data = frame.slice(4)
    const shouldProxyFrame = arbitrationId === requestArbitrationId
    if (!shouldProxyFrame) {
      debug(`dropping frame; arbitrationId = ${arbitrationId.toString(16)}`)
      return
    }
    debug(`deviceFrame: arbitrationId=${arbitrationId.toString(16)} data=${data.toString('hex')}`)
    // send to connections
    for (let i = 0; i < connections.length; ++i) {
      connections[i].send(frame)
    }
  })
  // start USB device receive loop
  await device.recv()
}

run()
