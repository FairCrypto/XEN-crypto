// SPDX-License-Identifier: MIT

const assert = require('assert')
//const ethers = require('ethers')
const truffleAssert = require('truffle-assertions')
const timeMachine = require('ganache-time-traveler');

const XENCrypto = artifacts.require("XENCrypto")

const { bn2hexStr, toBigInt, maxBigInt, etherToWei } = require('../src/utils.js')

contract("XEN Crypto (Rank amd XEN Claiming)", async accounts => {

    const genesisRank = 1
    let token
    let term = 2
    let expectedStakeId = genesisRank
    let snapshotId

    before(async () => {
        try {
            token = await XENCrypto.deployed()
        } catch (e) {
            console.error(e)
        }
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
        await assert.rejects(() => token.claimMintReward({from: accounts[1]}));
    })

    it("Should reject to claim rank reward when stake maturity not reached", async () => {
        const snapshot = await timeMachine.takeSnapshot();
        const snapshotId = snapshot['result'];

        try {
            await token.claimRank(5, {from: accounts[6]})
            await truffleAssert.fails(
                token.claimMintReward({from: accounts[6]}),
                "CRank: Stake maturity not reached"
            )
        } catch (err) {
            throw(err)
        } finally {
            await timeMachine.revertToSnapshot(snapshotId);
        }
    })

    it("Should not reject claim rank reward", async () => {
        const snapshot = await timeMachine.takeSnapshot();
        const snapshotId = snapshot['result'];
        const term = 5

        try {
            await token.claimRank(term, {from: accounts[6]})
            await timeMachine.advanceTime(term * 24 * 3600 + 1)
            await timeMachine.advanceBlock()
            await token.claimMintReward({from: accounts[6]})
        } catch (err) {
            throw(err)
        } finally {
            await timeMachine.revertToSnapshot(snapshotId);
        }
    })

    it("Should reject to claim rank reward and share when stake maturity not reached", async () => {
        const snapshot = await timeMachine.takeSnapshot();
        const snapshotId = snapshot['result'];

        try {
            await token.claimRank(5, {from: accounts[6]})
            await truffleAssert.fails(
                token.claimMintRewardAndShare(accounts[7], 50, {from: accounts[6]}),
                "CRank: Stake maturity not reached"
            )
        } catch (err) {
            throw(err)
        } finally {
            await timeMachine.revertToSnapshot(snapshotId);
        }
    })

    it("Should reject to claim rank reward and share when no stake exists", async () => {
        await truffleAssert.fails(
            token.claimMintRewardAndShare(accounts[7], 50, {from: accounts[6]}),
            "CRank: No stake exists"
        )
    })

    it("Should reject to claim rank reward and share when sharing to zero address", async () => {
        await truffleAssert.fails(
            token.claimMintRewardAndShare('0x0000000000000000000000000000000000000000', 50, {from: accounts[6]}),
            "CRank: Cannot share with zero address"
        )
    })

    it("Should reject to claim rank reward and share when percent is less than 1", async () => {
        await truffleAssert.fails(
            token.claimMintRewardAndShare(accounts[7], 0, {from: accounts[6]}),
            "CRank: Cannot share zero percent"
        )

        await truffleAssert.fails(
            token.claimMintRewardAndShare(accounts[7], -1, {from: accounts[6]}),
        )
    })

    it("Should reject to claim rank reward and share when percent is greater than 100", async () => {
        await truffleAssert.fails(
            token.claimMintRewardAndShare(accounts[7], 101, {from: accounts[6]}),
            "CRank: Cannot share 100+ percent"
        )
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
        const snapshot = await timeMachine.takeSnapshot();
        snapshotId = snapshot['result'];

        await timeMachine.advanceTime(3600 * 24 * term + 1);
        await timeMachine.advanceBlock();

        const globalRank = await token.globalRank().then(_ => _.toNumber())
        const rankDelta = (globalRank - genesisRank)
        const expectedRewardAmount = BigInt(Math.floor(Math.log2(rankDelta)* 3_000 * term * 1.1)) * etherToWei
        await assert.doesNotReject(() => {
            return token.claimMintRewardAndShare(accounts[3], 50, {from: accounts[1]})
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
                        'Transfer',
                        (event) => {
                            return event.to === accounts[1]
                                && event.from === '0x0000000000000000000000000000000000000000'
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedRewardAmount/2n)
                        })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.to === accounts[3]
                                && event.from === '0x0000000000000000000000000000000000000000'
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedRewardAmount/2n)
                        })
                })
                //.catch(console.log)
        })
        assert.ok(expectedRewardAmount === await token.totalSupply().then(toBigInt))
    })

    it("Should return user MintInfo", async() => {
        const mintTerm = Math.floor(Math.random() * (100 - 2) + 2)
        const globalRank = await token.globalRank().then(_ => _.toNumber())
        const blockNumber = await web3.eth.getBlockNumber();
        const timestamp = (await web3.eth.getBlock(blockNumber)).timestamp
        const maturityTs = timestamp + 3600 * 24 * mintTerm

        await token.claimRank(mintTerm, {from: accounts[4]})
        let mintInfo = await token.getUserMint({from: accounts[4]})

        assert.equal(mintInfo.user, accounts[4])
        assert.equal(mintInfo.term, mintTerm)
        assert.equal(mintInfo.rank, globalRank)
        assert.ok(mintInfo.maturityTs >= maturityTs)
    })

    it ("Shall progressively decrease reward amount for delay in 1...8 days", async () => {
        const delaysInDays = [1, 2, 3, 4, 5, 6, 7, 8];
        const expectedRewardPct = [99n, 97n, 92n, 83n, 65n, 28n, 0n, 0n];
        for await (const delay of delaysInDays) {
            await timeMachine.revertToSnapshot(snapshotId);
            const snapshot = await timeMachine.takeSnapshot();
            snapshotId = snapshot['result'];

            await timeMachine.advanceTime(3600 * 24 * (term + delay) + 1);
            await timeMachine.advanceBlock();

            const globalRank = await token.globalRank().then(_ => _.toNumber())
            const rankDelta = (globalRank - genesisRank)
            const expectedRewardAmount = BigInt(Math.floor(Math.log2(rankDelta) * 3_000 * term * 1.1)) * etherToWei
            await assert.doesNotReject(() => token.claimMintReward({from: accounts[1]}));

            const idx = delaysInDays.findIndex(d => d === delay)
            const expectedNetReward = (await token.totalSupply().then(toBigInt)) * 100n / expectedRewardAmount;
            assert.ok(expectedNetReward === expectedRewardPct[idx])
        }
    })

})
