// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {WeatherOracle} from "../src/WeatherOracle.sol";
import {CropInsurance} from "../src/CropInsurance.sol";

/// @notice Roteiro narrado da demo (simulação, sem broadcast).
///         Mostra: contratação -> chuva normal não paga -> seca de N dias
///         consecutivos -> pagamento automático ao produtor.
///
/// Rodar:  forge script script/Demo.s.sol -vv
contract Demo is Script {
    uint256 constant REGION = 42;
    uint256 constant START_DAY = 200;
    uint256 constant DURATION = 10;
    uint256 constant DRY_SPELL = 3; // 3 dias secos consecutivos disparam
    uint256 constant THRESHOLD = 100; // 1,00 mm
    uint256 constant INSURED = 1_000e18;
    uint256 constant PREMIUM_BPS = 500; // 5%

    function _day(uint256 d) internal {
        vm.warp(d * 1 days);
    }

    function run() external {
        address farmer = makeAddr("produtor");
        address insurer = makeAddr("seguradora");

        MockStablecoin token = new MockStablecoin();
        WeatherOracle oracle = new WeatherOracle();
        CropInsurance insurance = new CropInsurance(address(token), address(oracle), PREMIUM_BPS);

        // Capital do pool (seguradora/cooperativa) e saldo do produtor.
        token.mint(insurer, 50_000e18);
        vm.startPrank(insurer);
        token.approve(address(insurance), type(uint256).max);
        insurance.fundPool(50_000e18);
        vm.stopPrank();
        token.mint(farmer, 100e18);

        console2.log("== Microsseguro de seca: demo ==");
        console2.log("Pool inicial            :", token.balanceOf(address(insurance)) / 1e18, "mBRL");

        // 1) Produtor contrata a apolice na safra.
        _day(START_DAY);
        vm.startPrank(farmer);
        token.approve(address(insurance), type(uint256).max);
        uint256 id = insurance.createPolicy(REGION, START_DAY, DURATION, DRY_SPELL, THRESHOLD, INSURED);
        vm.stopPrank();
        console2.log("Apolice criada (id)     :", id);
        console2.log("Premio pago pelo produtor:", (100e18 - token.balanceOf(farmer)) / 1e18, "mBRL");
        console2.log("Saldo do produtor        :", token.balanceOf(farmer) / 1e18, "mBRL");

        // 2) Choveu bem nos primeiros dias -> sinistro nao e elegivel.
        oracle.reportRainfall(REGION, START_DAY, 800);
        oracle.reportRainfall(REGION, START_DAY + 1, 650);
        _day(START_DAY + 1);
        try insurance.claim(id) {
            console2.log("ERRO: nao deveria ter pago");
        } catch {
            console2.log("Choveu bem -> claim revertido (correto)");
        }

        // 3) Comeca a seca: 3 dias consecutivos sem chuva.
        oracle.reportRainfall(REGION, START_DAY + 2, 0);
        oracle.reportRainfall(REGION, START_DAY + 3, 50);
        oracle.reportRainfall(REGION, START_DAY + 4, 0); // 3o dia seco consecutivo
        _day(START_DAY + 4);

        uint256 before = token.balanceOf(farmer);
        uint256 triggerDay = insurance.claim(id); // permissionless
        console2.log("Seca detectada no dia    :", triggerDay);
        console2.log("Indenizacao paga         :", (token.balanceOf(farmer) - before) / 1e18, "mBRL");
        console2.log("Saldo final do produtor  :", token.balanceOf(farmer) / 1e18, "mBRL");
        console2.log("Pool final               :", token.balanceOf(address(insurance)) / 1e18, "mBRL");
        console2.log("== Fim da demo ==");
    }
}
