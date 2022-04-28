// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IHasher {
  function MiMCSponge(uint256 in_xL, uint256 in_xR, uint256 k) external pure returns (uint256 xL, uint256 xR);
}

contract MerkleTreeWithHistory {
  uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
  uint256 public constant ZERO_VALUE = 8568824596295711272276493421173227402986947053170746004488571001319888434851; // = keccak256("hongbao") % FIELD_SIZE
  IHasher public immutable hasher;

  uint32 public levels;

  // the following variables are made public for easier testing and debugging and
  // are not supposed to be accessed in regular code

  // filledSubtrees and roots could be bytes32[size], but using mappings makes it cheaper because
  // it removes index range check on every interaction
  mapping(uint256 => bytes32) public filledSubtrees;
  mapping(uint256 => bytes32) public roots;
  uint32 public constant ROOT_HISTORY_SIZE = 30;
  uint32 public currentRootIndex = 0;
  uint32 public nextIndex = 0;

  constructor(uint32 _levels, IHasher _hasher) {
    require(_levels > 0, "_levels should be greater than zero");
    require(_levels < 32, "_levels should be less than 32");
    levels = _levels;
    hasher = _hasher;

    for (uint32 i = 0; i < _levels; i++) {
      filledSubtrees[i] = zeros(i);
    }

    roots[0] = zeros(_levels - 1);
  }

  /**
    @dev Hash 2 tree leaves, returns MiMC(_left, _right)
  */
  function hashLeftRight(
    IHasher _hasher,
    bytes32 _left,
    bytes32 _right
  ) public pure returns (bytes32) {
    require(uint256(_left) < FIELD_SIZE, "_left should be inside the field");
    require(uint256(_right) < FIELD_SIZE, "_right should be inside the field");
    // uint256 R = uint256(_left);
    // uint256 C = 0;
    // (R, C) = _hasher.MiMCSponge(R, C);
    // R = addmod(R, uint256(_right), FIELD_SIZE);
    // (R, C) = _hasher.MiMCSponge(R, C);
    // return bytes32(R);
    (uint256 hashValue,) = _hasher.MiMCSponge(uint256(_left), uint256(_right), 0);
    
    return bytes32(hashValue);
  }

  function _insert(bytes32 _leaf) internal returns (uint32 index) {
    uint32 _nextIndex = nextIndex;
    require(_nextIndex != uint32(2)**levels, "Merkle tree is full. No more leaves can be added");
    uint32 currentIndex = _nextIndex;
    bytes32 currentLevelHash = _leaf;
    bytes32 left;
    bytes32 right;

    for (uint32 i = 0; i < levels; i++) {
      if (currentIndex % 2 == 0) {
        left = currentLevelHash;
        right = zeros(i);
        filledSubtrees[i] = currentLevelHash;
      } else {
        left = filledSubtrees[i];
        right = currentLevelHash;
      }
      currentLevelHash = hashLeftRight(hasher, left, right);
      currentIndex /= 2;
    }

    uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
    currentRootIndex = newRootIndex;
    roots[newRootIndex] = currentLevelHash;
    nextIndex = _nextIndex + 1;
    return _nextIndex;
  }

  /**
    @dev Whether the root is present in the root history
  */
  function isKnownRoot(bytes32 _root) public view returns (bool) {
    if (_root == 0) {
      return false;
    }
    uint32 _currentRootIndex = currentRootIndex;
    uint32 i = _currentRootIndex;
    do {
      if (_root == roots[i]) {
        return true;
      }
      if (i == 0) {
        i = ROOT_HISTORY_SIZE;
      }
      i--;
    } while (i != _currentRootIndex);
    return false;
  }

  /**
    @dev Returns the last root
  */
  function getLastRoot() public view returns (bytes32) {
    return roots[currentRootIndex];
  }

  /// @dev provides Zero (Empty) elements for a MiMC MerkleTree. Up to 32 levels
  function zeros(uint256 i) public pure returns (bytes32) {
    if (i == 0) return bytes32(uint256(0x12f1c868f7a8a61c1c0c699f7272f7089ca416432fcc978be7abb941e15ab6a3));
    else if (i == 1) return bytes32(uint256(0x1958734a1939afe83c953f02b3be98472a3f8771d860cc0102fc654a5678151f));
    else if (i == 2) return bytes32(uint256(0x14cd99063d192729fca364c97d738ad525384ad3b032f2577481cc8d354f759b));
    else if (i == 3) return bytes32(uint256(0x1dd320cfc53be719971fcee55f7d5d9236af725dc4d7c1efe589f6b11bdbff75));
    else if (i == 4) return bytes32(uint256(0x271f55eb3e20cecf7cd330009a54e8e1e4e19a3f3b41bbf5594786ec1a7fa109));
    else if (i == 5) return bytes32(uint256(0x1b593a92a49c9251362a0d088ec3024f2984aac7a93a96be5359c0c78914be2f));
    else if (i == 6) return bytes32(uint256(0x123b8e844c5b6576aac1b866d6daf6106b35ac9e27e5798a8fb39ee524af3be7));
    else if (i == 7) return bytes32(uint256(0x17f733e09c661a0210882cea5420339fa8a947a1938b4af63b2718b243d5b417));
    else if (i == 8) return bytes32(uint256(0x1d72e19b0f61ff045fc9209a95a194274de7af6aee9620794766f2575c525e58));
    else if (i == 9) return bytes32(uint256(0x271e292a9575d4423205c0fee36d692de829f09fa8d7368891be18a6ca8de323));
    else if (i == 10) return bytes32(uint256(0x20df0aba7ba8b3c1a60c6c5ee77f128b49a54b0a0342378b7686bd279d71ee94));
    else if (i == 11) return bytes32(uint256(0x2afc5c9d4421c336247368e53e4f5430000177a0850b495662beb4ae0fef03e0));
    else if (i == 12) return bytes32(uint256(0x5553548aba8e2159bfdb584a498de22118dfd4b8a506148a65e3df43eb224b1));
    else if (i == 13) return bytes32(uint256(0x146d660bd0a9f63280fc1e618d616ac17183ed6a620d71eb4565a86438c679cf));
    else if (i == 14) return bytes32(uint256(0x26c2ab752738b330651fa868161de2a2cd0c7a048918b46757fb5f3ac61a9879));
    else if (i == 15) return bytes32(uint256(0x1876286e55a365d80cd8fafe439295103d04140f71c1a318fd91de11ed2f337d));
    else if (i == 16) return bytes32(uint256(0x1f9632ca4e34aa7774cd87e7e920c4a87654e2422399bdf0533e047e27266de5));
    else if (i == 17) return bytes32(uint256(0x6b1d8a8a98e18412a704c714548f4bfc64ecb3363ef70c5750ca35e808395dd));
    else if (i == 18) return bytes32(uint256(0x13f2dae7beb599ef316107a909be285fc2825ee15cd8dc1b25f3a32d4d692207));
    else if (i == 19) return bytes32(uint256(0x23693fee538fc9b3ac1de11170797289b3531dca97c4928cbf4b1ff64d319810));
    else if (i == 20) return bytes32(uint256(0x320f10f58148fa2c4abee2eaf08f9a874e88682016e40580a9ba706f7d0d210));
    else revert("Index out of bounds");
  }
}
