// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ProofOfReserve
 * @notice 오프체인 준비금을 온체인에서 검증하는 Chainlink PoR 시스템
 * @dev Hyperledger Besu 호환 (EVM 동일)
 *
 * 흐름:
 *   오프체인 수탁기관 → Oracle 노드 → submitReserve() → 온체인 검증
 */

// ─── Chainlink AggregatorV3 인터페이스 (로컬 Besu용 최소 구현) ───────────────
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

// ─── 메인 컨트랙트 ─────────────────────────────────────────────────────────────
contract ProofOfReserve {

    // ── 구조체 ──────────────────────────────────────────────────────────────────
    struct ReserveData {
        string  asset;          // 자산 심볼 (예: "BTC")
        uint256 reserveAmount;  // 실제 준비금 (USD, 8 decimals)
        uint256 issuedAmount;   // 토큰 발행량  (USD, 8 decimals)
        uint256 timestamp;      // 오라클 데이터 타임스탬프
        uint80  roundId;        // Chainlink 라운드 ID
        bool    verified;       // 검증 통과 여부
    }

    // ── 상태 변수 ────────────────────────────────────────────────────────────────
    address public owner;
    uint256 public constant HEARTBEAT_PERIOD = 24 hours; // 스테일 데이터 기준
    uint256 public constant MIN_RATIO_BPS    = 10_000;   // 100% (basis points)

    // asset symbol => 최신 준비금 데이터
    mapping(string => ReserveData) public reserves;

    // 승인된 오라클 제출자 (백엔드 노드 주소)
    mapping(address => bool) public authorizedOracles;

    // 등록된 자산 목록
    string[] public assetList;
    mapping(string => bool) private assetRegistered;

    // ── 이벤트 ───────────────────────────────────────────────────────────────────
    event ReserveSubmitted(
        string  indexed asset,
        uint256 reserveAmount,
        uint256 issuedAmount,
        uint256 ratio,          // basis points (10000 = 100%)
        bool    verified,
        uint80  roundId
    );

    event UnderCollateralized(
        string  indexed asset,
        uint256 reserveAmount,
        uint256 issuedAmount,
        uint256 ratio
    );

    event StaleData(
        string  indexed asset,
        uint256 dataTimestamp,
        uint256 currentTime
    );

    event OracleAuthChanged(address indexed oracle, bool authorized);

    // ── 수식어 ────────────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "PoR: not owner");
        _;
    }

    modifier onlyOracle() {
        require(authorizedOracles[msg.sender], "PoR: not authorized oracle");
        _;
    }

    // ── 생성자 ────────────────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        authorizedOracles[msg.sender] = true; // 배포자를 기본 오라클로 등록
    }

    // ── 관리자 함수 ───────────────────────────────────────────────────────────────

    /// @notice 오라클 노드 주소 등록/해제
    function setOracle(address oracle, bool authorized) external onlyOwner {
        authorizedOracles[oracle] = authorized;
        emit OracleAuthChanged(oracle, authorized);
    }

    /// @notice 자산 등록 (최초 1회)
    function registerAsset(string calldata asset) external onlyOwner {
        require(!assetRegistered[asset], "PoR: already registered");
        assetRegistered[asset] = true;
        assetList.push(asset);
    }

    // ── 핵심: 준비금 제출 & 검증 ──────────────────────────────────────────────────

    /**
     * @notice 오라클 백엔드가 오프체인 준비금 데이터를 제출
     * @param asset         자산 심볼
     * @param reserveAmount 준비금 (8 decimals)
     * @param issuedAmount  발행량  (8 decimals)
     * @param dataTimestamp 데이터 생성 시각 (unix)
     * @param roundId       라운드 ID
     */
    function submitReserve(
        string  calldata asset,
        uint256 reserveAmount,
        uint256 issuedAmount,
        uint256 dataTimestamp,
        uint80  roundId
    ) external onlyOracle {
        require(assetRegistered[asset],  "PoR: asset not registered");
        require(reserveAmount > 0,       "PoR: reserve must be > 0");
        require(issuedAmount  > 0,       "PoR: issued must be > 0");
        require(dataTimestamp <= block.timestamp, "PoR: future timestamp");

        // 1. 스테일 데이터 체크
        bool isStale = (block.timestamp - dataTimestamp) > HEARTBEAT_PERIOD;
        if (isStale) {
            emit StaleData(asset, dataTimestamp, block.timestamp);
        }

        // 2. 담보비율 계산 (basis points)
        uint256 ratioBps = (reserveAmount * 10_000) / issuedAmount;

        // 3. 검증 여부
        bool verified = !isStale && (ratioBps >= MIN_RATIO_BPS);

        // 4. 과소담보 이벤트
        if (ratioBps < MIN_RATIO_BPS) {
            emit UnderCollateralized(asset, reserveAmount, issuedAmount, ratioBps);
        }

        // 5. 상태 저장
        reserves[asset] = ReserveData({
            asset:         asset,
            reserveAmount: reserveAmount,
            issuedAmount:  issuedAmount,
            timestamp:     dataTimestamp,
            roundId:       roundId,
            verified:      verified
        });

        emit ReserveSubmitted(asset, reserveAmount, issuedAmount, ratioBps, verified, roundId);
    }

    // ── 조회 함수 ─────────────────────────────────────────────────────────────────

    /// @notice 특정 자산의 검증 상태 및 담보비율 반환
    function getReserveStatus(string calldata asset)
        external
        view
        returns (
            uint256 reserveAmount,
            uint256 issuedAmount,
            uint256 ratioBps,
            bool    verified,
            bool    isStale,
            uint256 lastUpdate
        )
    {
        ReserveData memory d = reserves[asset];
        require(d.timestamp > 0, "PoR: no data");

        ratioBps    = (d.reserveAmount * 10_000) / d.issuedAmount;
        isStale     = (block.timestamp - d.timestamp) > HEARTBEAT_PERIOD;
        reserveAmount = d.reserveAmount;
        issuedAmount  = d.issuedAmount;
        verified    = d.verified && !isStale;
        lastUpdate  = d.timestamp;
    }

    /// @notice 등록된 자산 전체 목록
    function getAssetList() external view returns (string[] memory) {
        return assetList;
    }

    /// @notice 시스템 전체 건강 상태 (모든 자산 verified 여부)
    function isSystemHealthy() external view returns (bool healthy, string memory failedAsset) {
        for (uint i = 0; i < assetList.length; i++) {
            ReserveData memory d = reserves[assetList[i]];
            bool stale = (block.timestamp - d.timestamp) > HEARTBEAT_PERIOD;
            uint256 ratio = d.issuedAmount > 0
                ? (d.reserveAmount * 10_000) / d.issuedAmount
                : 0;

            if (stale || ratio < MIN_RATIO_BPS) {
                return (false, assetList[i]);
            }
        }
        return (true, "");
    }
}
