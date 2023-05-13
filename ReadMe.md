# BFX Test Assignment

## Step up environment

```sh
npm install
```

## To start the server

```sh
sh server.sh
```

## To start the client

```sh
sh client.sh eth buy 100 5
```

The first arguement is token. eg. 'eth' or 'bnb'
The second arguement is side. eg. 'buy' or 'sell'
The third arguement is price.
The last arguement is quantity.

## Discribe the codes at client side

Create Link and Establish a P2P connection

```js

const link = new Link({
    grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new PeerRPCClient(link, {})
peer.init()
```

Get random wallet address and random balance, and Save the balance to the node.

If we get the wallet address from ui in the real world, there is no need to save it to node.

```js
const walletAddress = await generateWalletAddress()
const balance = {
    address: walletAddress,
    eth: randomizer(1, 10),
    bnb: randomizer(1, 100),
    usdc: randomizer(50000, 100000),
}
const tokens = ['eth', 'bnb', 'usdc']       // only trade with eth and bnb right now
const determination = ['sell', 'buy']

link.put({ v: JSON.stringify(balance) }, (err, hash) => {
    console.log(`Balance saved to the DHT`, err, hash);
    if (hash == 'No nodes to query') {
        process.exit(-1);
    }
    balanceHash = hash
    peer.map('rpc_test', { msg: 'hello', hash: balanceHash }, { timeout: 10000 }, (err, data) => {
        if (err) {
            console.error(err)
            process.exit(-1)
        }
        console.log(data)
    })
})
```

Make an order and Add the order to orderbook.

```js
const order = {
    clientId: walletAddress,
    token: TOKEN,
    side: SIDE,
    price: PRICE,
    quantity: QUANTITY,
}

peer.request('createOrder', order, { timeout: 10000 }, (err, data) => {
    if (err) {
        console.error(err)
        process.exit(-1)
    }
    console.log(data)
})
```
Request to get the OrderBook instance.

```js
peer.request('getOrderInstance', { address: walletAddress }, { timeout: 10000 }, (err, data) => {
    if (err) {
        console.error(err)
        process.exit(-1)
    }
    console.log("Here is the OrderInstance", data)
})

```

## Discribe the codes at server side

Create an Link and establish a PearRPCServer.

```js
const link = new Link({
    grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new PeerRPCServer(link, {
    timeout: 300000
})
peer.init()
```

Set the current Ether value and BNB value.

The values can get from Market information in the real world.

```js
const currentEtherToUSDC = 2000
const currentBNBToUSDC = 300
```

Announce the service.

rpc_test : To say hello and save the client wallet address to node.

createOrder : To create an order and match the orders

getOrderInstance : To return the orderbook instance for specific client.


```js
setInterval(function () {
    link.announce('rpc_test', service.port, {})
    link.announce('createOrder', service.port, {})
    link.announce('getOrderInstance', service.port, {})
}, 1000)
```

### rpc_test
Get the balance from given hash.

```js
// First say hello and register the client the wallet address and its balance
if (key === 'rpc_test') {

    // acquire the lock before processing the request
    const release = await mutex.acquire()

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

    // release the lock once the critical section is complete
    release()

    handler.reply(null, { msg: 'world' })
}
```

### createOrder
First check if the client can perform the order.

```js
const order = payload
const clientBalance = clients[order.clientId]
console.log('Client Balance', clientBalance)

// Check if the client can buy or sell
if (order.side === 'buy') {
    // check if the client can buy
    if (order.token === 'eth' && clientBalance.usdc >= order.price * order.quantity) {
        handler.reply(null, { msg: 'Creating Order Failed, Insufficient Ether' })
        return
    }
    if (order.token === 'bnb' && clientBalance.usdc >= order.price * order.quantity) {
        handler.reply(null, { msg: 'Creating Order Failed, Insufficient BNB' })
        return
    }
} else {
    // check if the client can sell
    if (order.token === 'eth' && clientBalance.eth <= order.quantity) {
        handler.reply(null, { msg: 'Creating Order Failed, Insufficient USDC' })
        return
    }
    if (order.token === 'bnb' && clientBalance.bnb <= order.quantity) {
        handler.reply(null, { msg: 'Creating Order Failed, Insufficient USDC' })
        return
    }
}
```

First check if the client can perform the order.

```js
const order = payload
const clientBalance = clients[order.clientId]
console.log('Client Balance', clientBalance)

// Check if the client can buy or sell
if (order.side === 'buy') {
    // check if the client can buy
    if (order.token === 'eth' && clientBalance.usdc >= order.price * order.quantity) {
        handler.reply(null, { msg: 'Creating Order Failed, Insufficient Ether' })
        return
    }
    if (order.token === 'bnb' && clientBalance.usdc >= order.price * order.quantity) {
        handler.reply(null, { msg: 'Creating Order Failed, Insufficient BNB' })
        return
    }
} else {
    // check if the client can sell
    if (order.token === 'eth' && clientBalance.eth <= order.quantity) {
        handler.reply(null, { msg: 'Creating Order Failed, Insufficient USDC' })
        return
    }
    if (order.token === 'bnb' && clientBalance.bnb <= order.quantity) {
        handler.reply(null, { msg: 'Creating Order Failed, Insufficient USDC' })
        return
    }
}
```

First, Get OrderBook from orderbookHash.
Second, Find the matches with the order and if there is a match, performs the order.
Third, If remains, then add the order to the orderbook.

```js
// acquire the lock before processing the request
const release = await mutex.acquire()

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

        // Change the balances of two wallet addresses
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
// release the lock once the critical section is complete
release()

handler.reply(null, { msg: 'Successfully Added the order' })
```

### getOrderInstance

Get the orderbook instance for given address.

```js
// Return OrderBook instance to client
if (key === 'getOrderInstance') {
    const { address } = payload
    // console.log('address', address)

    // acquire the lock before processing the request
    const release = await mutex.acquire()

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

    // release the lock once the critical section is complete
    release()
}
```