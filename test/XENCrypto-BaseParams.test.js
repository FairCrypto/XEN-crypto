// SPDX-License-Identifier: MIT

const assert = require('assert')
// const truffleAssert = require('truffle-assertions')
const timeMachine = require('ganache-time-traveler');

const XENCrypto = artifacts.require("XENCrypto")

const { bn2hexStr, toBigInt, maxBigInt, etherToWei } = require('../src/utils.js')

contract("XEN Crypto (Base Params)", async accounts => {

    const genesisRank = 21
    const expectedInitialAMP = 3_000
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
        assert.ok(await token.getCurrentAMP().then(_ => _.toNumber()) === expectedInitialAMP)
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
            Math.max(
                expectedInitialAMP - (30 * deltaTs) / (3600 * 24 * 30),
                1
            )
        // console.log(expectedAMP)
        try {
            // const genesisTs = await token.genesisTs().then(_ => _.toNumber())
            await timeMachine.advanceBlockAndSetTime(genesisTs + deltaTs)
            assert.ok(await token.getCurrentAMP().then(_ => _.toNumber()) === expectedAMP)
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
                Math.max(
                    expectedInitialAMP - 30 * deltaTs / (3600 * 24 * 30),
                    1
                )
            await timeMachine.advanceBlockAndSetTime(genesisTs + deltaTs)
            assert.ok(await token.getCurrentAMP().then(_ => _.toNumber()) === expectedTerminalAMP)
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

    it("Should correctly calculate gross mint reward", async () => {
        // (uint256 rankDelta, uint256 amplifier, uint256 term, uint256 EAA)
        const term = 1
        const delta = 125
        const eaa = Math.floor((1 + (expectedInitialEEAR / 1_000)) * 1000)
        const reward = await token.getGrossReward(delta, expectedInitialAMP, term, eaa).then(_ => _.toNumber())
        const expectedReward =
            Math.floor(term * Math.log2(Math.max(delta, 2)) * expectedInitialAMP * (1 + expectedInitialEEAR/1_000));
        assert.ok(reward === expectedReward)
    })

    /*
    it("Should calculate net reward accounted for penalty", async () => {
        const daysLate = [0,1,2,3,4,5,6,7,8];
        for await (const day of daysLate) {
            console.log('days', day, 'reward', await token.getNetReward(100, day).then(_ => _.toNumber()))
        }
    })
    */

})

