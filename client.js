import { PeerRPCClient } from "grenache-nodejs-http";
import Link from "grenache-nodejs-link";
import { exec } from 'child_process';
import * as dotenv from 'dotenv'

dotenv.config()

const {
    SIDE,
    PRICE,
    QUANTITY,
    TOKEN,
} = process.env

console.log(SIDE, PRICE, QUANTITY, TOKEN)

const generateWalletAddress = async () => {
    return new Promise((resolve, reject) => {
        exec('openssl rand -hex 20', (error, stdout, stderr) => {
            if (error) reject(error)
            if (stderr) reject(stderr)
            resolve(`0x${stdout.trim()}`)
        })
    })
}

const randomizer = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

const sleep = async (ms) => new Promise(resolve => setTimeout(resolve, ms))

const link = new Link({
    grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new PeerRPCClient(link, {})
peer.init()

// const walletAddress = "0x1da0e6EC3b90eD568739359381b73c0797d7e4a4"
const walletAddress = await generateWalletAddress()
const balance = {
    address: walletAddress,
    eth: randomizer(1, 10),
    bnb: randomizer(1, 100),
    usdc: randomizer(50000, 100000),
}
const tokens = ['eth', 'bnb', 'usdc']
const determination = ['sell', 'buy']
let balanceHash;


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

await sleep(2000)

const order = {
    clientId: walletAddress,
    token: TOKEN,
    side: SIDE,
    price: PRICE,
    quantity: QUANTITY,
}

// const order = {
//     clientId: walletAddress,
//     token: tokens[randomizer(0, 2)],
//     side: determination[randomizer(0, 1)],
//     price: randomizer(0, 5000),
//     quantity: randomizer(0, 10000),
// }

peer.request('createOrder', order, { timeout: 10000 }, (err, data) => {
    if (err) {
        console.error(err)
        process.exit(-1)
    }
    console.log(data)
})

await sleep(2000)

peer.request('getOrderInstance', { address: walletAddress }, { timeout: 10000 }, (err, data) => {
    if (err) {
        console.error(err)
        process.exit(-1)
    }
    console.log("Here is the OrderInstance", data)
})


