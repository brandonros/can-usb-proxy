# can-usb-proxy
Remote diagnostic proxying via two-way OBD-II -> CAN -> USB -> UDP

## Server example (user running diagnostic software with VCI)

```shell
DEVICE_TYPE='gs_usb'
REQUEST_ARBITRATION_ID='0x64d'
REPLY_ARBITRATION_ID='0x5cd'
MODE='server'
SERVER_PORT='40000'
SERVER_ADDR='192.168.0.52'
CLIENT_PORT='40001'
CLIENT_ADDR='192.168.0.42'
node index.js
```

## Client example (user with vehicle)

```shell
DEVICE_TYPE='cp2102'
REQUEST_ARBITRATION_ID='0x64d'
REPLY_ARBITRATION_ID='0x5cd'
MODE='client'
SERVER_PORT='40000'
SERVER_ADDR='192.168.0.52'
CLIENT_PORT='40001'
CLIENT_ADDR='192.168.0.42'
node index.js
```
