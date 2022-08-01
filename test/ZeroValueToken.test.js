const assert = require('assert')
//const ethers = require('ethers')
const truffleAssert = require('truffle-assertions')

const ZeroValueToken = artifacts.require("ZeroValueToken")

const bn2hexStr = (bn) => '0x' + (bn?.toString(16)?.padStart(64, '0') || '0')

contract("Zero Value Token", async accounts => {

    let token
    let blockNumber
    let term = 1
    let expectedStakeId = 21

    before(async () => {
        try {
            token = await ZeroValueToken.deployed()
        } catch (e) {
            console.error(e)
        }
    })

    it("Should read basic ERC-20 params", async () => {
        assert.ok(await token.name() === 'Delayed Gratification Coin')
        assert.ok(await token.symbol() === 'DGC')
    })

    it("Should start stake IDs (ranks) with number 21", async () => {
        assert.ok(await token.nextStakeId().then(_ => _.toNumber()) === expectedStakeId)
    })

    it("Should allow to stake with initial ID (rank) having #21", async () => {
        blockNumber = await web3.eth.getBlockNumber()
        const maturityBlock = blockNumber + 1 + term
        await assert.doesNotReject(() => {
            return token.stake(maturityBlock, {from: accounts[1]})
                .then(result => truffleAssert.eventEmitted(
                    result,
                    'Staked',
                    (event) => {
                        return event.user === accounts[1]
                            && BigInt(bn2hexStr(event.maturityBlock)) === BigInt(maturityBlock)
                            && BigInt(bn2hexStr(event.stakeId)) === BigInt(expectedStakeId)
                    }))
        })
    })

    it("Should allow to withdraw stake upon maturity with DGC minted", async () => {
        // rewardAmount = (nextStakeId - stakeId) * stakeTerms[_msgSender() = (22 - 21) * 2
        const expectedRewardAmount = (expectedStakeId - (expectedStakeId - 1)) * term
        await assert.doesNotReject(() => {
            return token.withdraw(expectedStakeId, {from: accounts[1]})
                .then(result => {
                    truffleAssert.eventEmitted(
                        result,
                        'Withdrawn',
                        (event) => {
                            return event.user === accounts[1]
                                && BigInt(bn2hexStr(event.stakeId)) === BigInt(expectedStakeId)
                                && BigInt(bn2hexStr(event.rewardAmount)) === BigInt(expectedRewardAmount)
                        })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.to === accounts[1]
                                && event.from === '0x0000000000000000000000000000000000000000'
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedRewardAmount)
                        })
                })
        })
    })

})
