// SPDX-License-Identifier: MIT

const assert = require('assert')
require('dotenv').config()
// const truffleAssert = require('truffle-assertions')
const timeMachine = require('ganache-time-traveler');

const XENCrypto = artifacts.require("XENCrypto")
// test 'fake' contracts with pre-set GlobalRanks
const XENCrypto5001 = artifacts.require("XENCrypto5001")
const XENCrypto100001 = artifacts.require("XENCrypto100001")
const XENCrypto25mm1 = artifacts.require("XENCrypto25mm1")

const print = process.env.EXTRA_PRINT
// const { bn2hexStr, toBigInt, maxBigInt, etherToWei } = require('../src/utils.js')

contract("XEN Crypto (Base Params)", async accounts => {

    const genesisRank = 1
    const expectedInitialAMP = 3_000
    const expectedInitialEEAR = 100
    const expectedInitialAPY = 20
    let token
    let tokenWithRank5001
    let tokenWithRank100001
    let tokenWithRank25mm1
    let expectedStakeId = genesisRank
    let genesisTs

    before(async () => {
        try {
            token = await XENCrypto.deployed()
            tokenWithRank5001 = await XENCrypto5001.new();
            tokenWithRank100001 = await XENCrypto100001.new();
            tokenWithRank25mm1 = await XENCrypto25mm1.new();
            genesisTs = await token.genesisTs().then(_ => _.toNumber())
        } catch (e) {
            console.error(e)
        }
    })

    it("Should read basic ERC-20 params", async () => {
        assert.ok(await token.name() === 'XEN Crypto')
        assert.ok(await token.symbol() === 'XEN')
    })

    it("Should start stake IDs (ranks) with number 1", async () => {
        assert.ok(await token.globalRank().then(_ => _.toNumber()) === expectedStakeId)
        print && console.log(
            '\n      global rank',
            await token.globalRank().then(_ => _.toNumber()),
            'expected',
            expectedStakeId)
    })

    it("Should start stake IDs (ranks) with number 5001", async () => {
        const expected5001Rank = 5_001
        assert.ok(await tokenWithRank5001.globalRank().then(_ => _.toNumber()) === expected5001Rank)
        print && console.log(
            '\n      global rank',
            await tokenWithRank5001.globalRank().then(_ => _.toNumber()),
            'expected',
            expected5001Rank)
    })

    it("Should start stake IDs (ranks) with number 100001", async () => {
        const expected100001Rank = 100_001
        assert.ok(await tokenWithRank100001.globalRank().then(_ => _.toNumber()) === expected100001Rank)
        print && console.log(
            '\n      global rank',
            await tokenWithRank100001.globalRank().then(_ => _.toNumber()),
            'expected',
            expected100001Rank)
    })

    it("Should start stake IDs (ranks) with number 25mm1", async () => {
        const expected25mm1Rank = 25_000_001
        assert.ok(await tokenWithRank25mm1.globalRank().then(_ => _.toNumber()) === expected25mm1Rank)
        print && console.log(
            '\n      global rank',
            await tokenWithRank25mm1.globalRank().then(_ => _.toNumber()),
            'expected',
            expected25mm1Rank)
    })

    it("Should return correct initial AMP", async () => {
        assert.ok(await token.getCurrentAMP().then(_ => _.toNumber()) === expectedInitialAMP)
        print && console.log(
            '\n      initial AMP',
            await token.getCurrentAMP().then(_ => _.toNumber()),
            'expected',
            expectedInitialAMP)
    })

    it("Should return correct initial EAA", async () => {
        assert.ok(await token.getCurrentEAAR().then(_ => _.toNumber()) === expectedInitialEEAR)
        print && console.log(
            '\n      initial EAA',
            await token.getCurrentEAAR().then(_ => _.toNumber()).then(r => 1 + r / 1000),
            'expected',
            1 + expectedInitialEEAR / 1000)
    })

    it("Should return correct initial EAA for Global Rank = 100_001", async () => {
        const expectedEAAR100001= 99
        assert.ok(await tokenWithRank100001.getCurrentEAAR().then(_ => _.toNumber()) === expectedEAAR100001)
        print && console.log(
            '\n      EAA for Global Rank 100_001',
            await tokenWithRank100001.getCurrentEAAR().then(_ => _.toNumber()).then(r => 1 + r / 1000),
            'expected',
            1 + expectedEAAR100001 / 1000)
    })

    it("Should return correct initial EAA for Global Rank = 25_000_001", async () => {
        const expectedEAAR25mm1 = 0
        assert.ok(await tokenWithRank25mm1.getCurrentEAAR().then(_ => _.toNumber()) === expectedEAAR25mm1)
        print && console.log(
            '\n      EAA for Global Rank 25_000_001',
            await tokenWithRank25mm1.getCurrentEAAR().then(_ => _.toNumber()).then(r => 1 + r / 1000),
            'expected',
            1 + expectedEAAR25mm1 / 1000)
    })

    it("Should return correct initial APY", async () => {
        assert.ok(await token.getCurrentAPY().then(_ => _.toNumber()) === expectedInitialAPY)
        print && console.log(
            '\n      initial APY',
            await token.getCurrentAPY().then(_ => _.toNumber()),
            'expected',
            expectedInitialAPY)
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
            print && console.log(
                '\n      AMP in 1Y',
                await token.getCurrentAMP().then(_ => _.toNumber()),
                'expected',
                expectedAMP)

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
            print && console.log(
                '\n      AMP in 100 months',
                await token.getCurrentAMP().then(_ => _.toNumber()),
                'expected',
                expectedTerminalAMP)
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
            print && console.log(
                '\n      APY in 1 year',
                await token.getCurrentAPY().then(_ => _.toNumber()),
                'expected',
                expectedAPY)
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
            print && console.log(
                '\n      APY in 42 months',
                await token.getCurrentAPY().then(_ => _.toNumber()),
                'expected',
                expectedTerminalAPY)
        } catch (err) {
            throw(err)
        } finally {
            await timeMachine.revertToSnapshot(snapshotId);
        }
    })

    it("Should correctly calculate gross mint reward", async () => {
        // (uint256 rankDelta, uint256 amplifier, uint256 term, uint256 EAA)
        const term = 30
        const delta = 1_000
        const eaa = Math.floor((1 + (expectedInitialEEAR / 1_000)) * 1000)
        const reward = await token.getGrossReward(delta, expectedInitialAMP, term, eaa).then(_ => _.toNumber())
        const expectedReward =
            Math.floor(term * Math.log2(Math.max(delta, 2)) * expectedInitialAMP * (1 + expectedInitialEEAR/1_000));
        assert.ok(reward === expectedReward)
        print && console.log(
            '\n      Reward for: term', term, 'rank delta', delta, 'AMP', expectedInitialAMP, 'EAA', 1 + expectedInitialEEAR / 1_000,
            await reward,
            'expected',
            expectedReward)
    })

    it("Should correctly calculate gross mint reward for Global Rank 100001", async () => {
        // (uint256 rankDelta, uint256 amplifier, uint256 term, uint256 EAA)
        const term = 1
        const delta = 2
        const expectedEAAR100001= 99
        const eaa = Math.floor((1 + (expectedEAAR100001 / 1_000)) * 1000)
        const reward = await tokenWithRank100001.getGrossReward(delta, expectedInitialAMP, term, eaa).then(_ => _.toNumber())
        const expectedReward =
            Math.floor(term * Math.log2(Math.max(delta, 2)) * expectedInitialAMP * (1 + expectedEAAR100001/1_000));
        assert.ok(reward === expectedReward)
        print && console.log(
            '\n      Reward for: GlobalRank 10k1 term', term, 'rank delta', delta, 'AMP', expectedInitialAMP, 'EAA', 1 + expectedEAAR100001 / 1_000,
            await reward,
            'expected',
            expectedReward)
    })

    it("Should correctly calculate gross mint reward for Global Rank 25mm1", async () => {
        // (uint256 rankDelta, uint256 amplifier, uint256 term, uint256 EAA)
        const term = 1
        const delta = 2
        const expectedEAAR25mm1= 0
        const eaa = Math.floor((1 + (expectedEAAR25mm1 / 1_000)) * 1000)
        const reward = await tokenWithRank25mm1.getGrossReward(delta, expectedInitialAMP, term, eaa).then(_ => _.toNumber())
        const expectedReward =
            Math.floor(term * Math.log2(Math.max(delta, 2)) * expectedInitialAMP * (1 + expectedEAAR25mm1/1_000));
        assert.ok(reward === expectedReward)
        print && console.log(
            '\n      Reward for: GlobalRank 25mm1 term', term, 'rank delta', delta, 'AMP', expectedInitialAMP, 'EAA', 1 + expectedEAAR25mm1 / 1_000,
            await reward,
            'expected',
            expectedReward)
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

