// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProofOfExistence {
    struct DocumentProof {
        uint256 timestamp;
        address owner;
    }

    mapping(bytes32 => DocumentProof) public proofs;

    function notarize(bytes32 documentHash, address owner) external {
        require(proofs[documentHash].timestamp == 0, "Documento já registrado");
        proofs[documentHash] = DocumentProof(block.timestamp, owner);
    }

    function verify(bytes32 documentHash) external view returns (uint256, address) {
        DocumentProof memory proof = proofs[documentHash];
        return (proof.timestamp, proof.owner);
    }
}
