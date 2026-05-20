// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {WeatherOracle} from "../src/WeatherOracle.sol";
import {CropInsurance} from "../src/CropInsurance.sol";

contract CropInsuranceTest is Test {
    MockStablecoin token;
    WeatherOracle oracle;
    CropInsurance insurance;

    address farmer = address(0xF00D);
    address keeper = address(0xBEEF); // qualquer um pode acionar o claim

    uint256 constant REGION = 1;
    uint256 constant START_DAY = 100;
    uint256 constant DURATION = 10; // janela [100, 109]
    uint256 constant DRY_SPELL = 3; // N dias secos consecutivos
    uint256 constant THRESHOLD = 100; // 1,00 mm (mm*100)
    uint256 constant INSURED = 1000e18;
    uint256 constant PREMIUM_BPS = 500; // 5%

    function setUp() public {
        token = new MockStablecoin();
        oracle = new WeatherOracle(); // este contrato é owner/reporter
        insurance = new CropInsurance(address(token), address(oracle), PREMIUM_BPS);

        // Capital do pool e prêmio do produtor.
        token.mint(address(this), 100_000e18);
        token.approve(address(insurance), type(uint256).max);
        insurance.fundPool(5_000e18);

        token.mint(farmer, 1_000e18);
        vm.prank(farmer);
        token.approve(address(insurance), type(uint256).max);

        _warpToDay(START_DAY);
    }

    function _warpToDay(uint256 day) internal {
        vm.warp(day * 1 days);
    }

    function _newPolicy() internal returns (uint256) {
        vm.prank(farmer);
        return insurance.createPolicy(REGION, START_DAY, DURATION, DRY_SPELL, THRESHOLD, INSURED);
    }

    function _report(uint256 day, uint256 mm100) internal {
        oracle.reportRainfall(REGION, day, mm100);
    }

    // --- Contratação ---------------------------------------------------------

    function test_CreatePolicy_PullsPremium_AndReserves() public {
        uint256 id = _newPolicy();
        assertEq(id, 0);
        assertEq(insurance.totalReserved(), INSURED);
        // prêmio = 5% de 1000 = 50
        assertEq(token.balanceOf(farmer), 1_000e18 - 50e18);
    }

    function test_CreatePolicy_RevertsWhenPoolInsolvent() public {
        // Pool novo sem aporte: só o prêmio não cobre a indenização.
        CropInsurance fresh = new CropInsurance(address(token), address(oracle), PREMIUM_BPS);
        vm.prank(farmer);
        token.approve(address(fresh), type(uint256).max);

        vm.prank(farmer);
        vm.expectRevert("Crop: pool insolvente");
        fresh.createPolicy(REGION, START_DAY, DURATION, DRY_SPELL, THRESHOLD, INSURED);
    }

    function test_CreatePolicy_RevertsWhenDurationTooLong() public {
        uint256 tooLong = insurance.MAX_DURATION_DAYS() + 1;
        vm.prank(farmer);
        vm.expectRevert("Crop: duracao excede maximo");
        insurance.createPolicy(REGION, START_DAY, tooLong, DRY_SPELL, THRESHOLD, INSURED);
    }

    function test_CreatePolicy_AllowsMaxDuration() public {
        uint256 maxDur = insurance.MAX_DURATION_DAYS();
        vm.prank(farmer);
        uint256 id = insurance.createPolicy(REGION, START_DAY, maxDur, DRY_SPELL, THRESHOLD, INSURED);
        assertEq(id, 0);
    }

    function test_CreatePolicy_RevertsInsuringThePast() public {
        _warpToDay(START_DAY + 5);
        vm.prank(farmer);
        vm.expectRevert("Crop: nao segura o passado");
        insurance.createPolicy(REGION, START_DAY, DURATION, DRY_SPELL, THRESHOLD, INSURED);
    }

    // --- Sinistro ------------------------------------------------------------

    function test_NoDrought_ClaimReverts() public {
        uint256 id = _newPolicy();
        for (uint256 d = START_DAY; d <= START_DAY + DURATION - 1; d++) {
            _report(d, 500); // chove bem todos os dias
        }
        _warpToDay(START_DAY + DURATION);
        vm.expectRevert("Crop: sem seca elegivel");
        insurance.claim(id);
    }

    function test_ConsecutiveDryDays_PaysAutomatically() public {
        uint256 id = _newPolicy();
        _report(START_DAY, 0);
        _report(START_DAY + 1, 50);
        _report(START_DAY + 2, 100); // <= limiar conta como dia seco
        _warpToDay(START_DAY + 2);

        uint256 before = token.balanceOf(farmer);
        // Permissionless: um terceiro aciona, mas o segurado recebe.
        vm.prank(keeper);
        uint256 triggerDay = insurance.claim(id);

        assertEq(triggerDay, START_DAY + 2);
        assertEq(token.balanceOf(farmer), before + INSURED);
        assertEq(insurance.totalReserved(), 0);
    }

    function test_InterruptedDrySpell_DoesNotTrigger() public {
        uint256 id = _newPolicy();
        // padrão seco-seco-chuva nunca atinge 3 consecutivos
        for (uint256 d = START_DAY; d <= START_DAY + DURATION - 1; d++) {
            _report(d, (d % 3 == 2) ? 500 : 0);
        }
        _warpToDay(START_DAY + DURATION);
        vm.expectRevert("Crop: sem seca elegivel");
        insurance.claim(id);
    }

    function test_UnreportedDay_BreaksStreak() public {
        uint256 id = _newPolicy();
        _report(START_DAY, 0);
        _report(START_DAY + 1, 0);
        // START_DAY+2 fica sem reporte -> quebra a sequência
        _report(START_DAY + 3, 0);
        _report(START_DAY + 4, 0);
        _warpToDay(START_DAY + 5);
        vm.expectRevert("Crop: sem seca elegivel");
        insurance.claim(id);
    }

    function test_DroughtAfterInterruption_StillPays() public {
        uint256 id = _newPolicy();
        _report(START_DAY, 0);
        _report(START_DAY + 1, 999); // chuva quebra
        _report(START_DAY + 2, 0);
        _report(START_DAY + 3, 0);
        _report(START_DAY + 4, 0); // 3 secos consecutivos aqui
        _warpToDay(START_DAY + 4);

        vm.prank(keeper);
        uint256 triggerDay = insurance.claim(id);
        assertEq(triggerDay, START_DAY + 4);
        assertEq(token.balanceOf(farmer), 1_000e18 - 50e18 + INSURED);
    }

    function test_DoubleClaim_Reverts() public {
        uint256 id = _newPolicy();
        _report(START_DAY, 0);
        _report(START_DAY + 1, 0);
        _report(START_DAY + 2, 0);
        _warpToDay(START_DAY + 2);

        insurance.claim(id);
        vm.expectRevert("Crop: ja pago");
        insurance.claim(id);
    }

    function test_FutureDaysNotCounted() public {
        uint256 id = _newPolicy();
        // Reporta dias secos mas ainda não "chegou" o tempo deles.
        _report(START_DAY, 0);
        _report(START_DAY + 1, 0);
        _report(START_DAY + 2, 0);
        // hoje ainda é START_DAY: dias futuros não contam.
        vm.expectRevert("Crop: sem seca elegivel");
        insurance.claim(id);
    }

    // --- Expiração / capital -------------------------------------------------

    function test_ExpirePolicy_ReleasesReserve() public {
        uint256 id = _newPolicy();
        for (uint256 d = START_DAY; d <= START_DAY + DURATION - 1; d++) {
            _report(d, 500);
        }
        assertEq(insurance.totalReserved(), INSURED);
        _warpToDay(START_DAY + DURATION + 1); // > endDay
        insurance.expirePolicy(id);
        assertEq(insurance.totalReserved(), 0);
    }

    function test_ExpirePolicy_RevertsWhenDroughtClaimable() public {
        // Seca aconteceu mas ninguém acionou antes da janela fechar.
        uint256 id = _newPolicy();
        _report(START_DAY, 0);
        _report(START_DAY + 1, 0);
        _report(START_DAY + 2, 0);
        _warpToDay(START_DAY + DURATION + 1); // janela fechada

        // Ninguém consegue "expirar" e travar o pagamento do segurado.
        vm.prank(keeper);
        vm.expectRevert("Crop: tem seca, use claim");
        insurance.expirePolicy(id);

        // O segurado ainda recebe, mesmo acionando atrasado.
        uint256 before = token.balanceOf(farmer);
        insurance.claim(id);
        assertEq(token.balanceOf(farmer), before + INSURED);
        assertEq(insurance.totalReserved(), 0);
    }

    function test_LateClaim_AfterWindow_StillPays() public {
        uint256 id = _newPolicy();
        _report(START_DAY, 0);
        _report(START_DAY + 1, 0);
        _report(START_DAY + 2, 0);
        // Aciona só bem depois do fim da janela.
        _warpToDay(START_DAY + DURATION + 50);

        uint256 triggerDay = insurance.claim(id);
        assertEq(triggerDay, START_DAY + 2);
        assertEq(token.balanceOf(farmer), 1_000e18 - 50e18 + INSURED);
        assertEq(insurance.totalReserved(), 0);
    }

    function test_ExpirePolicy_RevertsWhileWindowOpen() public {
        uint256 id = _newPolicy();
        _warpToDay(START_DAY + DURATION - 1); // ainda dentro da janela
        vm.expectRevert("Crop: janela aberta");
        insurance.expirePolicy(id);
    }

    function test_WithdrawCapital_OnlyFreeCapital() public {
        _newPolicy(); // reserva INSURED (1000) + prêmio 50 entrou no pool
        uint256 free = insurance.freeCapital();
        // pool = 5000 + 50 prêmio; reservado = 1000 => livre = 4050
        assertEq(free, 5_000e18 + 50e18 - INSURED);

        vm.expectRevert("Crop: excede capital livre");
        insurance.withdrawCapital(free + 1);

        insurance.withdrawCapital(free);
        assertEq(insurance.freeCapital(), 0);
    }

    function test_WithdrawCapital_OnlyOwner() public {
        vm.prank(farmer);
        vm.expectRevert("Crop: somente owner");
        insurance.withdrawCapital(1);
    }

    // --- Leituras de UI ------------------------------------------------------

    function test_GetPolicy_DerivedFields() public {
        uint256 id = _newPolicy();
        CropInsurance.PolicyView memory v = insurance.getPolicy(id);

        assertEq(v.id, id);
        assertEq(v.holder, farmer);
        assertEq(v.insuredAmount, INSURED);
        assertEq(v.premium, 50e18);
        assertEq(uint256(v.status), uint256(CropInsurance.PolicyStatus.Active));
        assertFalse(v.claimable);
        assertEq(v.daysElapsed, 1);
        assertEq(v.daysRemaining, DURATION - 1);
    }

    function test_StatusTransitions_ActiveClaimablePaid() public {
        uint256 id = _newPolicy();
        assertEq(uint256(insurance.getPolicyStatus(id)), uint256(CropInsurance.PolicyStatus.Active));

        _report(START_DAY, 0);
        _report(START_DAY + 1, 0);
        _report(START_DAY + 2, 0);
        _warpToDay(START_DAY + 2);

        (bool claimable, uint256 triggerDay) = insurance.previewClaim(id);
        assertTrue(claimable);
        assertEq(triggerDay, START_DAY + 2);
        assertEq(uint256(insurance.getPolicyStatus(id)), uint256(CropInsurance.PolicyStatus.Claimable));

        insurance.claim(id);
        assertEq(uint256(insurance.getPolicyStatus(id)), uint256(CropInsurance.PolicyStatus.Paid));
    }

    function test_Status_Expired() public {
        uint256 id = _newPolicy();
        for (uint256 d = START_DAY; d <= START_DAY + DURATION - 1; d++) {
            _report(d, 500);
        }
        _warpToDay(START_DAY + DURATION + 1);
        assertEq(uint256(insurance.getPolicyStatus(id)), uint256(CropInsurance.PolicyStatus.Expired));
    }

    function test_MaxStreak_ProgressIndicator() public {
        uint256 id = _newPolicy();
        _report(START_DAY, 0);
        _report(START_DAY + 1, 0); // 2 dias secos, N=3 ainda não dispara
        _warpToDay(START_DAY + 1);

        CropInsurance.PolicyView memory v = insurance.getPolicy(id);
        assertEq(v.maxStreak, 2);
        assertEq(uint256(v.status), uint256(CropInsurance.PolicyStatus.Active));
    }

    function test_GetPoliciesByHolder() public {
        uint256 id0 = _newPolicy();
        uint256 id1 = _newPolicy();
        assertEq(insurance.holderPolicyCount(farmer), 2);

        uint256[] memory ids = insurance.getPolicyIdsByHolder(farmer);
        assertEq(ids[0], id0);
        assertEq(ids[1], id1);

        CropInsurance.PolicyView[] memory list = insurance.getPoliciesByHolder(farmer);
        assertEq(list.length, 2);
        assertEq(list[1].id, id1);
    }

    function test_GetPolicies_Pagination() public {
        _newPolicy();
        _newPolicy();
        _newPolicy();

        CropInsurance.PolicyView[] memory page = insurance.getPolicies(1, 2);
        assertEq(page.length, 2);
        assertEq(page[0].id, 1);
        assertEq(page[1].id, 2);

        CropInsurance.PolicyView[] memory empty = insurance.getPolicies(10, 5);
        assertEq(empty.length, 0);
    }

    function test_PoolStats() public {
        _newPolicy();
        (uint256 balance, uint256 reserved, uint256 free) = insurance.poolStats();
        assertEq(balance, 5_000e18 + 50e18);
        assertEq(reserved, INSURED);
        assertEq(free, balance - reserved);
    }

    function test_GetRainfallWindow() public {
        uint256 id = _newPolicy();
        _report(START_DAY, 250);
        _report(START_DAY + 2, 0);

        (uint256[] memory dayList, uint256[] memory rain, bool[] memory reported) = insurance.getRainfallWindow(id);

        assertEq(dayList.length, DURATION);
        assertEq(dayList[0], START_DAY);
        assertTrue(reported[0]);
        assertEq(rain[0], 250);
        assertFalse(reported[1]); // não reportado
        assertEq(rain[1], 0);
        assertTrue(reported[2]);
        assertEq(rain[2], 0);
    }

    function test_GetPolicy_RevertsForInvalidId() public {
        vm.expectRevert("Crop: policy inexistente");
        insurance.getPolicy(999);
    }
}
