// SPDX-License-Identifier: MIT

const assert = require('assert')
const crypto = require('crypto')
const { parseFixed, formatFixed, FixedNumber, FixedFormat} = require('@ethersproject/bignumber')

const XMath = artifacts.require("Math")

const { bn64x64ToFloat } = require("../src/utils");

const MAX_UINT256 = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'

contract("New Math (based on ABDK implementation)", async accounts => {

    let math
    const Log2 = (x) => math && math.logX64(x).then(bn64x64ToFloat(10_000))
    const compareWithFixed4 = (n1, n2) => Math.floor(n1 * 10_000) === Math.floor(n2 * 10_000)

    before(async () => {
        try {
            math = await XMath.deployed()
        } catch (e) {
            console.error(e)
        }
    })

    it("Function log2x64() shall return log2(x) as expected", async () => {
        assert.ok(compareWithFixed4(await Log2(1), Math.log2(1)))
        assert.ok(compareWithFixed4(await Log2(2), Math.log2(2)))
        assert.ok(compareWithFixed4(await Log2(100), Math.log2(100)))
        assert.ok(compareWithFixed4(await Log2(1_000), Math.log2(1_000)))
        assert.ok(compareWithFixed4(await Log2(10_000), Math.log2(10_000)))
        assert.ok(compareWithFixed4(await Log2(100_000), Math.log2(100_000)))
        assert.ok(compareWithFixed4(await Log2(1_000_000), Math.log2(1_000_000)))
        assert.ok(compareWithFixed4(await Log2(10_000_000), Math.log2(10_000_000)))
        assert.ok(compareWithFixed4(await Log2(100_000_000), Math.log2(100_000_000)))
    })

})
