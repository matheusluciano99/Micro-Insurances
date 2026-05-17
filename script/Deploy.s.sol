// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {WeatherOracle} from "../src/WeatherOracle.sol";
import {CropInsurance} from "../src/CropInsurance.sol";

/// @notice Deploy para Anvil/testnet. Sobe os 3 contratos, minta stablecoin
///         para o deployer e aporta capital no pool.
///
/// Uso (Anvil local):
///   anvil
///   forge script script/Deploy.s.sol --rpc-url http://localhost:8545 \
///     --private-key <chave_anvil_0> --broadcast
contract Deploy is Script {
    uint256 constant PREMIUM_BPS = 500; // 5%
    uint256 constant POOL_CAPITAL = 100_000e18;

    // Apólice de exemplo (criada no deploy para validar que a numeração de dias
    // absoluta funciona com o relógio real da chain).
    uint256 constant SAMPLE_REGION = 1;
    uint256 constant SAMPLE_DURATION = 90; // safra (<= MAX_DURATION_DAYS)
    uint256 constant SAMPLE_DRY_SPELL = 10;
    uint256 constant SAMPLE_THRESHOLD = 100; // 1,00 mm
    uint256 constant SAMPLE_INSURED = 1_000e18;

    function run() external {
        vm.startBroadcast();

        MockStablecoin token = new MockStablecoin();
        WeatherOracle oracle = new WeatherOracle();
        CropInsurance insurance = new CropInsurance(address(token), address(oracle), PREMIUM_BPS);

        // Capital do pool + folga para o prêmio da apólice de exemplo.
        uint256 premium = (SAMPLE_INSURED * PREMIUM_BPS) / 10000;
        token.mint(msg.sender, POOL_CAPITAL + premium);
        token.approve(address(insurance), type(uint256).max);
        insurance.fundPool(POOL_CAPITAL);

        // startDay derivado do tempo REAL da chain (corrige o gotcha do dia
        // absoluto: numeração é dias desde a epoch Unix, não 0..N).
        uint256 startDay = insurance.currentDay();
        uint256 policyId = insurance.createPolicy(
            SAMPLE_REGION, startDay, SAMPLE_DURATION, SAMPLE_DRY_SPELL, SAMPLE_THRESHOLD, SAMPLE_INSURED
        );

        vm.stopBroadcast();

        console2.log("MockStablecoin :", address(token));
        console2.log("WeatherOracle  :", address(oracle));
        console2.log("CropInsurance  :", address(insurance));
        console2.log("Pool capital   :", POOL_CAPITAL);
        console2.log("Sample policy  :", policyId);
        console2.log("Policy startDay:", startDay);
        console2.log("Policy endDay  :", startDay + SAMPLE_DURATION - 1);
    }
}
