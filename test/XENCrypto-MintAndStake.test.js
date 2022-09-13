// SPDX-License-Identifier: MIT

const assert = require('assert')
//const ethers = require('ethers')
const truffleAssert = require('truffle-assertions')
const timeMachine = require('ganache-time-traveler');

const XENCrypto = artifacts.require("XENCrypto")

const { bn2hexStr, toBigInt, maxBigInt, etherToWei } = require('../src/utils.js')

contract("XEN Crypto (XEN Mint+Stake)", async accounts => {

    const genesisRank = 21
    const maxTerm = 1001
    let token
    let mintTerm = 2 /* days */
    let stakeTerm = 5 /* days */
    let genesisTs
    let sharePct = 50
    let oveMaxSharePct = 101
    let globalRank, rankDelta, expectedRewardAmount

    before(async () => {
        try {
            token = await XENCrypto.deployed()
            genesisTs = await token.genesisTs().then(_ => _.toNumber())
            //console.log(await token.totalSupply().then(_ => _.toNumber()))
            await assert.doesNotReject(() => token.claimRank(mintTerm, {from: accounts[1]}))
            await assert.doesNotReject(() => token.claimRank(mintTerm, {from: accounts[2]})) // create rankDelta > 0
            //await timeMachine.advanceTime(term * 24 * 3600 + 1)
            const twoDays = mintTerm * 24 * 3600
            await timeMachine.advanceTimeAndBlock( twoDays + 10)
            // await assert.doesNotReject(() => token.claimMintReward({from: accounts[1]}))
            // balance = await token.balanceOf(accounts[1], {from: accounts[1]}).then(_ => _.toNumber())
            globalRank = await token.globalRank().then(_ => _.toNumber())
            rankDelta = Math.max((globalRank - genesisRank), 2)
            expectedRewardAmount = BigInt(Math.floor(Math.floor(Math.log2(rankDelta)) * 3000 * mintTerm * 1.1)) * etherToWei
            // console.log(expectedRewardAmount)
        } catch (e) {
            console.error(e)
        }
    })
    // 3299999987268518518519
    // 3299999974537037037037
    // 004 520 547 945 205 479 424


    it('Should not allow mint+stake when there is no active mint record', async () => {
        await truffleAssert.fails(
            token.claimMintRewardAndStake(sharePct, 10, {from: accounts[3]}),
            'CRank: No stake exists',
        )
    })

    it('Should not allow mint+stake when sharePct is greater than 100(%)', async () => {
        await truffleAssert.fails(
            token.claimMintRewardAndStake(oveMaxSharePct, 10, {from: accounts[1]}),
            'CRank: Cannot share >100 percent',
        )
    })

    it('Should not allow mint+stake when term is Zero', async () => {
        await truffleAssert.fails(
            token.claimMintRewardAndStake(sharePct, 0, {from: accounts[1]}),
            'XEN: Below min term',
        )
    })

    it('Should not allow mint+stake when term is greater than 1000 days', async () => {
        await truffleAssert.fails(
            token.claimMintRewardAndStake(sharePct, maxTerm, {from: accounts[1]}),
            'XEN: Above max term',
        )
    })

    it("Should allow to mint+stake XEN for any term between MIN & MAX", async () => {

        await assert.doesNotReject(() => {
            return token.claimMintRewardAndStake(sharePct, stakeTerm, {from: accounts[1]})
                .then(result => {
                    truffleAssert.eventEmitted(
                            result,
                            'MintClaimed',
                            (event) => {
                                return event.user === accounts[1]
                                    && BigInt(bn2hexStr(event.rewardAmount)) === BigInt(expectedRewardAmount)
                            })
                    truffleAssert.eventEmitted(
                            result,
                            'Staked',
                            (event) => {
                                return event.user === accounts[1]
                                    && BigInt(bn2hexStr(event.amount)) === BigInt(expectedRewardAmount / 2n)
                                    && BigInt(bn2hexStr(event.term)) === BigInt(stakeTerm)
                            })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.from === '0x0000000000000000000000000000000000000000'
                                && event.to === accounts[1]
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedRewardAmount / 2n)
                        })
                })
                //.catch(console.error)
        })
    })

    it("Post stake, user shall have reduced XEN balance", async () => {
        await assert.ok(await token.balanceOf(accounts[1], {from: accounts[1]})
            .then(toBigInt) === expectedRewardAmount / 2n);
    })

    it("Should reject to register a new XEN stake while another one existing", async () => {
        await assert.rejects(() => token.stake(expectedRewardAmount / 4n, stakeTerm, {from: accounts[1]}));
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
                                && BigInt(bn2hexStr(event.amount)) === BigInt(expectedRewardAmount / 2n)
                                && BigInt(bn2hexStr(event.reward)) === BigInt(0)
                        })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.from === '0x0000000000000000000000000000000000000000'
                                && event.to === accounts[1]
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedRewardAmount / 2n)
                        })
                })
        })
    })

    it("Should allow to register a new XEN stake with none already existing", async () => {
        await assert.doesNotReject(() => token.stake(expectedRewardAmount / 4n, stakeTerm, {from: accounts[1]}));
    })

    it("Should allow to withdraw stake after maturity with positive reward", async () => {
        await timeMachine.advanceTimeAndBlock(stakeTerm * 24 * 3600 + 1)
        const rate = (BigInt(stakeTerm) * 20n * 1_000_000n) / 365n
        const expectedAPYReward = ((expectedRewardAmount / 4n) * rate) / 100_000_000n
        await assert.doesNotReject(() => {
            return token.withdraw({from: accounts[1]})
                .then(result => {
                    truffleAssert.eventEmitted(
                        result,
                        'Withdrawn',
                        (event) => {
                            return event.user === accounts[1]
                                && BigInt(bn2hexStr(event.amount)) === BigInt(expectedRewardAmount / 4n)
                                && BigInt(bn2hexStr(event.reward)) === BigInt(expectedAPYReward)
                        })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.from === '0x0000000000000000000000000000000000000000'
                                && event.to === accounts[1]
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedRewardAmount / 4n + expectedAPYReward)
                        })
                })
        })
    })

    it("Should return user xen stake", async() => {
        const term = Math.floor(Math.random() * (99 - 2) + 2)
        const blockNumber = await web3.eth.getBlockNumber();
        const timestamp = (await web3.eth.getBlock(blockNumber)).timestamp
        const maturityTs = timestamp + 3600 * 24 * term

        await token.stake(expectedRewardAmount / 2n, term, {from: accounts[1]})
        let stakeInfo = await token.getUserStake({from: accounts[1]})

        assert.ok(BigInt(BigInt(stakeInfo.amount)) === expectedRewardAmount / 2n)
        assert.equal(stakeInfo.term, term)
        assert.ok(stakeInfo.maturityTs >= maturityTs)
    })
})
