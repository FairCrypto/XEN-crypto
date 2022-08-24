// SPDX-License-Identifier: MIT

const assert = require('assert')
const truffleAssert = require('truffle-assertions')
const timeMachine = require('ganache-time-traveler');

const XMath = artifacts.require("Math")

const bn2hexStr = (bn) => '0x' + (bn?.toString(16)?.padStart(64, '0') || '0')

const MAX_UINT256 = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'

contract("Math", async accounts => {

    let math

    before(async () => {
        try {
            math = await XMath.deployed()
        } catch (e) {
            console.error(e)
        }
    })

    const Log2 = (x) => math && math.log2(x).then(_ => _.toNumber())
    const Min = (x,y) => math && math.min(x, y).then(_ => _.toNumber())
    const MinN = (x,y) => math && math.min(x, y).then(bn2hexStr).then(BigInt)
    const Max = (x,y) => math && math.max(x, y).then(_ => _.toNumber())
    const MaxN = (x,y) => math && math.max(x, y).then(bn2hexStr).then(BigInt)

    it("Function min(x,y) shall return expected result for x=1,y=2", async () => {
        assert.ok(await Min(1,2) === 1)
    })

    it("Function min(x,y) shall return expected result for x=MAX_UINT256-1,y=0", async () => {
        assert.ok(await Min(MAX_UINT256,0) === 0)
    })

    it("Function max(x,y) shall return expected result for x=1,y=2", async () => {
        assert.ok(await Max(1,2) === 2)
    })

    it("Function max(x,y) shall return expected result for x=MAX_UINT256-1,y=0", async () => {
        assert.ok(await MaxN(MAX_UINT256,0) === BigInt(MAX_UINT256))
    })

    it("Function log2(x) shall return expected result for sequential x=1...1000", async () => {
        for await (const i of new Array(1000).fill(null).map((_,i) => i + 1)) {
            const res = await Log2(i)
            assert.ok(res === Math.floor(Math.log2(i)) || res === Math.ceil(Math.log2(i)))
        }
    })

    it("Function log2(x) shall return expected result for 100 random values x=1...MAX_UINT256-1", async () => {
        for await (const i of new Array(100).fill(null)) {
            const random = await crypto.randomBytes(32)
            const x = '0x' + random.toString('hex')
            const res = await Log2(x)
            assert.ok(res === BigInt(x).toString(2).length || res === BigInt(x).toString(2).length - 1)
            //
        }
    })

})
