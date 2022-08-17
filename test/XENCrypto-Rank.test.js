// SPDX-License-Identifier: MIT

const assert = require('assert')
//const ethers = require('ethers')
const truffleAssert = require('truffle-assertions')

const XENCrypto = artifacts.require("XENCrypto")

const bn2hexStr = (bn) => '0x' + (bn?.toString(16)?.padStart(64, '0') || '0')

const advanceBlockAtTime = (web3, time) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {
                jsonrpc: "2.0",
                method: "evm_mine",
                params: [time],
                id: new Date().getTime(),
            },
            (err, _) => {
                if (err) {
                    return reject(err);
                }
                const newBlockHash = web3.eth.getBlock("latest").hash;
                return resolve(newBlockHash);
            },
        );
    });
};

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
       controlTs = Date.now()
       await advanceBlockAtTime(web3, Math.round((controlTs / 1000) + ((3600 * 24) * term / 2)))
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

    it("Should allow to withdraw stake upon maturity with XEN minted", async () => {
        // rewardAmount = (nextStakeId - stakeId) * stakeTerms[_msgSender() = (22 - 21) * 2
        await advanceBlockAtTime(web3, Math.round((controlTs / 1000) + (3600 * 24) * term))
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
