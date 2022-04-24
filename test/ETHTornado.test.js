/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()
// const fs = require('fs')

const { toBN, randomHex } = require('web3-utils')
// const { takeSnapshot, revertSnapshot } = require('../scripts/ganacheHelper')

const ETHTornado = artifacts.require("ETHTornado")
const Hasher = artifacts.require("Hasher")
const Verifier = artifacts.require('Verifier')
const { ETH_AMOUNT, MERKLE_TREE_HEIGHT } = process.env

// const websnarkUtils = require('websnark/src/utils')
// const buildGroth16 = require('websnark/src/groth16')
// const stringifyBigInts = require('websnark/tools/stringifybigint').stringifyBigInts
// const unstringifyBigInts2 = require('snarkjs/src/stringifybigint').unstringifyBigInts
const snarkjs = require('snarkjs')
const bigInt = require("big-integer");

const crypto = require('crypto');
const { assert } = require('console');
// const circomlib = require('circomlib')
// const MerkleTree = require('fixed-merkle-tree')

const rbigint = (nbytes) => bigInt.randBetween(0, bigInt(2).pow(nbytes * 8))
// const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]
const toFixedHex = (number, length = 32) =>
  '0x' +
  bigInt(number)
    .toString(16)
    .padStart(length * 2, '0')
const getRandomRecipient = () => rbigint(20)

// function generateDeposit() {
//   let deposit = {
//     secret: rbigint(31),
//     nullifier: rbigint(31),
//   }
//   const preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
//   deposit.commitment = pedersenHash(preimage)
//   return deposit
// }

// // eslint-disable-next-line no-unused-vars
// function BNArrayToStringArray(array) {
//   const arrayToPrint = []
//   array.forEach((item) => {
//     arrayToPrint.push(item.toString())
//   })
//   return arrayToPrint
// }

// function snarkVerify(proof) {
//   proof = unstringifyBigInts2(proof)
//   const verification_key = unstringifyBigInts2(require('../build/circuits/withdraw_verification_key.json'))
//   return snarkjs['groth'].isValid(verification_key, proof, proof.publicSignals)
// }

contract('ETHTornado Test', accounts => {  
  let tornado
  const sender = accounts[0]
  const operator = accounts[0]
  const levels = MERKLE_TREE_HEIGHT || 16
  const value = ETH_AMOUNT || '1000000000000000000' // 1 ether
  let snapshotId
  let tree
  const fee = bigInt(ETH_AMOUNT).shiftLeft(1) || bigInt(1e17)
  const refund = bigInt(0)
  const recipient = getRandomRecipient()
  const relayer = accounts[1]
  let groth16
  let circuit
  let proving_key

  before(async () => {
    // tree = new MerkleTree(levels)
    const txParams = {
      from: accounts[0]
    };

    tornado = await ETHTornado.new(
                                  Verifier.address,
                                  Hasher.address,
                                  value,
                                  levels,
                                  txParams
                                )
    // snapshotId = await takeSnapshot()
    // groth16 = await buildGroth16()
    // circuit = require('../build/circuits/withdraw.json')
    // proving_key = fs.readFileSync('build/circuits/withdraw_proving_key.bin').buffer
  })


  describe('#constructor', () => {
    it('should initialize', async () => {
      const etherDenomination = await tornado.denomination()
      etherDenomination.should.be.eq.BN(toBN(value))
    })
  })
})