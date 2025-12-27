// Contract configuration for SupplyChainTrust
export const CONTRACT_ADDRESS = "0x7001B79deC6A54F7Ff752c1d21Df17C7BBCB538c"; // Replace with your deployed contract address

export const CONTRACT_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
        {
            "anonymous": false,
            "inputs": [
                {
                    "indexed": true,
                    "internalType": "string",
                    "name": "batchId",
                    "type": "string"
                },
                {
                    "indexed": false,
                    "internalType": "string",
                    "name": "productName",
                    "type": "string"
                },
                {
                    "indexed": false,
                    "internalType": "string",
                    "name": "sku",
                    "type": "string"
                },
                {
                    "indexed": false,
                    "internalType": "string",
                    "name": "origin",
                    "type": "string"
                },
                {
                    "indexed": false,
                    "internalType": "address",
                    "name": "creator",
                    "type": "address"
                },
                {
                    "indexed": false,
                    "internalType": "uint256",
                    "name": "timestamp",
                    "type": "uint256"
                }
            ],
            "name": "BatchCreated",
            "type": "event"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "batchId",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "productName",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "sku",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "origin",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "baselineImage",
                    "type": "string"
                }
            ],
            "name": "createBatch",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "anonymous": false,
            "inputs": [
                {
                    "indexed": true,
                    "internalType": "string",
                    "name": "batchId",
                    "type": "string"
                },
                {
                    "indexed": true,
                    "internalType": "uint256",
                    "name": "eventId",
                    "type": "uint256"
                },
                {
                    "indexed": false,
                    "internalType": "string",
                    "name": "actor",
                    "type": "string"
                },
                {
                    "indexed": false,
                    "internalType": "string",
                    "name": "role",
                    "type": "string"
                },
                {
                    "indexed": false,
                    "internalType": "string",
                    "name": "note",
                    "type": "string"
                },
                {
                    "indexed": false,
                    "internalType": "address",
                    "name": "loggedBy",
                    "type": "address"
                },
                {
                    "indexed": false,
                    "internalType": "uint256",
                    "name": "timestamp",
                    "type": "uint256"
                }
            ],
            "name": "EventLogged",
            "type": "event"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "batchId",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "actor",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "role",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "note",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "image",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "eventHash",
                    "type": "string"
                }
            ],
            "name": "logEvent",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "user",
                    "type": "address"
                },
                {
                    "internalType": "bool",
                    "name": "authorized",
                    "type": "bool"
                }
            ],
            "name": "setUserAuthorization",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "newOwner",
                    "type": "address"
                }
            ],
            "name": "transferOwnership",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "anonymous": false,
            "inputs": [
                {
                    "indexed": true,
                    "internalType": "address",
                    "name": "user",
                    "type": "address"
                },
                {
                    "indexed": false,
                    "internalType": "bool",
                    "name": "authorized",
                    "type": "bool"
                }
            ],
            "name": "UserAuthorized",
            "type": "event"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "name": "allBatchIds",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                }
            ],
            "name": "authorizedUsers",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                }
            ],
            "name": "batches",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "id",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "productName",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "sku",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "origin",
                    "type": "string"
                },
                {
                    "internalType": "uint256",
                    "name": "createdAt",
                    "type": "uint256"
                },
                {
                    "internalType": "string",
                    "name": "baselineImage",
                    "type": "string"
                },
                {
                    "internalType": "address",
                    "name": "creator",
                    "type": "address"
                },
                {
                    "internalType": "bool",
                    "name": "exists",
                    "type": "bool"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                },
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "name": "batchEvents",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "id",
                    "type": "uint256"
                },
                {
                    "internalType": "string",
                    "name": "actor",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "role",
                    "type": "string"
                },
                {
                    "internalType": "uint256",
                    "name": "timestamp",
                    "type": "uint256"
                },
                {
                    "internalType": "string",
                    "name": "note",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "image",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "eventHash",
                    "type": "string"
                },
                {
                    "internalType": "address",
                    "name": "loggedBy",
                    "type": "address"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getAllBatchIds",
            "outputs": [
                {
                    "internalType": "string[]",
                    "name": "",
                    "type": "string[]"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "batchId",
                    "type": "string"
                }
            ],
            "name": "getBatch",
            "outputs": [
                {
                    "components": [
                        {
                            "internalType": "string",
                            "name": "id",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "productName",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "sku",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "origin",
                            "type": "string"
                        },
                        {
                            "internalType": "uint256",
                            "name": "createdAt",
                            "type": "uint256"
                        },
                        {
                            "internalType": "string",
                            "name": "baselineImage",
                            "type": "string"
                        },
                        {
                            "internalType": "address",
                            "name": "creator",
                            "type": "address"
                        },
                        {
                            "internalType": "bool",
                            "name": "exists",
                            "type": "bool"
                        }
                    ],
                    "internalType": "struct SupplyChainTrust.Batch",
                    "name": "",
                    "type": "tuple"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "creator",
                    "type": "address"
                }
            ],
            "name": "getBatchesByCreator",
            "outputs": [
                {
                    "internalType": "string[]",
                    "name": "createdBatchIds",
                    "type": "string[]"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "batchId",
                    "type": "string"
                },
                {
                    "internalType": "uint256",
                    "name": "eventIndex",
                    "type": "uint256"
                }
            ],
            "name": "getBatchEvent",
            "outputs": [
                {
                    "components": [
                        {
                            "internalType": "uint256",
                            "name": "id",
                            "type": "uint256"
                        },
                        {
                            "internalType": "string",
                            "name": "actor",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "role",
                            "type": "string"
                        },
                        {
                            "internalType": "uint256",
                            "name": "timestamp",
                            "type": "uint256"
                        },
                        {
                            "internalType": "string",
                            "name": "note",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "image",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "eventHash",
                            "type": "string"
                        },
                        {
                            "internalType": "address",
                            "name": "loggedBy",
                            "type": "address"
                        }
                    ],
                    "internalType": "struct SupplyChainTrust.BatchEvent",
                    "name": "",
                    "type": "tuple"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "batchId",
                    "type": "string"
                }
            ],
            "name": "getBatchEventCount",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "batchId",
                    "type": "string"
                }
            ],
            "name": "getBatchEvents",
            "outputs": [
                {
                    "components": [
                        {
                            "internalType": "uint256",
                            "name": "id",
                            "type": "uint256"
                        },
                        {
                            "internalType": "string",
                            "name": "actor",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "role",
                            "type": "string"
                        },
                        {
                            "internalType": "uint256",
                            "name": "timestamp",
                            "type": "uint256"
                        },
                        {
                            "internalType": "string",
                            "name": "note",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "image",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "eventHash",
                            "type": "string"
                        },
                        {
                            "internalType": "address",
                            "name": "loggedBy",
                            "type": "address"
                        }
                    ],
                    "internalType": "struct SupplyChainTrust.BatchEvent[]",
                    "name": "",
                    "type": "tuple[]"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "batchId",
                    "type": "string"
                }
            ],
            "name": "getBatchWithEvents",
            "outputs": [
                {
                    "components": [
                        {
                            "internalType": "string",
                            "name": "id",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "productName",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "sku",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "origin",
                            "type": "string"
                        },
                        {
                            "internalType": "uint256",
                            "name": "createdAt",
                            "type": "uint256"
                        },
                        {
                            "internalType": "string",
                            "name": "baselineImage",
                            "type": "string"
                        },
                        {
                            "internalType": "address",
                            "name": "creator",
                            "type": "address"
                        },
                        {
                            "internalType": "bool",
                            "name": "exists",
                            "type": "bool"
                        }
                    ],
                    "internalType": "struct SupplyChainTrust.Batch",
                    "name": "batch",
                    "type": "tuple"
                },
                {
                    "components": [
                        {
                            "internalType": "uint256",
                            "name": "id",
                            "type": "uint256"
                        },
                        {
                            "internalType": "string",
                            "name": "actor",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "role",
                            "type": "string"
                        },
                        {
                            "internalType": "uint256",
                            "name": "timestamp",
                            "type": "uint256"
                        },
                        {
                            "internalType": "string",
                            "name": "note",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "image",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "eventHash",
                            "type": "string"
                        },
                        {
                            "internalType": "address",
                            "name": "loggedBy",
                            "type": "address"
                        }
                    ],
                    "internalType": "struct SupplyChainTrust.BatchEvent[]",
                    "name": "events",
                    "type": "tuple[]"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getContractInfo",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "name",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "version",
                    "type": "string"
                },
                {
                    "internalType": "address",
                    "name": "contractOwner",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "totalBatchesCount",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "nextEventIdValue",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getTotalBatches",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "batchId",
                    "type": "string"
                }
            ],
            "name": "isBatchExists",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "user",
                    "type": "address"
                }
            ],
            "name": "isUserAuthorized",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "nextEventId",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "owner",
            "outputs": [
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "searchTerm",
                    "type": "string"
                }
            ],
            "name": "searchBatchesByName",
            "outputs": [
                {
                    "internalType": "string[]",
                    "name": "matchingBatchIds",
                    "type": "string[]"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "totalBatches",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ] as const;

// Network configuration
export const NETWORKS = {
  BASE_SEPOLIA: {
    chainId: '0x14a34', // 84532 in hex
    chainName: 'Base Sepolia',
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia.basescan.org']
  }
} as const;

export const SUPPORTED_NETWORKS = [NETWORKS.BASE_SEPOLIA];
