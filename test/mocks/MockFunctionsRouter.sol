// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/// @notice Simula a DON da Chainlink Functions em testes locais (não há DON
///         em Anvil). Registra o request e permite disparar o callback.
interface IFunctionsClientLike {
    function handleOracleFulfillment(bytes32 requestId, bytes memory response, bytes memory err) external;
}

contract MockFunctionsRouter {
    uint256 public nonce;
    bytes32 public lastRequestId;
    bytes public lastData;

    /// @dev Mesma assinatura que FunctionsClient._sendRequest invoca.
    function sendRequest(uint64, bytes calldata data, uint16, uint32, bytes32)
        external
        returns (bytes32 requestId)
    {
        nonce++;
        requestId = keccak256(abi.encodePacked(msg.sender, nonce));
        lastRequestId = requestId;
        lastData = data;
    }

    /// @notice Dispara o callback como se fosse a DON (msg.sender = este router).
    function fulfill(address consumer, bytes32 requestId, bytes calldata response, bytes calldata err) external {
        IFunctionsClientLike(consumer).handleOracleFulfillment(requestId, response, err);
    }
}
