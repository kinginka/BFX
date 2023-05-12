
import { PeerRPCServer } from 'grenache-nodejs-http'
import Link from 'grenache-nodejs-link'

const link = new Link({
    grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new PeerRPCServer(link, {
    timeout: 300000
})
peer.init()

let orderbookHash
let flag = false
const clients = {}
const currentEtherToUSDC = 2000
const currentBNBToUSDC = 300

const port = 1024 + Math.floor(Math.random() * 1000)
const service = peer.transport('server')
service.listen(port)

link.put({ v: JSON.stringify([]) }, (err, hash) => {
    console.log(`orderbook saved to the DHT`, err, hash);
    orderbookHash = hash
})

setInterval(function () {
    link.announce('rpc_test', service.port, {})
    link.announce('createOrder', service.port, {})
    link.announce('getOrderInstance', service.port, {})
}, 1000)

service.on('request', (rid, key, payload, handler) => {
    console.log(rid)
    console.log(key)
    console.log(payload) //  { msg: 'hello' }
    if (key === 'rpc_test') {
        const { hash } = payload
        if (hash) {
            link.get(hash, (err, res) => {
                console.log('data requested to the DHT', err, res)
                const balance = JSON.parse(res.v)
                clients[balance.address] = { hash, ...balance }

                // console.log('here is clients :', clients)
                // clients.push({ hash: balance })
            })
        }
        handler.reply(null, { msg: 'world' })
    }
    if (key === 'createOrder') {
        const order = payload
        console.log('Get Order', order)
        const clientBalance = clients[order.clientId]
        if (order.side === 'buy') {
            // check if the client can buy
        } else {
            // check if the client can sell
        }
        flag = true
        link.get(orderbookHash, (err, res) => {
            console.log('orderbookHash requested to the DHT', err, res)
            if (err) {
                console.error(err)
                process.exit(-1)
            }
            let orderbooks = JSON.parse(res.v)
            const matches = orderbooks.filter((o) => o.side !== order.side && o.price === order.price && o.token === order.token)
            for (const match of matches) {
                const executedQuantity = Math.min(match.quantity, order.quantity)
                match.quantity -= executedQuantity
                order.quantity -= executedQuantity

                if (match.quantity === 0) {
                    orderbooks = orderbooks.filter((order) => order.rid !== match.rid)
                }
            }
            if (order.quantity > 0) {
                orderbooks.push({ rid, ...order })
            }
            console.log("Updated Orderbooks", orderbooks)
            link.put({ v: JSON.stringify(orderbooks) }, (err, hash) => {
                console.log(`orderbook saved to the DHT`, err, hash);
                if (err) {
                    console.error(err)
                    process.exit(-1)
                }
                orderbookHash = hash
            })
        })
        handler.reply(null, { msg: 'Successfully Added the order' })
    }
    if (key === 'getOrderInstance') {
        const { address } = payload
        console.log('address', address)
        link.get(orderbookHash, (err, res) => {
            console.log('orderbookHash requested to the DHT', err, res)
            if (err) {
                console.error(err)
                handler.reply(null, { msg: 'failed' })
            }
            let orderbooks = JSON.parse(res.v)
            const matches = orderbooks.filter((o) => o.clientId === address)
            handler.reply(null, { OrderBooks: matches })
        })
    }
})
