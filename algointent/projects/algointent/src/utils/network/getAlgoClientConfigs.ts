import { AlgoViteClientConfig, AlgoViteKMDConfig } from '../../interfaces/network'

export function getAlgodConfigFromViteEnvironment(): AlgoViteClientConfig {
  if (!import.meta.env.VITE_ALGOD_SERVER) {
    throw new Error('Attempt to get default algod configuration without specifying VITE_ALGOD_SERVER in the environment variables')
  }

  return {
    server: import.meta.env.VITE_ALGOD_SERVER,
    port: import.meta.env.VITE_ALGOD_PORT,
    token: import.meta.env.VITE_ALGOD_TOKEN,
    network: import.meta.env.VITE_ALGOD_NETWORK,
  }
}

/**
 * Get algod configuration for a specific network (mainnet or testnet)
 * Supports two patterns:
 * 1. Network-specific env vars (e.g., VITE_ALGOD_SERVER_MAINNET, VITE_ALGOD_SERVER_TESTNET)
 * 2. Single env vars (VITE_ALGOD_SERVER) - automatically converts URL based on requested network
 */
export function getAlgodConfigForNetwork(network: 'testnet' | 'mainnet'): AlgoViteClientConfig {
  const networkUpper = network.toUpperCase();
  
  // Pattern 1: Try network-specific env vars first (e.g., VITE_ALGOD_SERVER_MAINNET)
  let server = import.meta.env[`VITE_ALGOD_SERVER_${networkUpper}`];
  let port = import.meta.env[`VITE_ALGOD_PORT_${networkUpper}`];
  let token = import.meta.env[`VITE_ALGOD_TOKEN_${networkUpper}`];
  
  // Pattern 2: Fall back to base env vars (single config pattern)
  // This allows users to have one set of env vars and switch networks dynamically
  if (!server) {
    server = import.meta.env.VITE_ALGOD_SERVER;
    port = import.meta.env.VITE_ALGOD_PORT;
    token = import.meta.env.VITE_ALGOD_TOKEN;
  }
  
  if (!server) {
    throw new Error(`Attempt to get ${network} algod configuration without specifying VITE_ALGOD_SERVER_${networkUpper} or VITE_ALGOD_SERVER in the environment variables`);
  }

  // For single config pattern, convert the server URL based on requested network
  // This allows switching between testnet/mainnet without changing env vars
  let finalServer = server;
  if (network === 'testnet') {
    // Convert to testnet URL if needed
    if (server.includes('mainnet-api.algonode.cloud')) {
      finalServer = server.replace('mainnet-api.algonode.cloud', 'testnet-api.algonode.cloud');
    } else if (server.includes('mainnet-idx.algonode.cloud')) {
      finalServer = server.replace('mainnet-idx.algonode.cloud', 'testnet-idx.algonode.cloud');
    } else if (server.includes('mainnet') && !server.includes('testnet')) {
      // Generic mainnet -> testnet conversion
      finalServer = server.replace(/mainnet/g, 'testnet');
    }
  } else if (network === 'mainnet') {
    // Convert to mainnet URL if needed
    if (server.includes('testnet-api.algonode.cloud')) {
      finalServer = server.replace('testnet-api.algonode.cloud', 'mainnet-api.algonode.cloud');
    } else if (server.includes('testnet-idx.algonode.cloud')) {
      finalServer = server.replace('testnet-idx.algonode.cloud', 'mainnet-idx.algonode.cloud');
    } else if (server.includes('testnet') && !server.includes('mainnet')) {
      // Generic testnet -> mainnet conversion
      finalServer = server.replace(/testnet/g, 'mainnet');
    }
  }

  return {
    server: finalServer,
    port: port || '',
    token: token || '',
    network,
  };
}

export function getIndexerConfigFromViteEnvironment(): AlgoViteClientConfig {
  if (!import.meta.env.VITE_INDEXER_SERVER) {
    throw new Error('Attempt to get default algod configuration without specifying VITE_INDEXER_SERVER in the environment variables')
  }

  return {
    server: import.meta.env.VITE_INDEXER_SERVER,
    port: import.meta.env.VITE_INDEXER_PORT,
    token: import.meta.env.VITE_INDEXER_TOKEN,
    network: import.meta.env.VITE_ALGOD_NETWORK,
  }
}

export function getKmdConfigFromViteEnvironment(): AlgoViteKMDConfig {
  if (!import.meta.env.VITE_KMD_SERVER) {
    throw new Error('Attempt to get default kmd configuration without specifying VITE_KMD_SERVER in the environment variables')
  }

  return {
    server: import.meta.env.VITE_KMD_SERVER,
    port: import.meta.env.VITE_KMD_PORT,
    token: import.meta.env.VITE_KMD_TOKEN,
    wallet: import.meta.env.VITE_KMD_WALLET,
    password: import.meta.env.VITE_KMD_PASSWORD,
  }
}
