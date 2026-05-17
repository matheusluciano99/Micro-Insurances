// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/// @title WeatherOracle
/// @notice Mock do feed climático (papel de INMET / NASA POWER / Chainlink).
///         Registra a chuva diária por região. A chuva é guardada em
///         centésimos de milímetro (mm * 100) para permitir limiares como 1,50 mm.
///
/// @dev Limitação honesta (declarar no relatório): num produto real esse dado
///      viria de uma fonte pública reputável, idealmente agregada por mediana de
///      várias fontes para reduzir manipulação. Aqui é controlado pelo time
///      (owner/reporters) apenas para a demonstração.
contract WeatherOracle {
    address public owner;

    /// @notice Endereços autorizados a reportar chuva (ex.: estação/feed).
    mapping(address => bool) public isReporter;

    /// @notice regionId => day => chuva em mm*100.
    mapping(uint256 => mapping(uint256 => uint256)) private _rainfall;
    /// @notice regionId => day => se o dia já foi reportado.
    mapping(uint256 => mapping(uint256 => bool)) private _reported;

    event ReporterSet(address indexed reporter, bool allowed);
    event RainfallReported(uint256 indexed regionId, uint256 indexed day, uint256 rainfallMm100);

    modifier onlyOwner() {
        require(msg.sender == owner, "Oracle: somente owner");
        _;
    }

    modifier onlyReporter() {
        require(isReporter[msg.sender], "Oracle: somente reporter");
        _;
    }

    constructor() {
        owner = msg.sender;
        isReporter[msg.sender] = true;
        emit ReporterSet(msg.sender, true);
    }

    function setReporter(address reporter, bool allowed) external onlyOwner {
        isReporter[reporter] = allowed;
        emit ReporterSet(reporter, allowed);
    }

    /// @notice Registra a chuva de um dia para uma região.
    /// @param regionId      identificador da região
    /// @param day           índice do dia (o contrato de seguro define a numeração)
    /// @param rainfallMm100 chuva do dia em mm*100 (ex.: 1,50 mm = 150)
    function reportRainfall(uint256 regionId, uint256 day, uint256 rainfallMm100) external onlyReporter {
        _rainfall[regionId][day] = rainfallMm100;
        _reported[regionId][day] = true;
        emit RainfallReported(regionId, day, rainfallMm100);
    }

    /// @notice Lê a chuva reportada de um dia. Reverte se o dia ainda não foi reportado,
    ///         para o seguro nunca pagar com base em dado ausente.
    function getRainfall(uint256 regionId, uint256 day) external view returns (uint256) {
        require(_reported[regionId][day], "Oracle: dia nao reportado");
        return _rainfall[regionId][day];
    }

    function isReported(uint256 regionId, uint256 day) external view returns (bool) {
        return _reported[regionId][day];
    }
}
