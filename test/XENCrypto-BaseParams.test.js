// SPDX-License-Identifier: MIT

const assert = require('assert')
// const truffleAssert = require('truffle-assertions')
const timeMachine = require('ganache-time-traveler');

const XENCrypto = artifacts.require("XENCrypto")

const { bn2hexStr, toBigInt, maxBigInt, etherToWei } = require('../src/utils.js')

contract("XEN Crypto (Base Params)", async accounts => {

    const genesisRank = 21
    const expectedInitialAMP = 3_000n
    const expectedInitialEEAR = 100
    const expectedInitialAPY = 20
    let token
    let expectedStakeId = genesisRank
    let genesisTs

    before(async () => {
        try {
            token = await XENCrypto.deployed()
            genesisTs = await token.genesisTs().then(_ => _.toNumber())
        } catch (e) {
            console.error(e)
        }
    })

    it("Should read basic ERC-20 params", async () => {
        assert.ok(await token.name() === 'XEN Crypto')
        assert.ok(await token.symbol() === 'XEN')
    })

    it("Should start stake IDs (ranks) with number 21", async () => {
        assert.ok(await token.globalRank().then(_ => _.toNumber()) === expectedStakeId)
    })

    it("Should return correct initial AMP", async () => {
        assert.ok(await token.getCurrentAMP().then(toBigInt) === expectedInitialAMP)
    })

    it("Should return correct initial EAA Rate", async () => {
        assert.ok(await token.getCurrentEAAR().then(_ => _.toNumber()) === expectedInitialEEAR)
    })

    it("Should return correct initial APY", async () => {
        assert.ok(await token.getCurrentAPY().then(_ => _.toNumber()) === expectedInitialAPY)
    })

    it("Should return correct AMP in 1 year", async () => {
        const snapshot = await timeMachine.takeSnapshot();
        const snapshotId = snapshot['result'];
        const deltaTs = 3600 * 24 * 30 * 12
        const expectedAMP =
            maxBigInt(
                expectedInitialAMP - (30n * BigInt(deltaTs) / (3600n * 24n * 30n)),
                1n
            )
        // console.log(expectedAMP)
        try {
            // const genesisTs = await token.genesisTs().then(_ => _.toNumber())
            await timeMachine.advanceBlockAndSetTime(genesisTs + deltaTs)
            assert.ok(await token.getCurrentAMP().then(toBigInt) === expectedAMP)
        } catch (err) {
            // console.log(err)
            throw(err)
        } finally {
            await timeMachine.revertToSnapshot(snapshotId);
        }
    })

   it("Should return correct terminal AMP in 100+ months", async () => {
        const snapshot = await timeMachine.takeSnapshot();
        const snapshotId = snapshot['result'];

        try {
            const deltaTs = 3600 * 24 * 30 * 101
            const expectedTerminalAMP =
                maxBigInt(
                    expectedInitialAMP - 30n * (BigInt(deltaTs) / (3600n * 24n * 30n)),
                    1n
                )
            await timeMachine.advanceBlockAndSetTime(genesisTs + deltaTs)
            assert.ok(await token.getCurrentAMP().then(toBigInt) === expectedTerminalAMP)
        } catch (err) {
            throw(err)
        } finally {
            await timeMachine.revertToSnapshot(snapshotId);
        }
   })

    it("Should return correct APY in 1 year", async () => {
        const snapshot = await timeMachine.takeSnapshot();
        const snapshotId = snapshot['result'];

        try {
            const deltaTs = 3600 * 24 * 30 * 12 + 1
            const expectedAPY =
                Math.max(expectedInitialAPY - Math.floor(deltaTs / (3600 * 24 * 90)), 2)
            await timeMachine.advanceTime(deltaTs)
            await timeMachine.advanceBlock()
            assert.ok(await token.getCurrentAPY().then(_ => _.toNumber()) === expectedAPY)
        } catch (err) {
            throw(err)
        } finally {
            await timeMachine.revertToSnapshot(snapshotId);
        }
    })

    it("Should return correct terminal APY in 42 months", async () => {
        const snapshot = await timeMachine.takeSnapshot();
        const snapshotId = snapshot['result'];

        try {
            const deltaTs = 3600 * 24 * 30 * 18 * 3 + 1
            const expectedTerminalAPY =
                Math.max(expectedInitialAPY - Math.floor(deltaTs / (3600 * 24 * 90)), 2)
            await timeMachine.advanceTime(deltaTs)
            await timeMachine.advanceBlock()
            assert.ok(await token.getCurrentAPY().then(_ => _.toNumber()) === expectedTerminalAPY)
        } catch (err) {
            throw(err)
        } finally {
            await timeMachine.revertToSnapshot(snapshotId);
        }
    })

})

