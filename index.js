const dgram = require('dgram')
const debug = require('debug')('vci-proxy')
const GsUsb = require('gs_usb')
const Cp2102 = require('cp2102')

const requestArbitrationId = parseInt(process.env.REQUEST_ARBITRATION_ID, 16)
const replyArbitrationId = parseInt(process.env.REPLY_ARBITRATION_ID, 16)
const deviceType = process.env.DEVICE_TYPE
const mode = process.env.MODE

const udpSend = (socket, frame) => {
  return new Promise((resolve, reject) => {
    const destinationPort = mode === 'client' ? process.env.SERVER_PORT : process.env.CLIENT_PORT
    const destinationAddress = mode === 'client' ? process.env.SERVER_ADDR : process.env.CLIENT_ADDR
    debug(`udpSend: frame=${frame.toString('hex')}`)
    socket.send(frame, destinationPort, destinationAddress, (err) => {
      if (err) {
        return reject(err)
      }
      resolve()
    })
  })
}

const udpBind = (socket) => {
  return new Promise((resolve, reject) => {
    const port = mode === 'client' ? process.env.CLIENT_PORT : process.env.SERVER_PORT
    const address = mode === 'client' ? process.env.CLIENT_ADDR : process.env.SERVER_ADDR
    socket.bind(port, address, (err) => {
      if (err) {
        return reject(err)
      }
      debug(`udpBind: address = ${socket.address().address} port = ${socket.address().port}`)
      resolve()
    })
  })
}

const run = async () => {
  // setup udp socket
  const socket = dgram.createSocket('udp4')
  await udpBind(socket)
  // setup usb device
  let device = null
  if (deviceType === 'gs_usb') {
    device = new GsUsb()
  } else if (deviceType === 'cp2102') {
    device = new Cp2102()
  } else {
    throw new Error(`Invalid device type: ${deviceType}`)
  }
  await device.init()
  // send incoming UDP socket frames to USB device
  socket.on('message', async (frame) => {
    const arbitrationId = frame.readUInt32LE(0)
    const data = frame.slice(4)
    debug(`socketMessage: arbitrationId=${arbitrationId.toString(16)} data=${data.toString('hex')}`)
    await device.sendCanFrame(arbitrationId, data)
  })
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
