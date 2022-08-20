// SPDX-License-Identifier: MIT

const assert = require('assert')
//const ethers = require('ethers')
const truffleAssert = require('truffle-assertions')
const timeMachine = require('ganache-time-traveler');

const XENCrypto = artifacts.require("XENCrypto")

const bn2hexStr = (bn) => '0x' + (bn?.toString(16)?.padStart(64, '0') || '0')

contract("XEN Crypto (XEN Staking)", async accounts => {

    const maxTerm = 1000
    let token
    let term = 2
    let balance

    before(async () => {
        try {
            token = await XENCrypto.deployed()
            //console.log(await token.totalSupply().then(_ => _.toNumber()))
            await assert.doesNotReject(() => token.claimRank(term, {from: accounts[1]}))
            await assert.doesNotReject(() => token.claimRank(term, {from: accounts[2]})) // create rankDelta > 0
            await timeMachine.advanceTime(term * 24 * 3600 + 1)
            await timeMachine.advanceBlock()
            await assert.doesNotReject(() => token.claimMintReward({from: accounts[1]}))
            balance = await token.balanceOf(accounts[1], {from: accounts[1]}).then(_ => _.toNumber())

        } catch (e) {
            console.error(e)
        }
    })

    it('Should not allow stake when term is less than 1 minute', async () => {
        await truffleAssert.fails(
            token.stake(balance / 2, 0, {from: accounts[1]}),
            'XEN: Below min term',
        )
    })

    it('Should not allow stake when term is greater than 1000 days', async () => {
        await truffleAssert.fails(
            token.stake(balance / 2, maxTerm, {from: accounts[1]}),
            'XEN: Above max term',
        )
    })

    it('Should not allow stake when balance is not enough', async () => {
        await truffleAssert.fails(
            token.stake(balance + 1, maxTerm, {from: accounts[1]}),
            'XEN: not enough balance',
        )
    })

    it("Should allow to stake XEN for any term between MIN & MAX", async () => {
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
        await timeMachine.advanceTime(term * 24 * 3600 + 1)
        await timeMachine.advanceBlock()
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

    it("Should return user xen stake", async() => {
        const term = Math.floor(Math.random() * (99 - 2) + 2)
        const blockNumber = await web3.eth.getBlockNumber();
        const timestamp = (await web3.eth.getBlock(blockNumber)).timestamp
        const maturityTs = timestamp + 3600 * 24 * term

        await token.stake(balance / 2, term, {from: accounts[1]})
        let stakeInfo = await token.getUserStake({from: accounts[1]})

        assert.equal(stakeInfo.amount, balance / 2)
        assert.equal(stakeInfo.term, term)
        assert.ok(stakeInfo.maturityTs >= maturityTs)
    })
})
