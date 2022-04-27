const path = require("path");
const Scalar = require("ffjavascript").Scalar;
const buildPedersenHash = require("circomlibjs").buildPedersenHash;
const buildMimcSponge = require("circomlibjs").buildMimcSponge;
const buildBabyJub = require("circomlibjs").buildBabyjub;
const wasm_tester = require("circom_tester").wasm;
const MerkleTree = require('fixed-merkle-tree').MerkleTree;
const bigInt = require("big-integer");


describe("Commitment Hasher Test", function() {
    // let babyJub
    let pedersen;
    let F;
    let commitmentHasherCircuit;
    this.timeout(100000);
    before( async() => {
        babyJub = await buildBabyJub();
        F = babyJub.F;
        pedersen = await buildPedersenHash();

        commitmentHasherCircuit = await wasm_tester(path.join(__dirname, "../circuits", "commitmentHasher.test.circom"));
    });
    after(async () => {
        // globalThis.curve_bn128.terminate();
    });

    async function verifyCommitmentHasher(_nullifier, _secret) {
        let w;

        let nullifier_buff = Buffer.alloc(31);
        Scalar.toRprLE(nullifier_buff, 0, Scalar.e(_nullifier), nullifier_buff.length);

        let secret_buff = Buffer.alloc(31);
        Scalar.toRprLE(secret_buff, 0, Scalar.e(_secret), secret_buff.length);

        w = await commitmentHasherCircuit.calculateWitness({ nullifier: _nullifier, secret: _secret}, true);

        const commitment_buff = Buffer.concat([nullifier_buff, secret_buff]);

        const commitmentHash = pedersen.hash(commitment_buff);
        const hP1 = babyJub.unpackPoint(commitmentHash);

        const nullifierHash = pedersen.hash(nullifier_buff);
        const hP2 = babyJub.unpackPoint(nullifierHash);

        // console.log("commitmentHash:", F.toObject(hP1[0]));
        // console.log("nullifierHash:", F.toObject(hP2[0]));

        await commitmentHasherCircuit.assertOut(w, {commitmentHash: F.toObject(hP1[0]), 
                                                    nullifierHash: F.toObject(hP2[0])});
    }

    it("Should Compute big value", async () => {
        let nullifier = "293145113002080864354859942535675522368952502950992663588348970337735067419";
        let secret = "189639915884766668134012755055612952971296867817286197960766047128712251041";
        
        await verifyCommitmentHasher(nullifier, secret);
    });

    it("Should calculate small value", async () => {
        let nullifier = "123";
        let secret = "456";
        
        await verifyCommitmentHasher(nullifier, secret);
    });
});


describe("Merkle Tree Test", function() {
    let babyJub
    let mimcSponge;
    let F;    
    let tree;
    this.timeout(100000);
    // const FIELD_SIZE = Scalar.e('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    const ZERO_VALUE = Scalar.e('8568824596295711272276493421173227402986947053170746004488571001319888434851'); // = keccak256("hongbao") % FIELD_SIZE

    const mimcHash = (left, right) => F.toObject(mimcSponge.hash(left, right, 0).xL);
    
    before( async() => {
        mimcSponge = await buildMimcSponge()
        F = mimcSponge.F;

        tree = new MerkleTree(20, [], { hashFunction: mimcHash, zeroElement: ZERO_VALUE});
        
        merkleTreeCircuit = await wasm_tester(path.join(__dirname, "../circuits", "merkleTree.test.circom"));
        // mimcCircuit = await wasm_tester(path.join(__dirname, "../circuits", "mimc.test.circom"));
    });

    after(async () => {
        // globalThis.curve_bn128.terminate();
    });

    it("Should insert many leaves and verify any one", async () => {
        let leaves = Array(100);
        let theOne = Math.floor(leaves.length / 2);

        for (var i = 0; i < leaves.length; i++){
            leaves[i] = bigInt.randBetween(0, bigInt(2).pow(256));
            tree.insert(leaves[i]);
        }
        const { pathElements, pathIndices } = tree.proof(leaves[theOne]);

        let w;

        w = await merkleTreeCircuit.calculateWitness({ leaf: leaves[theOne],
                                                        root: tree.root, 
                                                        pathElements: pathElements,
                                                        pathIndices: pathIndices}, 
                                                        true);

        // await merkleTreeCircuit.assertOut(w, {circuit_root: tree.root});
        await merkleTreeCircuit.checkConstraints(w);
    });

    // it ("Test mimc", async () => {
    //     let w;
    //     let left = Scalar.e("1");
    //     let right = Scalar.e("2");

    //     w = await mimcCircuit.calculateWitness({ left: left, right: right}, true);
    //     console.log(w);
    //     let hash = mimcHash(left, right);
    //     await mimcCircuit.assertOut(w, {hashFeistel: hash,
    //                                     hashSponge: hash});
    // });
});
