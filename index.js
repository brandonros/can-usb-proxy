const dgram = require('dgram')
const util = require('util')
const debug = require('debug')('vci-proxy')
const GsUsb = require('gs_usb')
const Cp2102 = require('cp2102')

const requestArbitrationId = parseInt(process.env.REQUEST_ARBITRATION_ID, 16)
const replyArbitrationId = parseInt(process.env.REPLY_ARBITRATION_ID, 16)
const deviceType = process.env.DEVICE_TYPE
const mode = process.env.MODE

const udpSend = (socket, frame) => {
  const destinationPort = mode === 'client' ? process.env.SERVER_PORT : process.env.CLIENT_PORT
  const destinationAddress = mode === 'client' ? process.env.SERVER_ADDR : process.env.CLIENT_ADDR
  debug(`udpSend: frame=${frame.toString('hex')}`)
  return util.promisify(socket.send).call(socket, frame, destinationPort, destinationAddress)
}

const udpBind = async (socket) => {
  const port = mode === 'client' ? process.env.CLIENT_PORT : process.env.SERVER_PORT
  const address = mode === 'client' ? process.env.CLIENT_ADDR : process.env.SERVER_ADDR
  await util.promisify(socket.bind).call(socket, port, address)
  debug(`udpBind: address = ${socket.address().address} port = ${socket.address().port}`)
}

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
  // setup udp socket
  const socket = dgram.createSocket('udp4')
  // setup usb device
  const device = buildUsbDevice()
  await device.init()
  // send incoming UDP socket frames to USB device
  socket.on('message', async (frame) => {
    const arbitrationId = frame.readUInt32LE(0)
    const data = frame.slice(4)
    debug(`socketMessage: arbitrationId=${arbitrationId.toString(16)} data=${data.toString('hex')}`)
    await device.sendCanFrame(arbitrationId, data)
  })
  await udpBind(socket)
  // send incoming USB device frames to UDP socket
  device.on('frame', async (frame) => {
    const arbitrationId = frame.readUInt32LE(0)
    const data = frame.slice(4)
    const shouldProxyFrame = (mode === 'client' && arbitrationId === replyArbitrationId) ||
      (mode === 'server' && arbitrationId === requestArbitrationId)
    if (!shouldProxyFrame) {
      debug(`dropping frame; arbitrationId = ${arbitrationId.toString(16)}`)
      return
    }
    debug(`deviceFrame: arbitrationId=${arbitrationId.toString(16)} data=${data.toString('hex')}`)
    await udpSend(socket, frame)
  })
  // start USB device receive loop
  await device.recv()
}

run()
