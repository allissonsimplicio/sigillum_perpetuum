// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProofOfExistence {
    mapping(bytes32 => uint256) public proofs;

    function notarize(bytes32 documentHash) external {
        require(proofs[documentHash] == 0, "Documento já registrado");
        proofs[documentHash] = block.timestamp;
    }

    function verify(bytes32 documentHash) external view returns (uint256) {
        return proofs[documentHash];
    }
}