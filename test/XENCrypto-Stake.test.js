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

contract("XEN Crypto (XEN Staking)", async accounts => {

    const genesisRank = 21
    let token
    let term = 2
    let controlTs
    let expectedStakeId = genesisRank
    let balance

    before(async () => {
        try {
            token = await XENCrypto.deployed()
            //console.log(await token.totalSupply().then(_ => _.toNumber()))
            await assert.doesNotReject(() => token.claimRank(term, {from: accounts[1]}))
            await assert.doesNotReject(() => token.claimRank(term, {from: accounts[2]})) // create rankDelta > 0
            const futureTs = Math.round((Date.now() / 1000) + term * 24 * 3600 + 1)
            await advanceBlockAtTime(web3, futureTs)
            await assert.doesNotReject(() => token.claimRankReward({from: accounts[1]}))
        } catch (e) {
            console.error(e)
        }
    })

    it("Should allow to stake XEN for any term between MIN & MAX", async () => {
        // await advanceBlockAtTime(web3, Math.round((Date.now() / 1000))); /* get back to now */

        balance = await token.balanceOf(accounts[1], {from: accounts[1]}).then(_ => _.toNumber())
        const term = 5 /* days */
        await assert.doesNotReject(() => {
            return token.stake(balance / 2, term, {from: accounts[1]})
                .then(result => {
                    truffleAssert.eventEmitted(
                            result,
                            'Staked',
                            (event) => {
                                return event.user === accounts[1]
                                    && BigInt(bn2hexStr(event.amount)) === BigInt(balance / 2)
                                    && BigInt(bn2hexStr(event.term)) === BigInt(term)
                            })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.to === '0x0000000000000000000000000000000000000000'
                                && event.from === accounts[1]
                                && BigInt(bn2hexStr(event.value)) === BigInt(balance / 2)
                        })
                })
                //.catch(console.error)
        })
    })

    it("Post stake, user shall have reduced XEN balance", async () => {
        await assert.ok(await token.balanceOf(accounts[1], {from: accounts[1]}).then(_ => _.toNumber()) === balance / 2);
    })

    it("Should reject to register a new XEN stake while another one existing", async () => {
        await assert.rejects(() => token.stake(balance / 4, term, {from: accounts[1]}));
    })

    it("Should allow to withdraw stake before maturity but with zero reward", async () => {
        await assert.doesNotReject(() => {
            return token.withdraw({from: accounts[1]})
                .then(result => {
                    truffleAssert.eventEmitted(
                        result,
                        'Withdrawn',
                        (event) => {
                            return event.user === accounts[1]
                                && BigInt(bn2hexStr(event.amount)) === BigInt(balance / 2)
                                && BigInt(bn2hexStr(event.reward)) === BigInt(0)
                        })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.from === '0x0000000000000000000000000000000000000000'
                                && event.to === accounts[1]
                                && BigInt(bn2hexStr(event.value)) === BigInt(balance / 2)
                        })
                })
        })
    })

    it("Should allow to register a new XEN stake with none already existing", async () => {
        await assert.doesNotReject(() => token.stake(balance / 4, term, {from: accounts[1]}));
    })


    it("Should allow to withdraw stake after maturity with positive reward", async () => {
        const futureTs = Math.round((Date.now() / 1000) + term * 2 * 24 * 3600 + 1)
        await advanceBlockAtTime(web3, futureTs)
        const expectedReward = Math.floor((balance / 4) * term * 20 / (365 * 100))
        await assert.doesNotReject(() => {
            return token.withdraw({from: accounts[1]})
                .then(result => {
                    truffleAssert.eventEmitted(
                        result,
                        'Withdrawn',
                        (event) => {
                            return event.user === accounts[1]
                                && BigInt(bn2hexStr(event.amount)) === BigInt(balance / 4)
                                && BigInt(bn2hexStr(event.reward)) === BigInt(expectedReward)
                        })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.from === '0x0000000000000000000000000000000000000000'
                                && event.to === accounts[1]
                                && BigInt(bn2hexStr(event.value)) === BigInt(balance / 4 + expectedReward)
                        })
                })
        })
    })

})
