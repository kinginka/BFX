
// import { PeerRPCServer } from 'grenache-nodejs-http'
// import Link from 'grenache-nodejs-link'
// const { PeerRPCServer } = require('grenache-nodejs-http')
// const Link = require('grenache-nodejs-link')
const async = require('async')
// const sleep = async (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function example() {
    console.log('Start')
    await setTimeout(() => {
    }, 2000); // Sleep for 2 seconds
    console.log('End')
}

example(100000).then(() => {
    console.log("End")
})