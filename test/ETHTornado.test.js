/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const fs = require('fs');
const { toBN, randomHex } = require('web3-utils');
// const { takeSnapshot, revertSnapshot } = require('../scripts/ganacheHelper')

const Hasher = artifacts.require("Hasher");
const Verifier = artifacts.require('Verifier');
const ETHTornado = artifacts.require("ETHTornado");
const { ETH_AMOUNT, MERKLE_TREE_HEIGHT } = process.env;

// const websnarkUtils = require('websnark/src/utils')
// const buildGroth16 = require('websnark/src/groth16')
const snarkjs = require('snarkjs');
const bigInt = require("big-integer");
const circomlibjs = require('circomlibjs');
const stringifyBigInts = require('wasmsnark/tools/stringifybigint').stringifyBigInts;
const unstringifyBigInts2 = require('wasmsnark/tools/stringifybigint').unstringifyBigInts;
const bigInt2BytesLE = require('wasmsnark/src/utils.js').bigInt2BytesLE

// const crypto = require('crypto');
// const { assert } = require('console');

const MerkleTree = require('fixed-merkle-tree').MerkleTree;

const rbigint = (nbytes) => bigInt.randBetween(0, bigInt(2).pow(nbytes * 8));

const toFixedHex = (number, length = 32) =>
  '0x' +
  bigInt(number)
    .toString(16)
    .padStart(length * 2, '0');
const getRandomRecipient = () => rbigint(20);

let hasher;

Bytes2bigIntLE = function(buff) {
  let res = bigInt.zero;

  for (let i = 0; i < buff.length; i++) {
      const n = bigInt(buff[i]);
      res = res.add(n.shiftLeft(i * 8));
  }
  return res;
};

Byte2bigIntGE = function(buff) {
  let res = bigInt.zero;
  for (let i = 0; i < buff.length; i++) {
      const n = bigInt(buff[buff.length - i - 1]);
      res = res.add(n.shiftLeft(i * 8));
  }
  return res;
};


function generateDeposit() {
  let deposit = {
    secret: rbigint(31),
    nullifier: rbigint(31),
  }
  // const preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
  const preimage = Buffer.concat([
                                  Buffer.from(bigInt2BytesLE(deposit.nullifier, 31)),
                                  Buffer.from(bigInt2BytesLE(deposit.secret, 31)),
                                ])
  deposit.commitment = hasher(preimage)
  return deposit
};

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
    let pedersenHash = await circomlibjs.buildPedersenHash();
    let babyJub = await circomlibjs.buildBabyjub();

    hasher = (data) => babyJub.F.toObject(babyJub.unpackPoint(pedersenHash.hash(data))[0]);

    tree = new MerkleTree(levels)
    const txParams = {
      from: operator
    };

    tornado = await ETHTornado.new(
                                  Verifier.address,
                                  Hasher.address,
                                  value,
                                  levels,
                                  txParams
                                );
    // snapshotId = await takeSnapshot()
    // groth16 = await buildGroth16()
    // circuit = require('../build/circuits/withdraw.json')
    // proving_key = fs.readFileSync('build/circuits/withdraw_verification_key.json').buffer
    verification_key = JSON.parse(fs.readFileSync('build/circuits/withdraw_verification_key.json'));
  })

/* ///////
  describe('#constructor', () => {
    it('should initialize', async () => {
      const etherDenomination = await tornado.denomination();
      etherDenomination.should.be.eq.BN(value);
    })
  })

  describe('#deposit', () => {
    it('should emit event', async () => {
      let commitment = toFixedHex(42);
      let { logs } = await tornado.deposit(commitment, { value, from: sender });

      logs[0].event.should.be.equal('Deposit');
      logs[0].args.commitment.should.be.equal(commitment);
      logs[0].args.leafIndex.should.be.eq.BN(0);

      commitment = toFixedHex(12);
      ;({ logs } = await tornado.deposit(commitment, { value, from: accounts[2] }))

      logs[0].event.should.be.equal('Deposit');
      logs[0].args.commitment.should.be.equal(commitment);
      logs[0].args.leafIndex.should.be.eq.BN(1);
    })

    it('should throw if there is a such commitment', async () => {
      const commitment = toFixedHex(33);
      await tornado.deposit(commitment, { value, from: sender })
            .should.be.fulfilled;
      await tornado.deposit(commitment, { value, from: sender })
            .should.be.rejectedWith('The commitment has been submitted');
    })
  })
/////// */

  describe('snark proof verification on js side', () => {
    it('should detect tampering', async () => {
      const deposit = generateDeposit()
      tree.insert(deposit.commitment)
      const { pathElements, pathIndices } = tree.proof(deposit.commitment)

      const input = stringifyBigInts({
        root: tree.root,
        nullifierHash: hasher(bigInt2BytesLE(deposit.nullifier, 31)),
        nullifier: deposit.nullifier,
        relayer: bigInt(operator.slice(2), 16),
        recipient,
        fee,
        refund,
        secret: deposit.secret,
        pathElements: pathElements,
        pathIndices: pathIndices,
      })
      console.log(input)

      // const vKey = JSON.parse(fs.readFileSync("verification_key.json"));
      const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                    input,
                                                    "./build/circuits/withdraw_js/withdraw.wasm",
                                                    "./build/circuits/circuit_withdraw_final.zkey"
                                                    );
      console.log(proof)
      console.log(publicSignals)

  //     let proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key)
  //     const originalProof = JSON.parse(JSON.stringify(proofData))
  //     let result = snarkVerify(proofData)
  //     result.should.be.equal(true)

  //     // nullifier
  //     proofData.publicSignals[1] =
  //       '133792158246920651341275668520530514036799294649489851421007411546007850802'
  //     result = snarkVerify(proofData)
  //     result.should.be.equal(false)
  //     proofData = originalProof

  //     // try to cheat with recipient
  //     proofData.publicSignals[2] = '133738360804642228759657445999390850076318544422'
  //     result = snarkVerify(proofData)
  //     result.should.be.equal(false)
  //     proofData = originalProof

  //     // fee
  //     proofData.publicSignals[3] = '1337100000000000000000'
  //     result = snarkVerify(proofData)
  //     result.should.be.equal(false)
  //     proofData = originalProof
    })
  })

})