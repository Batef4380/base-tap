// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BaseTap
 * @author Batuhan Efe
 * @notice Tap-to-earn game with on-chain leaderboard
 * @dev Optimized for batch transactions via EIP-5792
 */
contract BaseTap {
    
    mapping(address => uint256) public userTaps;
    address[] public players;
    mapping(address => bool) public hasPlayed;
    uint256 public totalTaps;
    
    uint256 public constant DAILY_TAP_LIMIT = 1000;
    mapping(address => mapping(uint256 => uint256)) public dailyTaps;
    
    event Tapped(address indexed user, uint256 newTotal);
    event NewPlayer(address indexed player);
    
    error DailyLimitExceeded();
    
    function tap() external {
        _recordTap(msg.sender, 1);
    }
    
    function tapMultiple(uint256 count) external {
        require(count > 0 && count <= 100, "Invalid count");
        _recordTap(msg.sender, count);
    }
    
    function _recordTap(address user, uint256 count) internal {
        uint256 today = block.timestamp / 1 days;
        
        if (dailyTaps[user][today] + count > DAILY_TAP_LIMIT) {
            revert DailyLimitExceeded();
        }
        
        if (!hasPlayed[user]) {
            hasPlayed[user] = true;
            players.push(user);
            emit NewPlayer(user);
        }
        
        userTaps[user] += count;
        totalTaps += count;
        dailyTaps[user][today] += count;
        
        emit Tapped(user, userTaps[user]);
    }
    
    function getLeaderboard(uint256 offset, uint256 limit) 
        external view 
        returns (address[] memory addresses, uint256[] memory taps) 
    {
        uint256 playerCount = players.length;
        
        if (offset >= playerCount) {
            return (new address[](0), new uint256[](0));
        }
        
        uint256 end = offset + limit;
        if (end > playerCount) end = playerCount;
        uint256 resultLength = end - offset;
        
        addresses = new address[](resultLength);
        taps = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            addresses[i] = players[offset + i];
            taps[i] = userTaps[players[offset + i]];
        }
    }
    
    function getPlayerCount() external view returns (uint256) {
        return players.length;
    }
}
