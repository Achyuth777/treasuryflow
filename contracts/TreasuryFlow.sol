// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Local demonstration token; not money, no public mint function.
contract MockUSD {
    string public constant name = "TreasuryFlow Mock USD";
    string public constant symbol = "mUSD";
    uint8 public constant decimals = 6;
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;
    event Transfer(address indexed from, address indexed to, uint256 value);
    constructor(uint256 supply) { balanceOf[msg.sender] = supply; totalSupply = supply; emit Transfer(address(0), msg.sender, supply); }
    function transfer(address to, uint256 value) external returns (bool) {
        require(to != address(0) && balanceOf[msg.sender] >= value, "Insufficient balance or invalid recipient");
        balanceOf[msg.sender] -= value; balanceOf[to] += value;
        emit Transfer(msg.sender, to, value); return true;
    }
}

/// @notice Immutable demo policy. Invoice text and personal data never go on chain.
contract TreasuryFlow {
    struct Payment { address creator; address recipient; uint256 amount; uint64 dueAt; uint8 approvals; bool rejected; bool executed; }
    MockUSD public immutable token;
    uint256 public immutable dailyLimit;
    uint256 public immutable dualApprovalThreshold;
    mapping(address => bool) public creators;
    mapping(address => bool) public approvers;
    mapping(address => bool) public recipients;
    mapping(bytes32 => Payment) public payments;
    mapping(bytes32 => mapping(address => bool)) public approvedBy;
    mapping(uint256 => uint256) public dailySpent;
    event Requested(bytes32 indexed paymentId, address indexed actor, address recipient, uint256 amount, uint64 dueAt);
    event Approved(bytes32 indexed paymentId, address indexed actor);
    event Rejected(bytes32 indexed paymentId, address indexed actor);
    event Executed(bytes32 indexed paymentId, address indexed actor, address recipient, uint256 amount);
    constructor(address token_, address creator, address[] memory managers, address[] memory suppliers, uint256 limit, uint256 threshold) {
        require(token_ != address(0) && creator != address(0) && limit > 0 && threshold > 0, "Invalid configuration");
        token = MockUSD(token_); creators[creator] = true; dailyLimit = limit; dualApprovalThreshold = threshold;
        for (uint256 i; i < managers.length; i++) { require(managers[i] != creator && managers[i] != address(0), "Invalid approver"); approvers[managers[i]] = true; }
        for (uint256 i; i < suppliers.length; i++) { require(suppliers[i] != address(0), "Invalid supplier"); recipients[suppliers[i]] = true; }
    }
    function request(bytes32 id, address recipient, uint256 amount, uint64 dueAt) external {
        require(creators[msg.sender], "Creator role required");
        require(id != bytes32(0) && payments[id].creator == address(0), "Duplicate payment");
        require(recipients[recipient] && amount > 0 && amount <= dailyLimit, "Recipient or amount not allowed");
        payments[id] = Payment(msg.sender, recipient, amount, dueAt, 0, false, false);
        emit Requested(id, msg.sender, recipient, amount, dueAt);
    }
    function approve(bytes32 id) external {
        Payment storage p = payments[id];
        require(approvers[msg.sender] && p.creator != msg.sender, "Approver role required");
        require(p.creator != address(0) && !p.executed && !p.rejected, "Payment not open");
        require(!approvedBy[id][msg.sender], "Already approved");
        approvedBy[id][msg.sender] = true; p.approvals++; emit Approved(id, msg.sender);
    }
    function reject(bytes32 id) external {
        Payment storage p = payments[id];
        require(approvers[msg.sender], "Approver role required");
        require(p.creator != address(0) && !p.executed && !p.rejected, "Payment not open");
        p.rejected = true; emit Rejected(id, msg.sender);
    }
    function execute(bytes32 id) external {
        Payment storage p = payments[id];
        require(creators[msg.sender] || approvers[msg.sender], "Executor role required");
        require(p.creator != address(0) && !p.executed && !p.rejected, "Already executed or closed");
        require(p.approvals >= (p.amount > dualApprovalThreshold ? 2 : 1), "Insufficient approvals");
        require(block.timestamp >= p.dueAt, "Payment not due");
        uint256 day = block.timestamp / 1 days;
        require(dailySpent[day] + p.amount <= dailyLimit, "Daily limit exceeded");
        // Checks-effects-interactions; a failing transfer rolls back all state.
        p.executed = true; dailySpent[day] += p.amount;
        require(token.transfer(p.recipient, p.amount), "Transfer failed");
        emit Executed(id, msg.sender, p.recipient, p.amount);
    }
}
