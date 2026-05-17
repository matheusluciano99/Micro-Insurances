// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Script, console2} from "forge-std/Script.sol";
import {WeatherOracle} from "../src/WeatherOracle.sol";
import {NasaRainfallConsumer} from "../src/NasaRainfallConsumer.sol";

/// @notice Deploy do oráculo de chuva via Chainlink Functions (Sepolia).
///
/// Chainlink Functions NÃO roda em Anvil (não há DON). Use Sepolia:
///   1. Crie uma subscription em https://functions.chain.link e financie c/ LINK.
///   2. export SUBSCRIPTION_ID=<id>   (e PRIVATE_KEY do deployer)
///   3. forge script script/DeployFunctions.s.sol --rpc-url $SEPOLIA_RPC \
///        --private-key $PRIVATE_KEY --broadcast
///   4. No painel da subscription, adicione o NasaRainfallConsumer como consumer.
///
/// Depois, para reportar a chuva de um dia:
///   cast send <consumer> "requestRainfall(uint256,uint256,string,string,string)" \
///     <regionId> <day> "-9.389" "-40.502" "20240115" --rpc-url $SEPOLIA_RPC ...
contract DeployFunctions is Script {
    // Endereços públicos da Chainlink Functions na Sepolia.
    address constant SEPOLIA_ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    // donId "fun-ethereum-sepolia-1" em bytes32.
    bytes32 constant SEPOLIA_DON_ID = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;
    uint32 constant CALLBACK_GAS_LIMIT = 300_000;

    // JS executado pela DON: consulta a API oficial NASA POWER (PRECTOTCORR).
    // Dado faltante (-999) -> throw -> err no callback -> não reporta nada.
    string constant SOURCE = "const lat = args[0];\n" "const lon = args[1];\n" "const date = args[2];\n"
        "const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&start=${date}&end=${date}&format=JSON`;\n"
        "const r = await Functions.makeHttpRequest({ url: url });\n" "if (r.error) { throw Error('NASA request failed'); }\n"
        "const v = r.data.properties.parameter.PRECTOTCORR[date];\n"
        "if (v === undefined || v < 0) { throw Error('rainfall unavailable'); }\n"
        "return Functions.encodeUint256(Math.round(v * 100));";

    function run() external {
        uint64 subscriptionId = uint64(vm.envUint("SUBSCRIPTION_ID"));

        vm.startBroadcast();

        WeatherOracle oracle = new WeatherOracle();
        NasaRainfallConsumer consumer = new NasaRainfallConsumer(
            SEPOLIA_ROUTER, address(oracle), SEPOLIA_DON_ID, subscriptionId, CALLBACK_GAS_LIMIT, SOURCE
        );
        // O consumer (alimentado pela DON) vira o reporter on-chain.
        oracle.setReporter(address(consumer), true);

        vm.stopBroadcast();

        console2.log("WeatherOracle        :", address(oracle));
        console2.log("NasaRainfallConsumer :", address(consumer));
        console2.log("Router (Sepolia)     :", SEPOLIA_ROUTER);
        console2.log("Subscription ID      :", subscriptionId);
        console2.log(">> Adicione o consumer na subscription em functions.chain.link");
    }
}
