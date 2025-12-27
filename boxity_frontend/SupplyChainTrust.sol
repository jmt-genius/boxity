// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SupplyChainTrust
 * @dev A comprehensive smart contract for tracking product batches and supply chain events
 * @author Chain Box Trust
 */
contract SupplyChainTrust {
    
    // ============ STRUCTS ============
    
    struct BatchEvent {
        uint256 id;
        string actor;
        string role;
        uint256 timestamp;
        string note;
        string image; // IPFS hash or URL
        string eventHash; // Cryptographic hash for verification
        address loggedBy; // Address that logged the event
    }
    
    struct Batch {
        string id;
        string productName;
        string sku;
        string origin;
        uint256 createdAt;
        string baselineImage; // IPFS hash or URL
        address creator; // Address that created the batch
        bool exists;
    }
    
    // ============ STATE VARIABLES ============
    
    // Batch management
    mapping(string => Batch) public batches;
    mapping(string => BatchEvent[]) public batchEvents;
    string[] public allBatchIds;
    
    // Event management
    uint256 public nextEventId = 1;
    uint256 public totalBatches = 0;
    
    // Access control
    address public owner;
    mapping(address => bool) public authorizedUsers;
    
    // ============ EVENTS ============
    
    event BatchCreated(
        string indexed batchId,
        string productName,
        string sku,
        string origin,
        address creator,
        uint256 timestamp
    );
    
    event EventLogged(
        string indexed batchId,
        uint256 indexed eventId,
        string actor,
        string role,
        string note,
        address loggedBy,
        uint256 timestamp
    );
    
    event UserAuthorized(address indexed user, bool authorized);
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyAuthorized() {
        require(authorizedUsers[msg.sender] || msg.sender == owner, "Unauthorized user");
        _;
    }
    
    modifier batchExists(string memory batchId) {
        require(batches[batchId].exists, "Batch does not exist");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor() {
        owner = msg.sender;
        authorizedUsers[msg.sender] = true;
    }
    
    // ============ BATCH MANAGEMENT ============
    
    /**
     * @dev Create a new product batch
     * @param batchId Unique identifier for the batch
     * @param productName Name of the product
     * @param sku Product SKU (can be empty)
     * @param origin Origin/manufacturer information
     * @param baselineImage IPFS hash or URL for baseline image
     */
    function createBatch(
        string memory batchId,
        string memory productName,
        string memory sku,
        string memory origin,
        string memory baselineImage
    ) external onlyAuthorized {
        require(!batches[batchId].exists, "Batch already exists");
        require(bytes(productName).length > 0, "Product name cannot be empty");
        require(bytes(origin).length > 0, "Origin cannot be empty");
        
        batches[batchId] = Batch({
            id: batchId,
            productName: productName,
            sku: sku,
            origin: origin,
            createdAt: block.timestamp,
            baselineImage: baselineImage,
            creator: msg.sender,
            exists: true
        });
        
        allBatchIds.push(batchId);
        totalBatches++;
        
        emit BatchCreated(batchId, productName, sku, origin, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Get batch information by ID
     * @param batchId The batch ID to retrieve
     * @return Batch struct containing all batch information
     */
    function getBatch(string memory batchId) 
        external 
        view 
        batchExists(batchId) 
        returns (Batch memory) 
    {
        return batches[batchId];
    }
    
    /**
     * @dev Get all batch IDs
     * @return Array of all batch IDs
     */
    function getAllBatchIds() external view returns (string[] memory) {
        return allBatchIds;
    }
    
    /**
     * @dev Get total number of batches
     * @return Total count of batches
     */
    function getTotalBatches() external view returns (uint256) {
        return totalBatches;
    }
    
    /**
     * @dev Check if a batch exists
     * @param batchId The batch ID to check
     * @return True if batch exists, false otherwise
     */
    function isBatchExists(string memory batchId) external view returns (bool) {
        return batches[batchId].exists;
    }
    
    // ============ EVENT MANAGEMENT ============
    
    /**
     * @dev Log a new event for a batch
     * @param batchId The batch ID to log event for
     * @param actor Name of the actor/company performing the action
     * @param role Role of the actor (Manufacturer, 3PL, Warehouse, etc.)
     * @param note Description of the event
     * @param image IPFS hash or URL for event image (can be empty)
     * @param eventHash Cryptographic hash for verification
     */
    function logEvent(
        string memory batchId,
        string memory actor,
        string memory role,
        string memory note,
        string memory image,
        string memory eventHash
    ) external onlyAuthorized batchExists(batchId) {
        require(bytes(actor).length > 0, "Actor cannot be empty");
        require(bytes(role).length > 0, "Role cannot be empty");
        require(bytes(note).length > 0, "Note cannot be empty");
        require(bytes(eventHash).length > 0, "Event hash cannot be empty");
        
        BatchEvent memory newEvent = BatchEvent({
            id: nextEventId,
            actor: actor,
            role: role,
            timestamp: block.timestamp,
            note: note,
            image: image,
            eventHash: eventHash,
            loggedBy: msg.sender
        });
        
        batchEvents[batchId].push(newEvent);
        nextEventId++;
        
        emit EventLogged(batchId, newEvent.id, actor, role, note, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Get all events for a specific batch
     * @param batchId The batch ID to get events for
     * @return Array of BatchEvent structs
     */
    function getBatchEvents(string memory batchId) 
        external 
        view 
        batchExists(batchId) 
        returns (BatchEvent[] memory) 
    {
        return batchEvents[batchId];
    }
    
    /**
     * @dev Get event count for a specific batch
     * @param batchId The batch ID to count events for
     * @return Number of events for the batch
     */
    function getBatchEventCount(string memory batchId) 
        external 
        view 
        batchExists(batchId) 
        returns (uint256) 
    {
        return batchEvents[batchId].length;
    }
    
    /**
     * @dev Get a specific event by batch ID and event index
     * @param batchId The batch ID
     * @param eventIndex Index of the event in the batch's event array
     * @return BatchEvent struct
     */
    function getBatchEvent(string memory batchId, uint256 eventIndex) 
        external 
        view 
        batchExists(batchId) 
        returns (BatchEvent memory) 
    {
        require(eventIndex < batchEvents[batchId].length, "Event index out of bounds");
        return batchEvents[batchId][eventIndex];
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    /**
     * @dev Get complete batch information with events
     * @param batchId The batch ID to retrieve
     * @return batch Batch information
     * @return events Array of events for the batch
     */
    function getBatchWithEvents(string memory batchId) 
        external 
        view 
        batchExists(batchId) 
        returns (Batch memory batch, BatchEvent[] memory events) 
    {
        batch = batches[batchId];
        events = batchEvents[batchId];
    }
    
    /**
     * @dev Search batches by product name (partial match)
     * @param searchTerm Term to search for in product names
     * @return matchingBatchIds Array of batch IDs that match
     */
    function searchBatchesByName(string memory searchTerm) 
        external 
        view 
        returns (string[] memory matchingBatchIds) 
    {
        require(bytes(searchTerm).length > 0, "Search term cannot be empty");
        
        // Count matches first
        uint256 matchCount = 0;
        for (uint256 i = 0; i < allBatchIds.length; i++) {
            if (containsString(batches[allBatchIds[i]].productName, searchTerm)) {
                matchCount++;
            }
        }
        
        // Create result array
        matchingBatchIds = new string[](matchCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < allBatchIds.length; i++) {
            if (containsString(batches[allBatchIds[i]].productName, searchTerm)) {
                matchingBatchIds[currentIndex] = allBatchIds[i];
                currentIndex++;
            }
        }
    }
    
    /**
     * @dev Get batches created by a specific address
     * @param creator Address of the creator
     * @return createdBatchIds Array of batch IDs created by the address
     */
    function getBatchesByCreator(address creator) 
        external 
        view 
        returns (string[] memory createdBatchIds) 
    {
        // Count batches created by this address
        uint256 count = 0;
        for (uint256 i = 0; i < allBatchIds.length; i++) {
            if (batches[allBatchIds[i]].creator == creator) {
                count++;
            }
        }
        
        // Create result array
        createdBatchIds = new string[](count);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < allBatchIds.length; i++) {
            if (batches[allBatchIds[i]].creator == creator) {
                createdBatchIds[currentIndex] = allBatchIds[i];
                currentIndex++;
            }
        }
    }
    
    // ============ ACCESS CONTROL ============
    
    /**
     * @dev Authorize or deauthorize a user
     * @param user Address to authorize/deauthorize
     * @param authorized True to authorize, false to deauthorize
     */
    function setUserAuthorization(address user, bool authorized) external onlyOwner {
        authorizedUsers[user] = authorized;
        emit UserAuthorized(user, authorized);
    }
    
    /**
     * @dev Check if a user is authorized
     * @param user Address to check
     * @return True if user is authorized
     */
    function isUserAuthorized(address user) external view returns (bool) {
        return authorizedUsers[user] || user == owner;
    }
    
    /**
     * @dev Transfer ownership of the contract
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
    
    // ============ HELPER FUNCTIONS ============
    
    /**
     * @dev Check if a string contains another string (case-insensitive)
     * @param str The main string
     * @param searchStr The string to search for
     * @return True if searchStr is found in str
     */
    function containsString(string memory str, string memory searchStr) 
        internal 
        pure 
        returns (bool) 
    {
        bytes memory strBytes = bytes(str);
        bytes memory searchBytes = bytes(searchStr);
        
        if (searchBytes.length > strBytes.length) {
            return false;
        }
        
        for (uint256 i = 0; i <= strBytes.length - searchBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < searchBytes.length; j++) {
                if (toLowerCase(strBytes[i + j]) != toLowerCase(searchBytes[j])) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Convert a byte to lowercase
     * @param b The byte to convert
     * @return The lowercase byte
     */
    function toLowerCase(bytes1 b) internal pure returns (bytes1) {
        if (b >= 0x41 && b <= 0x5A) {
            return bytes1(uint8(b) + 32);
        }
        return b;
    }
    
    // ============ CONTRACT INFO ============
    
    /**
     * @dev Get contract information
     * @return name Contract name
     * @return version Contract version
     * @return contractOwner Contract owner address
     * @return totalBatchesCount Total number of batches
     * @return nextEventIdValue Next event ID value
     */
    function getContractInfo() external view returns (
        string memory name,
        string memory version,
        address contractOwner,
        uint256 totalBatchesCount,
        uint256 nextEventIdValue
    ) {
        return (
            "SupplyChainTrust",
            "1.0.0",
            owner,
            totalBatches,
            nextEventId
        );
    }
}
