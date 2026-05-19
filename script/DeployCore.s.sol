// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Script, console2} from "forge-std/Script.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {CropInsurance} from "../src/CropInsurance.sol";

/// @notice Deploy do NÚCLEO (MockStablecoin + CropInsurance) reusando o
///         WeatherOracle já deployado/verificado na Sepolia, sem mexer no
///         NasaRainfallConsumer nem na subscription Chainlink.
///
/// Lê o oráculo de `WEATHER_ORACLE` no .env (default = o já deployado).
///
/// Uso (via justfile recipe `deploy-core`, ou direto):
///   forge script script/DeployCore.s.sol:DeployCore \
///     --account default --rpc-url $SEPOLIA_RPC_URL --broadcast --verify \
///     --etherscan-api-key $ETHERSCAN_API_KEY
contract DeployCore is Script {
    // WeatherOracle já deployado na Sepolia (sobrescrevível via env).
    address constant DEFAULT_WEATHER_ORACLE = 0x9b3ccC0007e6a2A6AeEbc2bf84df1A01b2723c05;

    // Carteira que faz o broadcast (keystore `default`). Precisa ser explícita:
    // com `--account` sem `--sender`, o `msg.sender` do script é o DefaultSender
    // do forge, não a carteira do keystore. O mint/approve/fund têm que casar
    // com quem assina o broadcast. Sobrescrevível com DEPLOYER no .env.
    address constant DEFAULT_DEPLOYER = 0x2DC84E68b2F0fd9fAA684FcC94d66AAbD4AeF8a2;

    uint256 constant PREMIUM_BPS = 500; // 5%
    uint256 constant POOL_CAPITAL = 100_000e18; // capital inicial do pool

    function run() external {
        address weatherOracle = vm.envOr("WEATHER_ORACLE", DEFAULT_WEATHER_ORACLE);
        address deployer = vm.envOr("DEPLOYER", DEFAULT_DEPLOYER);

        vm.startBroadcast();

        MockStablecoin token = new MockStablecoin();
        CropInsurance insurance = new CropInsurance(address(token), weatherOracle, PREMIUM_BPS);

        // Financia o pool para que apólices possam ser contratadas de imediato.
        // mint vai para o deployer (= quem assina o broadcast), e approve/
        // fundPool rodam como esse mesmo endereço on-chain.
        token.mint(deployer, POOL_CAPITAL);
        token.approve(address(insurance), POOL_CAPITAL);
        insurance.fundPool(POOL_CAPITAL);

        vm.stopBroadcast();

        console2.log("MockStablecoin :", address(token));
        console2.log("CropInsurance  :", address(insurance));
        console2.log("WeatherOracle  :", weatherOracle, "(reusado)");
        console2.log("Deployer/pool  :", deployer);
        console2.log("Pool capital   :", POOL_CAPITAL);
        console2.log("Premium bps    :", PREMIUM_BPS);
    }
}
