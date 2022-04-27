pragma circom 2.0.0;

include "commitmentHasher.circom";
include "merkleTree.circom";

// Verifies that commitment that corresponds to given secret and nullifier is included in the merkle tree of deposits
template Withdraw(levels) {
    signal input root;
    signal input nullifierHash;
    signal input recipient; // not taking part in any computations
    signal input relayer;  // not taking part in any computations
    signal input fee;      // not taking part in any computations
    signal input refund;   // not taking part in any computations
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Debug Output
    signal output input_root;
    signal output circuit_root;
    signal output circuit_nullifier;
    signal output circuit_nullifierHash;
    signal output circuit_secret;
    signal output circuit_commitment;
    // signal output circuit_pathElements[levels];
    // signal output circuit_pathIndices[levels];

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.nullifierHash === nullifierHash;

    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitment; //hasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
        // circuit_pathElements[i] <== pathElements[i];
        // circuit_pathIndices[i] <== pathIndices[i];        
    }
    //Debug -- Start
    input_root <== root;    
    circuit_root <== tree.circuit_root;
    circuit_nullifier <== nullifier;
    circuit_nullifierHash <== hasher.nullifierHash;
    circuit_secret <== secret;
    circuit_commitment <== hasher.commitment;
    //Debug -- End

    // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
    // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
    // Squares are used to prevent optimizer from removing those constraints
    signal recipientSquare;
    signal feeSquare;
    signal relayerSquare;
    signal refundSquare;
    recipientSquare <== recipient * recipient;
    feeSquare <== fee * fee;
    relayerSquare <== relayer * relayer;
    refundSquare <== refund * refund;
}

component main {public [root, nullifierHash, recipient, relayer, fee, refund]} = Withdraw(20);
