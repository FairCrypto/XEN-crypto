const assert = require('assert')
//const ethers = require('ethers')
const truffleAssert = require('truffle-assertions')

const ZeroValueToken = artifacts.require("ZeroValueToken")

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

contract("Zero Value Token", async accounts => {

    let token
    let term = 2
    const genesisRank = 21
    let expectedStakeId = genesisRank

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
        assert.ok(await token.globalRank().then(_ => _.toNumber()) === expectedStakeId)
    })

    it("Should allow to stake with initial ID (rank) having #21", async () => {
        await assert.doesNotReject(() => {
            return token.stake(term, {from: accounts[1]})
                .then(result => truffleAssert.eventEmitted(
                    result,
                    'Staked',
                    (event) => {
                        return event.user === accounts[1]
                            && BigInt(bn2hexStr(event.term)) === BigInt(term)
                            && BigInt(bn2hexStr(event.rank)) === BigInt(expectedStakeId)
                    }))
                .catch(console.error)
        })
        expectedStakeId++
    })

   it("Should allow to stake with next ID (rank) having #22", async () => {
        await assert.doesNotReject(() => {
            return token.stake(term, {from: accounts[2]})
                .then(result => truffleAssert.eventEmitted(
                    result,
                    'Staked',
                    (event) => {
                        return event.user === accounts[2]
                            && BigInt(bn2hexStr(event.term)) === BigInt(term)
                            && BigInt(bn2hexStr(event.rank)) === BigInt(expectedStakeId)
                    }))
                .catch(console.error)
        })
       expectedStakeId++
   })

    it("Should allow to withdraw stake upon maturity with DGC minted", async () => {
        // rewardAmount = (nextStakeId - stakeId) * stakeTerms[_msgSender() = (22 - 21) * 2
        await advanceBlockAtTime(web3, Math.round((Date.now() / 1000) + (3600 * 24) * term + 10))
        const globalRank = await token.globalRank().then(_ => _.toNumber())
        const rankDelta = (globalRank - genesisRank)
        const expectedRewardAmount = Math.round(Math.log2(rankDelta * rankDelta * rankDelta) * 1000 * term)
        await assert.doesNotReject(() => {
            return token.withdraw({from: accounts[1]})
                .then(result => {
                    truffleAssert.eventEmitted(
                        result,
                        'Withdrawn',
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
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedRewardAmount)
                        })
                })
                .catch(console.log)
        })
        console.log(expectedRewardAmount, await token.totalSupply().then(_ => _.toNumber()))
    })

})
