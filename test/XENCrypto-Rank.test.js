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
    let expectedStakeId = genesisRank

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
        await assert.rejects(() => token.claimMintReward({from: accounts[1]}));
    })

    it("Should reject to claim rank reward when stake maturity not reached", async () => {
        const snapshot = await timeMachine.takeSnapshot();
        const snapshotId = snapshot['result'];

        try {
            await token.claimRank(5, {from: accounts[6]})
            await truffleAssert.fails(
                token.claimMintReward({from: accounts[6]}),
                "Mint: Maturity not reached"
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
                token.claimMintRewardAndDrop([accounts[7]], {from: accounts[6]}),
                "Mint: Maturity not reached"
            )
        } catch (err) {
            throw(err)
        } finally {
            await timeMachine.revertToSnapshot(snapshotId);
        }
    })

    it("Should reject to claim rank reward and share when no stake exists", async () => {
        await truffleAssert.fails(
            token.claimMintRewardAndDrop([accounts[7]], {from: accounts[6]}),
            "Mint: No record exists"
        )
    })

    it("Should reject to claim rank reward and share when sharing to zero address", async () => {
        await truffleAssert.fails(
            token.claimMintRewardAndDrop(['0x0000000000000000000000000000000000000000'], {from: accounts[6]}),
            "Mint: Cannot drop to 0"
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
        await timeMachine.advanceTime(3600 * 24 * term + 1);
        await timeMachine.advanceBlock();

        const globalRank = await token.globalRank().then(_ => _.toNumber())
        const rankDelta = (globalRank - genesisRank)
        const expectedOwnRewardAmount = Math.round(Math.log2(rankDelta) * 3000 * term) + 10
        const expectedOtherRewardAmount = 10
        await assert.doesNotReject(() => {
            return token.claimMintRewardAndDrop([accounts[3]], {from: accounts[1]})
                .then(result => {
                    truffleAssert.eventEmitted(
                        result,
                        'MintClaimed',
                        (event) => {
                            return event.user === accounts[1]
                                && BigInt(bn2hexStr(event.rewardAmount)) === BigInt(expectedOwnRewardAmount)
                        })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.to === accounts[1]
                                && event.from === '0x0000000000000000000000000000000000000000'
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedOwnRewardAmount)
                        })
                    truffleAssert.eventEmitted(
                        result,
                        'Transfer',
                        (event) => {
                            return event.to === accounts[3]
                                && event.from === '0x0000000000000000000000000000000000000000'
                                && BigInt(bn2hexStr(event.value)) === BigInt(expectedOtherRewardAmount)
                        })
                })
                //.catch(console.log)
        })
        assert.ok(expectedOwnRewardAmount + expectedOtherRewardAmount
            === await token.totalSupply().then(_ => _.toNumber()))
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
})
