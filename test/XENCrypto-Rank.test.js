// SPDX-License-Identifier: MIT

const assert = require('assert')
//const ethers = require('ethers')
const truffleAssert = require('truffle-assertions')
const timeMachine = require('ganache-time-traveler');

const XENCrypto = artifacts.require("XENCrypto")

const bn2hexStr = (bn) => '0x' + (bn?.toString(16)?.padStart(64, '0') || '0')

contract("XEN Crypto (Rank amd XEN Claiming)", async accounts => {

    const genesisRank = 21
    let token
    let term = 2
    let controlTs
    let expectedStakeId = genesisRank
    let balance

    before(async () => {
        try {
            token = await XENCrypto.deployed()
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

    it("Should allow to stake with initial ID (rank) having #21", async () => {
        await assert.doesNotReject(() => {
            return token.claimRank(term, {from: accounts[1]})
                .then(result => truffleAssert.eventEmitted(
                    result,
                    'RankClaimed',
                    (event) => {
                        return event.user === accounts[1]
                            && BigInt(bn2hexStr(event.term)) === BigInt(term)
                            && BigInt(bn2hexStr(event.rank)) === BigInt(expectedStakeId)
                    }))
                //.catch(console.error)
        })
        expectedStakeId++
    })

    it("Should reject to add another stake for the same account", async () => {
        await assert.rejects(() => token.claimRank(term * 2, {from: accounts[1]}));
    })

    it("Should allow to stake with next ID (rank) having #22", async () => {
       await assert.doesNotReject(() => {
            return token.claimRank(term, {from: accounts[2]})
                .then(result => truffleAssert.eventEmitted(
                    result,
                    'RankClaimed',
                    (event) => {
                        return event.user === accounts[2]
                            && BigInt(bn2hexStr(event.term)) === BigInt(term)
                            && BigInt(bn2hexStr(event.rank)) === BigInt(expectedStakeId)
                    }))
                //.catch(console.error)
        })
       expectedStakeId++
   })

    it("Should reject to withdraw stake before maturity", async () => {
        await assert.rejects(() => token.claimRankReward({from: accounts[1]}));
    })

    it("Should reject to claim rank with smaller than 1 day term", async () => {
        await truffleAssert.fails(
            token.claimRank(0, {from: accounts[1]}),
            "CRank: Term less than min"
        )

        await truffleAssert.fails(
            token.claimRank(-1, {from: accounts[1]})
        )
    })

    it("Should reject to claim rank with larger than 100 day term", async () => {
        await truffleAssert.fails(
            token.claimRank(101, {from: accounts[1]}),
            "CRank: Term more than current max term"
        )
    })

    it("Should allow to withdraw stake upon maturity with XEN minted", async () => {
        await timeMachine.advanceTime(3600 * 24 * term + 1);
        await timeMachine.advanceBlock();

        const globalRank = await token.globalRank().then(_ => _.toNumber())
        const rankDelta = (globalRank - genesisRank)
        const expectedRewardAmount = Math.round(Math.log2(rankDelta) * 3000 * term)
        await assert.doesNotReject(() => {
            return token.claimRankRewardAndShare(accounts[3], 50, {from: accounts[1]})
                .then(result => {
                    truffleAssert.eventEmitted(
                        result,
                        'RankRewardClaimed',
                        (event) => {
                            return event.user === accounts[1]
                                && BigInt(bn2hexStr(event.rewardAmount)) === BigInt(expectedRewardAmount)
                        })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.to === accounts[1]
                                && event.from === '0x0000000000000000000000000000000000000000'
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedRewardAmount/2)
                        })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.to === accounts[3]
                                && event.from === '0x0000000000000000000000000000000000000000'
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedRewardAmount/2)
                        })
                })
                //.catch(console.log)
        })
        assert.ok(expectedRewardAmount === await token.totalSupply().then(_ => _.toNumber()))
    })

})
