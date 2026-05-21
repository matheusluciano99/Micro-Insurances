// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Test} from "forge-std/Test.sol";
import {WeatherOracle} from "../src/WeatherOracle.sol";
import {NasaRainfallConsumer} from "../src/NasaRainfallConsumer.sol";
import {FunctionsClient} from "chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {MockFunctionsRouter} from "./mocks/MockFunctionsRouter.sol";

contract NasaRainfallConsumerTest is Test {
    WeatherOracle oracle;
    MockFunctionsRouter router;
    NasaRainfallConsumer consumer;

    uint256 constant REGION = 7;
    uint256 constant DAY = 19737; // dia absoluto de exemplo
    string constant SRC = "return Functions.encodeUint256(0);"; // placeholder (DON mockada)

    function setUp() public {
        oracle = new WeatherOracle();
        router = new MockFunctionsRouter();
        consumer =
            new NasaRainfallConsumer(address(router), address(oracle), bytes32("don"), uint64(1), uint32(300000), SRC);
        // O consumer passa a ser o reporter on-chain (alimentado pela DON).
        oracle.setReporter(address(consumer), true);
    }

    function _request() internal returns (bytes32 id) {
        id = consumer.requestRainfall(REGION, DAY, "-9.389", "-40.502", "20240115");
    }

    function test_RequestThenFulfill_WritesRainfall() public {
        bytes32 id = _request();
        assertEq(id, router.lastRequestId());

        // DON devolve 1,50 mm -> 150 (mm*100).
        router.fulfill(address(consumer), id, abi.encode(uint256(150)), "");

        assertTrue(oracle.isReported(REGION, DAY));
        assertEq(oracle.getRainfall(REGION, DAY), 150);
    }

    function test_FulfillError_DoesNotReport() public {
        bytes32 id = _request();

        // JS falhou (ex.: dado faltante -999 -> throw): err preenchido.
        router.fulfill(address(consumer), id, "", bytes("rainfall unavailable"));

        assertFalse(oracle.isReported(REGION, DAY));
        assertEq(consumer.lastError(), bytes("rainfall unavailable"));
    }

    function test_OnlyRouterCanFulfill() public {
        bytes32 id = _request();
        vm.expectRevert(FunctionsClient.OnlyRouterCanFulfill.selector);
        consumer.handleOracleFulfillment(id, abi.encode(uint256(150)), "");
    }

    function test_RequestRainfall_OnlyOwner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert("Nasa: somente owner");
        consumer.requestRainfall(REGION, DAY, "-9.389", "-40.502", "20240115");
    }

    function test_UnknownRequest_Reverts() public {
        vm.expectRevert("Nasa: request desconhecido");
        router.fulfill(address(consumer), bytes32("inexistente"), abi.encode(uint256(1)), "");
    }

    function test_DoubleFulfill_Reverts() public {
        bytes32 id = _request();
        router.fulfill(address(consumer), id, abi.encode(uint256(150)), "");
        // segundo callback para o mesmo request: contexto já apagado.
        vm.expectRevert("Nasa: request desconhecido");
        router.fulfill(address(consumer), id, abi.encode(uint256(150)), "");
    }
}
