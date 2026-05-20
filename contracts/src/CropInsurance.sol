// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWeatherOracle {
    function getRainfall(uint256 regionId, uint256 day) external view returns (uint256);
    function isReported(uint256 regionId, uint256 day) external view returns (bool);
}

/// @title CropInsurance
/// @notice Microsseguro paramétrico de seca para pequenos produtores.
///         Apólice sazonal de prazo fixo, prêmio pago na contratação.
///         Gatilho: N dias secos consecutivos (chuva diária <= limiar) dentro
///         da janela da apólice => pagamento automático, sem perito e sem
///         aprovador (qualquer um pode acionar; o pagamento vai sempre para o
///         segurado — isso impede calote silencioso).
///
/// @dev Numeração de dias: dia absoluto = block.timestamp / 1 days. A janela
///      da apólice é [startDay, endDay]. O oráculo é consultado por (região, dia).
contract CropInsurance {
    IERC20 public immutable token;
    IWeatherOracle public immutable oracle;
    address public owner;

    /// @notice Denominador de basis points (100% = 10_000 bps).
    uint256 public constant BPS_DENOMINATOR = 1e4;

    /// @notice Prêmio = insuredAmount * premiumBps / BPS_DENOMINATOR.
    uint256 public premiumBps;

    /// @notice Duração máxima de uma apólice (em dias). Limita o tamanho do
    ///         laço em `_findDrought`, evitando estouro de gas / griefing.
    uint256 public constant MAX_DURATION_DAYS = 366;

    /// @notice Capital comprometido com apólices ativas ainda não pagas.
    uint256 public totalReserved;

    struct Policy {
        address holder;
        uint256 regionId;
        uint256 startDay;
        uint256 endDay;
        uint256 drySpellDays; // N dias secos consecutivos
        uint256 rainThresholdMm100; // limiar de "dia seco", em mm*100
        uint256 insuredAmount; // valor pago em caso de seca
        bool paid;
        bool reserveReleased;
    }

    Policy[] public policies;

    /// @notice Apólices por dono (para a UI listar "minhas apólices").
    mapping(address => uint256[]) private _holderPolicies;

    enum PolicyStatus {
        Active, // janela aberta, sem seca acionável
        Claimable, // seca detectada, pode acionar claim
        Paid, // indenização já paga
        Expired // janela fechou sem seca
    }

    /// @notice Visão rica de uma apólice, pronta para a UI (campos derivados).
    struct PolicyView {
        uint256 id;
        address holder;
        uint256 regionId;
        uint256 startDay;
        uint256 endDay;
        uint256 drySpellDays;
        uint256 rainThresholdMm100;
        uint256 insuredAmount;
        uint256 premium;
        bool paid;
        bool reserveReleased;
        PolicyStatus status;
        bool claimable;
        uint256 triggerDay; // dia que disparou (0 se não disparou)
        uint256 maxStreak; // maior sequência seca até hoje (para barra de progresso)
        uint256 daysElapsed; // dias decorridos da janela
        uint256 daysRemaining; // dias restantes da janela
    }

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed holder,
        uint256 regionId,
        uint256 startDay,
        uint256 endDay,
        uint256 drySpellDays,
        uint256 rainThresholdMm100,
        uint256 insuredAmount,
        uint256 premium
    );
    event CapitalFunded(address indexed from, uint256 indexed amount);
    event ClaimPaid(uint256 indexed policyId, address indexed holder, uint256 amount, uint256 indexed triggerDay);
    event PolicyExpired(uint256 indexed policyId);
    event CapitalWithdrawn(address indexed to, uint256 indexed amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Crop: somente owner");
        _;
    }

    constructor(address token_, address oracle_, uint256 premiumBps_) {
        require(token_ != address(0) && oracle_ != address(0), "Crop: endereco zero");
        require(premiumBps_ > 0 && premiumBps_ <= BPS_DENOMINATOR, "Crop: premiumBps invalido");
        token = IERC20(token_);
        oracle = IWeatherOracle(oracle_);
        premiumBps = premiumBps_;
        owner = msg.sender;
    }

    /// @notice Dia absoluto atual.
    function currentDay() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /// @notice Capital livre = saldo do pool - capital reservado por apólices.
    function freeCapital() public view returns (uint256) {
        return token.balanceOf(address(this)) - totalReserved;
    }

    /// @notice Aporta capital no pool para lastrear indenizações.
    function fundPool(uint256 amount) external {
        require(amount > 0, "Crop: amount zero");
        _safeTransferFrom(msg.sender, address(this), amount);
        emit CapitalFunded(msg.sender, amount);
    }

    /// @notice Owner saca capital livre (não compromete reservas de apólices ativas).
    function withdrawCapital(uint256 amount) external onlyOwner {
        require(amount <= freeCapital(), "Crop: excede capital livre");
        _safeTransfer(msg.sender, amount);
        emit CapitalWithdrawn(msg.sender, amount);
    }

    function premiumOf(uint256 insuredAmount) public view returns (uint256) {
        return (insuredAmount * premiumBps) / BPS_DENOMINATOR;
    }

    /// @notice Contrata uma apólice sazonal e paga o prêmio na hora.
    function createPolicy(
        uint256 regionId,
        uint256 startDay,
        uint256 durationDays,
        uint256 drySpellDays,
        uint256 rainThresholdMm100,
        uint256 insuredAmount
    ) external returns (uint256 policyId) {
        require(durationDays > 0, "Crop: duracao zero");
        require(durationDays <= MAX_DURATION_DAYS, "Crop: duracao excede maximo");
        require(drySpellDays > 0 && drySpellDays <= durationDays, "Crop: drySpell invalido");
        require(insuredAmount > 0, "Crop: insured zero");
        require(startDay >= currentDay(), "Crop: nao segura o passado");

        uint256 premium = premiumOf(insuredAmount);
        require(premium > 0, "Crop: premio zero");

        // Prêmio entra no pool (aumenta o capital).
        _safeTransferFrom(msg.sender, address(this), premium);

        // Solvência: o capital livre tem que cobrir a nova indenização.
        require(freeCapital() >= insuredAmount, "Crop: pool insolvente");

        uint256 endDay = startDay + durationDays - 1;
        policies.push(
            Policy({
                holder: msg.sender,
                regionId: regionId,
                startDay: startDay,
                endDay: endDay,
                drySpellDays: drySpellDays,
                rainThresholdMm100: rainThresholdMm100,
                insuredAmount: insuredAmount,
                paid: false,
                reserveReleased: false
            })
        );
        policyId = policies.length - 1;
        _holderPolicies[msg.sender].push(policyId);
        totalReserved += insuredAmount;

        emit PolicyCreated(
            policyId, msg.sender, regionId, startDay, endDay, drySpellDays, rainThresholdMm100, insuredAmount, premium
        );
    }

    /// @notice Procura N dias secos consecutivos (reportados e já passados)
    ///         dentro da janela da apólice.
    /// @return triggered se houve seca elegível
    /// @return triggerDay primeiro dia em que a sequência atingiu N (0 se não)
    /// @return maxStreak maior sequência seca consecutiva até hoje na janela
    function _scan(Policy storage p) internal view returns (bool triggered, uint256 triggerDay, uint256 maxStreak) {
        uint256 streak;
        uint256 today = currentDay();

        for (uint256 day = p.startDay; day <= p.endDay; day++) {
            // Só conta dias que já passaram e foram reportados pelo oráculo.
            if (day > today || !oracle.isReported(p.regionId, day)) {
                streak = 0;
                continue;
            }
            if (oracle.getRainfall(p.regionId, day) <= p.rainThresholdMm100) {
                streak++;
                if (streak > maxStreak) {
                    maxStreak = streak;
                }
                if (!triggered && streak >= p.drySpellDays) {
                    triggered = true;
                    triggerDay = day;
                }
            } else {
                streak = 0;
            }
        }
    }

    /// @notice Verifica se houve N dias secos consecutivos na janela e, se sim,
    ///         paga a indenização ao segurado. Permissionless de propósito.
    ///         Funciona mesmo após o fim da janela: a seca, uma vez ocorrida e
    ///         reportada, permanece acionável (ninguém consegue travar o
    ///         pagamento de um sinistro legítimo).
    /// @return triggerDay o último dia da sequência seca que disparou o pagamento.
    function claim(uint256 policyId) external returns (uint256 triggerDay) {
        Policy storage p = policies[policyId];
        require(!p.paid, "Crop: ja pago");

        bool triggered;
        (triggered, triggerDay,) = _scan(p);
        require(triggered, "Crop: sem seca elegivel");

        p.paid = true;
        // Só libera a reserva uma vez (expirePolicy nunca libera uma apólice
        // com seca acionável, mas o guard evita underflow em qualquer caso).
        if (!p.reserveReleased) {
            p.reserveReleased = true;
            totalReserved -= p.insuredAmount;
        }

        _safeTransfer(p.holder, p.insuredAmount);
        emit ClaimPaid(policyId, p.holder, p.insuredAmount, triggerDay);
    }

    /// @notice Após a janela encerrar **sem seca**, libera o capital reservado
    ///         de volta para o pool. Reverte se a apólice tem seca acionável —
    ///         nesse caso só `claim` pode ser usado, garantindo que o segurado
    ///         nunca perca a indenização por demora.
    function expirePolicy(uint256 policyId) external {
        Policy storage p = policies[policyId];
        require(!p.paid, "Crop: foi pago");
        require(!p.reserveReleased, "Crop: ja liberado");
        require(currentDay() > p.endDay, "Crop: janela aberta");

        (bool triggered,,) = _scan(p);
        require(!triggered, "Crop: tem seca, use claim");

        p.reserveReleased = true;
        totalReserved -= p.insuredAmount;
        emit PolicyExpired(policyId);
    }

    function policiesCount() external view returns (uint256) {
        return policies.length;
    }

    // --- Leituras para a UI --------------------------------------------------

    function _windowProgress(Policy storage p) internal view returns (uint256 daysElapsed, uint256 daysRemaining) {
        uint256 today = currentDay();
        uint256 duration = p.endDay - p.startDay + 1;
        if (today < p.startDay) {
            return (0, duration);
        }
        if (today >= p.endDay) {
            return (duration, 0);
        }
        daysElapsed = today - p.startDay + 1;
        daysRemaining = p.endDay - today;
    }

    function _statusOf(Policy storage p)
        internal
        view
        returns (PolicyStatus status, bool claimable, uint256 triggerDay, uint256 maxStreak)
    {
        bool triggered;
        (triggered, triggerDay, maxStreak) = _scan(p);
        if (p.paid) {
            status = PolicyStatus.Paid;
        } else if (triggered) {
            status = PolicyStatus.Claimable;
            claimable = true;
        } else if (currentDay() > p.endDay) {
            status = PolicyStatus.Expired;
        } else {
            status = PolicyStatus.Active;
        }
    }

    /// @notice Visão completa de uma apólice, com campos derivados para a UI.
    function getPolicy(uint256 policyId) public view returns (PolicyView memory v) {
        require(policyId < policies.length, "Crop: policy inexistente");
        Policy storage p = policies[policyId];
        (PolicyStatus status, bool claimable, uint256 triggerDay, uint256 maxStreak) = _statusOf(p);
        (uint256 daysElapsed, uint256 daysRemaining) = _windowProgress(p);

        v = PolicyView({
            id: policyId,
            holder: p.holder,
            regionId: p.regionId,
            startDay: p.startDay,
            endDay: p.endDay,
            drySpellDays: p.drySpellDays,
            rainThresholdMm100: p.rainThresholdMm100,
            insuredAmount: p.insuredAmount,
            premium: premiumOf(p.insuredAmount),
            paid: p.paid,
            reserveReleased: p.reserveReleased,
            status: status,
            claimable: claimable,
            triggerDay: triggerDay,
            maxStreak: maxStreak,
            daysElapsed: daysElapsed,
            daysRemaining: daysRemaining
        });
    }

    function getPolicyStatus(uint256 policyId) external view returns (PolicyStatus) {
        require(policyId < policies.length, "Crop: policy inexistente");
        (PolicyStatus status,,,) = _statusOf(policies[policyId]);
        return status;
    }

    /// @notice A UI usa isto para habilitar/desabilitar o botão "Acionar"
    ///         sem precisar enviar transação.
    function previewClaim(uint256 policyId) external view returns (bool claimable, uint256 triggerDay) {
        require(policyId < policies.length, "Crop: policy inexistente");
        (, claimable, triggerDay,) = _statusOf(policies[policyId]);
    }

    function holderPolicyCount(address holder) external view returns (uint256) {
        return _holderPolicies[holder].length;
    }

    /// @notice IDs das apólices de um produtor (para listar "minhas apólices").
    function getPolicyIdsByHolder(address holder) external view returns (uint256[] memory) {
        return _holderPolicies[holder];
    }

    /// @notice Apólices de um produtor já como visão rica, prontas para a UI.
    function getPoliciesByHolder(address holder) external view returns (PolicyView[] memory list) {
        uint256[] storage ids = _holderPolicies[holder];
        list = new PolicyView[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            list[i] = getPolicy(ids[i]);
        }
    }

    /// @notice Listagem paginada de todas as apólices (para painel admin).
    function getPolicies(uint256 offset, uint256 limit) external view returns (PolicyView[] memory page) {
        uint256 total = policies.length;
        if (offset >= total) {
            return new PolicyView[](0);
        }
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        page = new PolicyView[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = getPolicy(i);
        }
    }

    function poolBalance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Estatísticas do pool num único call (para o dashboard).
    function poolStats() external view returns (uint256 balance, uint256 reserved, uint256 free) {
        balance = poolBalance();
        reserved = totalReserved;
        free = balance - reserved;
    }

    /// @notice Série diária de chuva na janela da apólice (para gráficos).
    /// @return dayList    dias absolutos da janela
    /// @return rainMm100  chuva por dia em mm*100 (0 se ainda não reportado)
    /// @return reported   se o dia já foi reportado pelo oráculo
    function getRainfallWindow(uint256 policyId)
        external
        view
        returns (uint256[] memory dayList, uint256[] memory rainMm100, bool[] memory reported)
    {
        require(policyId < policies.length, "Crop: policy inexistente");
        Policy storage p = policies[policyId];
        uint256 len = p.endDay - p.startDay + 1;
        dayList = new uint256[](len);
        rainMm100 = new uint256[](len);
        reported = new bool[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 d = p.startDay + i;
            dayList[i] = d;
            bool isRep = oracle.isReported(p.regionId, d);
            reported[i] = isRep;
            rainMm100[i] = isRep ? oracle.getRainfall(p.regionId, d) : 0;
        }
    }

    // --- ERC20 seguro (sem dependência externa) ------------------------------
    // Trata tokens não-conformes que não retornam bool (ex.: USDT-like):
    // aceita sucesso se a chamada não reverteu e (sem retorno OU retorno true).

    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "Crop: transfer falhou");
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(token).call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "Crop: transferFrom falhou");
    }
}
