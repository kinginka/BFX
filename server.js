
import { PeerRPCServer } from 'grenache-nodejs-http'
import Link from 'grenache-nodejs-link'

const sleep = async (ms) => new Promise(resolve => setTimeout(resolve, ms))

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

// initalize the orderbooks
link.put({ v: JSON.stringify([]) }, (err, hash) => {
    // console.log(`orderbook saved to the DHT`, err, hash);
    orderbookHash = hash
})

setInterval(function () {
    link.announce('rpc_test', service.port, {})
    link.announce('createOrder', service.port, {})
    link.announce('getOrderInstance', service.port, {})
}, 1000)

service.on('request', (rid, key, payload, handler) => {
    // console.log(rid)
    // console.log(key)
    // console.log(payload) //  { msg: 'hello' }

    // First say hello and register the client the wallet address and its balance
    if (key === 'rpc_test') {
        const { hash } = payload
        if (hash) {
            link.get(hash, (err, res) => {
                // console.log('data requested to the DHT', err, res)

                const balance = JSON.parse(res.v)
                clients[balance.address] = { hash, ...balance }

                // console.log('here is clients :', clients)
                // clients.push({ hash: balance })
            })
        }
        handler.reply(null, { msg: 'world' })
    }

    // Creates order and matches order
    if (key === 'createOrder' && flag == false) {
        const order = payload
        const clientBalance = clients[order.clientId]
        // console.log('Client Balance', clientBalance)

        // Check if the client can buy or sell
        if (order.side === 'buy') {
            // check if the client can buy
            if (order.token === 'eth' && clientBalance.usdc >= order.price * order.quantity) {
                handler.reply(null, { msg: 'Creating Order Failed' })
            }
            if (order.token === 'bnb' && clientBalance.usdc >= order.price * order.quantity) {
                handler.reply(null, { msg: 'Creating Order Failed' })
            }
        } else {
            // check if the client can sell
            if (order.token === 'eth' && clientBalance.eth <= order.quantity) {
                handler.reply(null, { msg: 'Creating Order Failed' })
            }
            if (order.token === 'bnb' && clientBalance.bnb <= order.quantity) {
                handler.reply(null, { msg: 'Creating Order Failed' })
            }
        }
        flag = true
        link.get(orderbookHash, async (err, res) => {
            // console.log('orderbookHash requested to the DHT', err, res)
            if (err) {
                console.error(err)
                process.exit(-1)
            }
            // Get Orderbooks from node
            let orderbooks = JSON.parse(res.v)
            // Get orders matched with the current order.
            const matches = orderbooks.filter((o) => o.side !== order.side && o.price === order.price && o.token === order.token)
            // Process the order
            for (const match of matches) {
                const executedQuantity = Math.min(match.quantity, order.quantity)
                match.quantity -= executedQuantity
                order.quantity -= executedQuantity

                // Change the balance of two wallet addresses
                const matchBalance = clients[match.clientId]
                const orderBalance = clients[order.clientId]
                if (match.side === 'buy') {
                    if (match.token === 'eth') {
                        matchBalance.eth += executedQuantity
                        matchBalance.usdc -= executedQuantity * currentEtherToUSDC
                        orderBalance.eth -= executedQuantity
                        orderBalance.usdc += executedQuantity * currentEtherToUSDC
                    }
                    if (match.token === 'bnb') {
                        matchBalance.bnb += executedQuantity
                        matchBalance.usdc -= executedQuantity * currentBNBToUSDC
                        orderBalance.bnb += executedQuantity
                        orderBalance.usdc -= executedQuantity * currentBNBToUSDC
                    }
                }
                else {
                    if (match.token === 'eth') {
                        matchBalance.eth -= executedQuantity
                        matchBalance.usdc += executedQuantity * currentEtherToUSDC
                        orderBalance.eth += executedQuantity
                        orderBalance.usdc -= executedQuantity * currentEtherToUSDC
                    }
                    if (match.token === 'bnb') {
                        matchBalance.bnb -= executedQuantity
                        matchBalance.usdc += executedQuantity * currentBNBToUSDC
                        orderBalance.bnb -= executedQuantity
                        orderBalance.usdc += executedQuantity * currentBNBToUSDC
                    }
                }
                // console.log('MatchBalance', matchBalance)
                link.put({ v: JSON.stringify(matchBalance) }, (err, hash) => {
                    console.log(`matchBalance saved to the DHT`, err, hash);
                    if (err) {
                        console.error(err)
                        process.exit(-1)
                    }
                    clients[match.clientId].hash = hash
                    console.log("Changed Clients", clients)
                })
                await sleep(1000)

                // console.log('OrderBalance', orderBalance)
                link.put({ v: JSON.stringify(orderBalance) }, (err, hash) => {
                    console.log(`orderBalance saved to the DHT`, err, hash);
                    if (err) {
                        console.error(err)
                        process.exit(-1)
                    }
                    clients[order.clientId].hash = hash
                    console.log("Changed Clients", clients)
                })
                await sleep(1000)

                if (match.quantity === 0) {
                    orderbooks = orderbooks.filter((order) => order.rid !== match.rid)
                }
            }
            if (order.quantity > 0) {
                orderbooks.push({ rid, ...order })
            }
            console.log("Updated Orderbooks", orderbooks)

            // Save orderbooks to node
            link.put({ v: JSON.stringify(orderbooks) }, (err, hash) => {
                // console.log(`orderbook saved to the DHT`, err, hash);
                if (err) {
                    console.error(err)
                    process.exit(-1)
                }
                orderbookHash = hash
            })
        })
        handler.reply(null, { msg: 'Successfully Added the order' })
        flag = false
    }

    // Return OrderBook instance to client
    if (key === 'getOrderInstance') {
        const { address } = payload
        // console.log('address', address)
        link.get(orderbookHash, (err, res) => {
            // console.log('orderbookHash requested to the DHT', err, res)
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
