/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const fs = require('fs');
const path = require("path");
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
const wasm_tester = require("circom_tester").wasm;

const FIELD_SIZE = bigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const ZERO_VALUE = bigInt('8568824596295711272276493421173227402986947053170746004488571001319888434851'); // = keccak256("hongbao") % FIELD_SIZE


const rbigint = (nbytes) => bigInt.randBetween(0, bigInt(2).pow(nbytes * 8));
const toFixedHex = (number, length = 32) =>
  '0x' +
  bigInt(number)
    .toString(16)
    .padStart(length * 2, '0');
const getRandomRecipient = () => rbigint(20);
const 

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
  let tornado;
  const sender = accounts[0];
  const operator = accounts[0];
  const levels = MERKLE_TREE_HEIGHT || 16;
  const value = ETH_AMOUNT || '1000000000000000000'; // 1 ether
  let snapshotId;
  let tree;
  const fee = bigInt(ETH_AMOUNT).shiftLeft(1) || bigInt(1e17);
  const refund = bigInt(0);
  const recipient = getRandomRecipient();
  const relayer = accounts[9];
  let pedersenHasher;
  let mimcHasher;
  let groth16;
  let circuit;
  let proving_key;

  
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
    deposit.commitment = pedersenHasher(preimage)
    return deposit
  };


  before(async () => {    
    let pedersenHash = await circomlibjs.buildPedersenHash();
    let babyJub = await circomlibjs.buildBabyjub();
    let mimcSponge = await circomlibjs.buildMimcSponge();

    pedersenHasher = (data) => babyJub.F.toObject(babyJub.unpackPoint(pedersenHash.hash(data))[0]);
    mimcHasher = (left, right) => mimcSponge.F.toObject(mimcSponge.hash(left, right, 0).xL);

    tree = new MerkleTree(levels, [], { hashFunction: mimcHasher, zeroElement: ZERO_VALUE});
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
    
  })

/*
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

  describe('snark proof verification on js side', () => {
    let verification_key;

    before( async() => {           
      verification_key = JSON.parse(fs.readFileSync('build/circuits/withdraw_verification_key.json'));
    });

    it('should detect tampering', async () => {
      const deposit = generateDeposit();
      tree.insert(deposit.commitment);
      const {pathElements, pathIndices} = tree.proof(deposit.commitment);
    
      const input = { 
                      root: tree.root.toString(),
                      nullifier: deposit.nullifier.toString(),
                      nullifierHash: pedersenHasher(bigInt2BytesLE(deposit.nullifier, 31)).toString(),
                      secret: deposit.secret.toString(),
                      pathElements: pathElements,
                      pathIndices: pathIndices,
                      recipient: recipient.toString(),
                      relayer: bigInt(operator.slice(2), 16).toString(),
                      fee: fee.toString(),
                      refund: refund.toString(),
                    };
      // console.log(input)

      // withdrawCircuit = await wasm_tester(path.join(__dirname, "../circuits","withdraw.circom"));      
      // let w = await withdrawCircuit.calculateWitness(input, true);
      // await withdrawCircuit.checkConstraints(w);

      const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                    input,
                                                    "./build/circuits/withdraw_js/withdraw.wasm",
                                                    "./build/circuits/circuit_withdraw_final.zkey"
                                                    );
      
      // console.log("Proof: ");
      // console.log(JSON.stringify(proof, null, 1));
      // console.log(publicSignals);
      let result = await snarkjs.groth16.verify(verification_key, publicSignals, proof);
      result.should.be.equal(true);

      // Try to cheat with wrong nullifierhash
      let publicSignalsCopy = JSON.parse(JSON.stringify(publicSignals));
      publicSignalsCopy[1] =
        '133792158246920651341275668520530514036799294649489851421007411546007850802'
      result  = await snarkjs.groth16.verify(verification_key, publicSignalsCopy, proof);
      result.should.be.equal(false);


      // try to cheat with recipient
      publicSignalsCopy = JSON.parse(JSON.stringify(publicSignals));
      publicSignalsCopy[2] = '133738360804642228759657445999390850076318544422';
      result  = await snarkjs.groth16.verify(verification_key, publicSignalsCopy, proof);
      result.should.be.equal(false);


      // Try to cheat with fee
      publicSignalsCopy = JSON.parse(JSON.stringify(publicSignals));
      publicSignalsCopy[4] = '1337100000000000000000';
      result  = await snarkjs.groth16.verify(verification_key, publicSignalsCopy, proof);
      result.should.be.equal(false);
    })
*/

    describe('#withdraw', () => {
      it('should work', async () => {
        const deposit = generateDeposit();
        const user = accounts[4];
        tree.insert(deposit.commitment);
  
        const gasPrice = await web3.eth.getGasPrice();
        let gas = await tornado.deposit.estimateGas(toFixedHex(deposit.commitment), {value, from: user});
        let gasCost = bigInt(gas).multiply(gasPrice);
        console.log('gasCost:', gasCost);

        const balanceUserBefore = await web3.eth.getBalance(user);
        console.log("balance before:", balanceUserBefore);

        // Deposit and check balance
        let balanceTornadoBefore = await web3.eth.getBalance(tornado.address)
        await tornado.deposit(toFixedHex(deposit.commitment), { value, from: user}); 
        let balanceTornadoAfter = await web3.eth.getBalance(tornado.address)
        
        balanceTornadoAfter.should.be.eq.BN(toBN(balanceTornadoBefore).add(toBN(value)));
  
        // Prepare proof
        const { pathElements, pathIndices } =  tree.proof(deposit.commitment);
        // Circuit input
        const input = { 
          root: tree.root.toString(),
          nullifier: deposit.nullifier.toString(),
          nullifierHash: pedersenHasher(bigInt2BytesLE(deposit.nullifier, 31)).toString(),
          secret: deposit.secret.toString(),
          pathElements: pathElements,
          pathIndices: pathIndices,
          recipient: recipient.toString(),
          relayer: bigInt(operator.slice(2), 16).toString(),
          fee: fee.toString(),
          refund: refund.toString(),
        };

        const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                                      input,
                                                                      "./build/circuits/withdraw_js/withdraw.wasm",
                                                                      "./build/circuits/circuit_withdraw_final.zkey"
                                                                      );
        // console.log(publicSignals);

        balanceTornadoBefore = await web3.eth.getBalance(tornado.address);
        const balanceRelayerBefore = await web3.eth.getBalance(relayer);
        const balanceOperatorBefore = await web3.eth.getBalance(operator);
        const balanceReceiverBefore = await web3.eth.getBalance(toFixedHex(recipient, 20));
        let isSpent = await tornado.isSpent(toFixedHex(input.nullifierHash));
        isSpent.should.be.equal(false);
  
        const args = [
          toFixedHex(input.root),
          toFixedHex(input.nullifierHash),
          toFixedHex(input.recipient, 20),
          toFixedHex(input.relayer, 20),
          toFixedHex(input.fee),
          toFixedHex(input.refund),
        ]
        const { logs } = await tornado.withdraw(proof, ...args, { from: relayer})
  
        balanceTornadoAfter = await web3.eth.getBalance(tornado.address)
        const balanceRelayerAfter = await web3.eth.getBalance(relayer)
        const balanceOperatorAfter = await web3.eth.getBalance(operator)
        const balanceReceiverAfter = await web3.eth.getBalance(toFixedHex(recipient, 20))
        const feeBN = toBN(fee.toString())
        balanceTornadoAfter.should.be.eq.BN(toBN(balanceTornadoBefore).sub(toBN(value)))
        balanceRelayerAfter.should.be.eq.BN(toBN(balanceRelayerBefore))
        balanceOperatorAfter.should.be.eq.BN(toBN(balanceOperatorBefore).add(feeBN))
        balanceReceiverAfter.should.be.eq.BN(toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN))
  
        logs[0].event.should.be.equal('Withdrawal')
        logs[0].args.nullifierHash.should.be.equal(toFixedHex(input.nullifierHash))
        logs[0].args.relayer.should.be.eq.BN(operator)
        logs[0].args.fee.should.be.eq.BN(feeBN)
        isSpent = await tornado.isSpent(toFixedHex(input.nullifierHash))
        isSpent.should.be.equal(true)
      })
    })

  })