/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const fs = require('fs');
const path = require("path");
const { toBN } = require('web3-utils');
// const { takeSnapshot, revertSnapshot } = require('../scripts/ganacheHelper')

const Hasher = artifacts.require("Hasher");
const Verifier = artifacts.require('Verifier');
const ETHTornado = artifacts.require("ETHTornado");
const { ETH_AMOUNT, MERKLE_TREE_HEIGHT } = process.env;

const snarkjs = require('snarkjs');
const bigInt = require("big-integer");
const circomlibjs = require('circomlibjs');
// const stringifyBigInts = require('wasmsnark/tools/stringifybigint').stringifyBigInts;
// const unstringifyBigInts = require('wasmsnark/tools/stringifybigint').unstringifyBigInts;
const bigInt2BytesLE = require('wasmsnark/src/utils.js').bigInt2BytesLE

const MerkleTree = require('fixed-merkle-tree').MerkleTree;
const wasm_tester = require("circom_tester").wasm;

const FIELD_SIZE = bigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const ZERO_VALUE = bigInt('8568824596295711272276493421173227402986947053170746004488571001319888434851').value; // = keccak256("hongbao") % FIELD_SIZE

const rbigint = (nbytes) => bigInt.randBetween(0, bigInt(2).pow(nbytes * 8));
const toFixedHex = (number, length = 32) =>
  '0x' +
  bigInt(number)
    .toString(16)
    .padStart(length * 2, '0');
const getRandomRecipient = () => rbigint(20);


contract('ETHTornado Test', accounts => {  
  let tornado;
  let globalTree;
  const sender = accounts[1];
  const operator = accounts[0];
  const levels = MERKLE_TREE_HEIGHT || 16;
  const value = ETH_AMOUNT || '1000000000000000000'; // 1 ether
  let snapshotId;
  const fee = bigInt(ETH_AMOUNT).shiftRight(2) || bigInt(1e18);
  const refund = bigInt(0);
  const recipient = getRandomRecipient();
  const relayer = accounts[1];
  let pedersenHasher;
  let mimcHasher;
  let verification_key

  
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
    // mimcHasher = (left, right) => {let v=mimcSponge.F.toObject(mimcSponge.hash(left, right, 0).xL); console.log(typeof(left), typeof(right));console.log(left.toString(16), right.toString(16), v.toString(16)); return v;}
    mimcHasher = (left, right) => mimcSponge.F.toObject(mimcSponge.hash(left, right, 0).xL);

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
    globalTree = new MerkleTree(levels, [], { hashFunction: mimcHasher, zeroElement: ZERO_VALUE});
    verification_key = JSON.parse(fs.readFileSync('build/circuits/withdraw_verification_key.json'));    
  })

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
      globalTree.insert(commitment);

      logs[0].event.should.be.equal('Deposit');
      logs[0].args.commitment.should.be.equal(commitment);
      logs[0].args.leafIndex.should.be.eq.BN(0);

      commitment = toFixedHex(12);
      ;({ logs } = await tornado.deposit(commitment, { value, from: accounts[2] }))
      globalTree.insert(commitment);

      logs[0].event.should.be.equal('Deposit');
      logs[0].args.commitment.should.be.equal(commitment);
      logs[0].args.leafIndex.should.be.eq.BN(1);
    })

    it('should throw if there is a such commitment', async () => {
      const commitment = toFixedHex(33);
      await tornado.deposit(commitment, { value, from: sender })
            .should.be.fulfilled;
      globalTree.insert(commitment);

      await tornado.deposit(commitment, { value, from: sender })
            .should.be.rejectedWith('The commitment has been submitted');
    })
  })

  describe('snark proof verification on js side', () => {
    let local_tree;

    before(async () => {    
      local_tree = new MerkleTree(levels, [], { hashFunction: mimcHasher, zeroElement: ZERO_VALUE});
    });

    it('should detect tampering', async () => {
      const deposit = generateDeposit();
      local_tree.insert(deposit.commitment);
      const {pathElements, pathIndices} = local_tree.proof(deposit.commitment);
    
      const input = { 
                      root: local_tree.root.toString(),
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
  })

  describe('#withdraw', () => {    
    const packProofData = (proof) => {
        // return [
        //     toFixedHex(proof.pi_a[0]), toFixedHex(proof.pi_a[1]),
        //     toFixedHex(proof.pi_b[0][1]), toFixedHex(proof.pi_b[0][0]), 
        //     toFixedHex(proof.pi_b[1][1]), toFixedHex(proof.pi_b[1][0]),
        //     toFixedHex(proof.pi_c[0]), toFixedHex(proof.pi_c[1]),
        //   ]
        return [
          proof.pi_a[0], proof.pi_a[1],
          proof.pi_b[0][1], proof.pi_b[0][0], proof.pi_b[1][1], proof.pi_b[1][0],
          proof.pi_c[0], proof.pi_c[1],
        ]
      };

    it('should work', async () => {
        const deposit = generateDeposit();
        globalTree.insert(deposit.commitment);
  
        // const gasPrice = await web3.eth.getGasPrice();
        // let gas = await tornado.deposit.estimateGas(toFixedHex(deposit.commitment), {value, from: sender});
        // let gasCost = bigInt(gas).multiply(gasPrice);
        // console.log('gasCost:', gasCost);

        // Deposit and check balance
        let balanceTornadoBefore = await web3.eth.getBalance(tornado.address);
        let balanceSenderBefore = await web3.eth.getBalance(sender.toString());
        await tornado.deposit(toFixedHex(deposit.commitment), { value, from: sender}); 
        let balanceTornadoAfter = await web3.eth.getBalance(tornado.address);
        let balanceSenderAfter = await web3.eth.getBalance(sender.toString());
        
        balanceTornadoAfter.should.be.eq.BN(toBN(balanceTornadoBefore).add(toBN(value)));
        balanceSenderAfter.should.be.lt.BN(toBN(balanceSenderBefore).sub(toBN(value))); // new_balance = previous_balance - send_amount - gas
  
        // Prepare proof
        const { pathElements, pathIndices } =  globalTree.proof(deposit.commitment);
        // Circuit input
        const input = { 
          root: globalTree.root.toString(),
          nullifier: deposit.nullifier.toString(),
          nullifierHash: pedersenHasher(bigInt2BytesLE(deposit.nullifier, 31)).toString(),
          secret: deposit.secret.toString(),
          pathElements: pathElements,
          pathIndices: pathIndices,
          recipient: recipient.toString(),
          relayer: bigInt(relayer.slice(2), 16).toString(),
          fee: fee.toString(),
          refund: refund.toString(),
        };


        const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                                      input,
                                                                      "./build/circuits/withdraw_js/withdraw.wasm",
                                                                      "./build/circuits/circuit_withdraw_final.zkey"
                                                                      );
        // let result = await snarkjs.groth16.verify(verification_key, publicSignals, proof);
        // result.should.be.equal(true);
        // console.log(publicSignals);
        
        let isSpent = await tornado.isSpent(toFixedHex(input.nullifierHash));
        isSpent.should.be.equal(false);

        // const pubString = unstringifyBigInts(publicSignals);
        // const proofString = unstringifyBigInts(proof);
        // const callData = await snarkjs.groth16.exportSolidityCallData(proofString, pubString);
        // console.log("exportSolidityCallData:", callData);        

        const proofData = packProofData(proof);
        // const publicInputs = [
        //   toFixedHex(input.root),
        //   toFixedHex(input.nullifierHash),
        //   toFixedHex(input.recipient),
        //   toFixedHex(input.relayer),
        //   toFixedHex(input.fee),
        //   toFixedHex(input.refund),
        // ];
        // console.log("proof data:", proofData);
        // console.log("public inputs:", publicSignals)          

        balanceTornadoBefore = await web3.eth.getBalance(tornado.address);
        const balanceRelayerBefore = await web3.eth.getBalance(relayer.toString());
        const balanceReceiverBefore = await web3.eth.getBalance(toFixedHex(recipient, 20));

        const { logs } = await tornado.withdraw(proofData, publicSignals, { from: relayer});
       
        balanceTornadoAfter = await web3.eth.getBalance(tornado.address);
        const balanceRelayerAfter = await web3.eth.getBalance(relayer.toString());
        const balanceReceiverAfter = await web3.eth.getBalance(toFixedHex(recipient, 20));
        const feeBN = toBN(fee.toString());
        balanceTornadoAfter.should.be.eq.BN(toBN(balanceTornadoBefore).sub(toBN(value)));
        balanceRelayerAfter.should.be.gt.BN(toBN(balanceRelayerBefore));  
        balanceReceiverAfter.should.be.gt.BN(toBN(balanceReceiverBefore));
  
        logs[0].event.should.be.equal('Withdrawal')
        logs[0].args.nullifierHash.should.be.equal(toFixedHex(input.nullifierHash))
        logs[0].args.relayer.should.be.eq.BN(relayer)
        logs[0].args.fee.should.be.eq.BN(feeBN)

        //Check the commitment is spent
        isSpent = await tornado.isSpent(toFixedHex(input.nullifierHash))
        isSpent.should.be.equal(true)
    })
    it('should prevent double spend', async () => {
      const deposit = generateDeposit();
      globalTree.insert(deposit.commitment);
      await tornado.deposit(toFixedHex(deposit.commitment), { value, from: sender });

      const { pathElements, pathIndices } = globalTree.proof(deposit.commitment);

      const input = { 
        root: globalTree.root.toString(),
        nullifier: deposit.nullifier.toString(),
        nullifierHash: pedersenHasher(bigInt2BytesLE(deposit.nullifier, 31)).toString(),
        secret: deposit.secret.toString(),
        pathElements: pathElements,
        pathIndices: pathIndices,
        recipient: recipient.toString(),
        relayer: bigInt(relayer.slice(2), 16).toString(),
        fee: fee.toString(),
        refund: refund.toString(),
      };
      const {proof, publicSignals} = await snarkjs.groth16.fullProve(
        input,
        "./build/circuits/withdraw_js/withdraw.wasm",
        "./build/circuits/circuit_withdraw_final.zkey"
        );
      
      const proofData = packProofData(proof);
      await tornado.withdraw(proofData, publicSignals, { from: relayer}).should.be.fulfilled

      const error = await tornado.withdraw(proofData, publicSignals, { from: relayer }).
                    should.be.rejectedWith('The note has been already spent');
    })    
  })
})