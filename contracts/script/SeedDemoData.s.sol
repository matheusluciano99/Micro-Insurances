// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Script, console2} from "forge-std/Script.sol";

interface IWeatherOracleWritable {
    function reportRainfall(uint256 regionId, uint256 day, uint256 rainfallMm100) external;
}

/// @notice Pré-popula DOIS cenários on-chain pra demo, num único broadcast:
///         - região 1 (Nordeste): 20 dias com 0 mm    -> seca garantida (claim)
///         - região 2 (Sudeste):  20 dias com chuva  > 1 mm  (sem seca)
///
///         Roda: `just seed-demo`. Pede a senha do keystore 1x e dispara
///         todas as txs em sequência.
contract SeedDemoData is Script {
    address constant ORACLE = 0x9b3ccC0007e6a2A6AeEbc2bf84df1A01b2723c05;

    uint256 constant DRY_REGION = 1; // Nordeste / Petrolina-PE
    uint256 constant WET_REGION = 2; // Sudeste / São Paulo
    uint256 constant DAYS_SEEDED = 20;

    function run() external {
        IWeatherOracleWritable oracle = IWeatherOracleWritable(ORACLE);
        uint256 today = block.timestamp / 1 days;

        // Padrão de chuva pra região úmida — todos os valores > 100 (1 mm)
        // pra streak de seca nunca subir. Variação só pra dar visual ao gráfico.
        uint16[20] memory wetMm100 = [
            uint16(250), 200, 280, 150, 220, 300, 200, 250, 180, 240, 200, 270, 150, 290, 220, 300, 250, 200, 180, 240
        ];

        vm.startBroadcast();
        for (uint256 i = 0; i < DAYS_SEEDED; i++) {
            uint256 day = today + i;
            // Região seca: 0 mm sempre
            oracle.reportRainfall(DRY_REGION, day, 0);
            // Região úmida: padrão acima do limiar
            oracle.reportRainfall(WET_REGION, day, uint256(wetMm100[i]));
        }
        vm.stopBroadcast();

        console2.log("currentDay      :", today);
        console2.log("seeded days     :", DAYS_SEEDED);
        console2.log("dry region (1)  : 0 mm  -> claim acionavel com drySpell=1");
        console2.log("wet region (2)  : 1.5-3.0 mm -> nunca dispara claim");
    }
}
