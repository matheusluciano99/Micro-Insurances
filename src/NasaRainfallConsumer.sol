// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {FunctionsClient} from
    "chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from
    "chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

interface IWeatherOracleWritable {
    function reportRainfall(uint256 regionId, uint256 day, uint256 rainfallMm100) external;
}

/// @title NasaRainfallConsumer
/// @notice Oráculo de chuva alimentado pela rede descentralizada Chainlink
///         Functions: a DON executa um JS que consulta a API oficial
///         NASA POWER (PRECTOTCORR) e grava o resultado no WeatherOracle.
///
/// @dev Este contrato deve ser cadastrado como `reporter` do WeatherOracle
///      (`setReporter(consumer, true)`). Assim o "reporter" deixa de ser um
///      humano e passa a ser este contrato, alimentado pela DON — o que
///      minimiza a confiança no dado (qualquer um audita o JS e a NASA).
///
///      Chainlink Functions NÃO roda em Anvil local (não há DON). Em testes,
///      um MockFunctionsRouter simula o ciclo request/fulfill. Execução real
///      é em testnet (ex.: Sepolia) com subscription + LINK.
contract NasaRainfallConsumer is FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    address public owner;
    IWeatherOracleWritable public immutable weatherOracle;

    // Config específica de rede/DON (setável pelo owner).
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public callbackGasLimit;

    /// @notice Código JS executado pela DON (consulta NASA POWER).
    string public source;

    struct Pending {
        uint256 regionId;
        uint256 day;
        bool exists;
    }

    /// @notice requestId => contexto (a DON só devolve bytes; guardamos aqui).
    mapping(bytes32 => Pending) public pending;

    bytes32 public lastRequestId;
    bytes public lastError;

    event RainfallRequested(bytes32 indexed requestId, uint256 indexed regionId, uint256 indexed day);
    event RainfallFulfilled(bytes32 indexed requestId, uint256 regionId, uint256 day, uint256 rainfallMm100);
    event RainfallRequestFailed(bytes32 indexed requestId, bytes err);

    modifier onlyOwner() {
        require(msg.sender == owner, "Nasa: somente owner");
        _;
    }

    constructor(
        address router,
        address weatherOracle_,
        bytes32 donId_,
        uint64 subscriptionId_,
        uint32 callbackGasLimit_,
        string memory source_
    ) FunctionsClient(router) {
        require(weatherOracle_ != address(0), "Nasa: oracle zero");
        owner = msg.sender;
        weatherOracle = IWeatherOracleWritable(weatherOracle_);
        donId = donId_;
        subscriptionId = subscriptionId_;
        callbackGasLimit = callbackGasLimit_;
        source = source_;
    }

    function setConfig(bytes32 donId_, uint64 subscriptionId_, uint32 callbackGasLimit_) external onlyOwner {
        donId = donId_;
        subscriptionId = subscriptionId_;
        callbackGasLimit = callbackGasLimit_;
    }

    function setSource(string calldata source_) external onlyOwner {
        source = source_;
    }

    /// @notice Pede à DON a chuva de um dia para uma região.
    /// @param regionId      região da apólice (mesma chave do WeatherOracle)
    /// @param day           dia absoluto = floor(timestamp/86400) — o chamador
    ///                       calcula da data para casar com `currentDay()`
    /// @param lat           latitude (string, ex.: "-9.389")
    /// @param lon           longitude (string, ex.: "-40.502")
    /// @param dateYYYYMMDD  data NASA POWER (ex.: "20240115")
    function requestRainfall(
        uint256 regionId,
        uint256 day,
        string calldata lat,
        string calldata lon,
        string calldata dateYYYYMMDD
    ) external onlyOwner returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);

        string[] memory args = new string[](3);
        args[0] = lat;
        args[1] = lon;
        args[2] = dateYYYYMMDD;
        req.setArgs(args);

        requestId = _sendRequest(req.encodeCBOR(), subscriptionId, callbackGasLimit, donId);
        pending[requestId] = Pending({regionId: regionId, day: day, exists: true});
        lastRequestId = requestId;
        emit RainfallRequested(requestId, regionId, day);
    }

    /// @notice Callback da DON. Se o JS falhou (ex.: dado faltante -999 -> throw),
    ///         `err` vem preenchido e NÃO reportamos nada (não fabrica dia seco).
    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
        Pending memory p = pending[requestId];
        require(p.exists, "Nasa: request desconhecido");
        delete pending[requestId];

        if (err.length > 0) {
            lastError = err;
            emit RainfallRequestFailed(requestId, err);
            return;
        }

        uint256 rainfallMm100 = abi.decode(response, (uint256));
        weatherOracle.reportRainfall(p.regionId, p.day, rainfallMm100);
        emit RainfallFulfilled(requestId, p.regionId, p.day, rainfallMm100);
    }
}
