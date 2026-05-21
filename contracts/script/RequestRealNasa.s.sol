// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Script, console2} from "forge-std/Script.sol";

interface INasaConsumer {
    function requestRainfall(
        uint256 regionId,
        uint256 day,
        string calldata lat,
        string calldata lon,
        string calldata dateYYYYMMDD
    ) external returns (bytes32);
}

/// @notice Dispara em UM broadcast `requestRainfall` para os últimos N dias da
///         NASA POWER já disponíveis (latência da NASA: ~3-5 dias) via Chainlink
///         Functions. Cada dia = 1 request da subscription (custa LINK), e a
///         DON entrega o callback em ~1-3 min depois.
///
///         Defaults: região 1 (Nordeste / Petrolina-PE), 5 dias começando
///         hoje-7 (NASA tem) indo até hoje-3. Override via env: CONSUMER,
///         REGION, LAT, LON, OFFSET, N_DAYS.
contract RequestRealNasa is Script {
    address constant DEFAULT_CONSUMER = 0xcd36E43CEB04986358A5bbC6883492061AD6a9bF;
    uint256 constant DEFAULT_REGION = 1;
    string constant DEFAULT_LAT = "-9.389";
    string constant DEFAULT_LON = "-40.502";
    uint256 constant DEFAULT_OFFSET = 7;
    uint256 constant DEFAULT_N_DAYS = 5;

    function run() external {
        address consumer = vm.envOr("CONSUMER", DEFAULT_CONSUMER);
        uint256 region = vm.envOr("REGION", DEFAULT_REGION);
        string memory lat = vm.envOr("LAT", DEFAULT_LAT);
        string memory lon = vm.envOr("LON", DEFAULT_LON);
        uint256 offset = vm.envOr("OFFSET", DEFAULT_OFFSET);
        uint256 nDays = vm.envOr("N_DAYS", DEFAULT_N_DAYS);

        uint256 today = block.timestamp / 1 days;
        uint256 startDay = today - offset;

        console2.log("region    :", region);
        console2.log("from day  :", startDay, _ymd(startDay));
        console2.log("to day    :", startDay + nDays - 1, _ymd(startDay + nDays - 1));
        console2.log("n_days    :", nDays);

        vm.startBroadcast();
        for (uint256 i = 0; i < nDays; i++) {
            uint256 day = startDay + i;
            string memory date = _ymd(day);
            INasaConsumer(consumer).requestRainfall(region, day, lat, lon, date);
            console2.log(">> requested", date);
        }
        vm.stopBroadcast();

        console2.log(">> aguarde 1-3 min por dia para a DON entregar (callback)");
    }

    // ---- helpers: dia absoluto (epoch/86400) -> "YYYYMMDD" ------------------
    // Algoritmo civil_from_days (Howard Hinnant, proleptic Gregorian).
    function _ymd(uint256 day) internal pure returns (string memory) {
        uint256 z = day + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 d = doy - (153 * mp + 2) / 5 + 1;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) y += 1;
        return string(abi.encodePacked(_pad(y, 4), _pad(m, 2), _pad(d, 2)));
    }

    function _pad(uint256 v, uint256 width) internal pure returns (string memory) {
        bytes memory s = bytes(_itoa(v));
        if (s.length >= width) return string(s);
        bytes memory out = new bytes(width);
        uint256 zeros = width - s.length;
        for (uint256 i = 0; i < zeros; i++) out[i] = bytes1("0");
        for (uint256 i = 0; i < s.length; i++) out[zeros + i] = s[i];
        return string(out);
    }

    function _itoa(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 digits;
        uint256 t = v;
        while (t != 0) {
            digits++;
            t /= 10;
        }
        bytes memory buf = new bytes(digits);
        while (v != 0) {
            digits -= 1;
            buf[digits] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(buf);
    }
}
