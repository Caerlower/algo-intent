import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { VaultService } from "../vault/vault.service"
import { WalletService } from "../wallet/wallet.service"
import { EncoderFactory } from "../chain/encoder.factory"
import { HttpService } from "@nestjs/axios"
import { ConfigService } from "@nestjs/config"
import algosdk from "algosdk"

@Injectable()
export class PhoneWalletService {
	private vaultToken: string

	constructor(
		private readonly vaultService: VaultService,
		private readonly walletService: WalletService,
		private readonly httpService: HttpService,
		private readonly configService: ConfigService
	) {
		this.vaultToken = this.configService.get<string>("VAULT_TOKEN") || ""
	}

	/**
	 * Normalize phone number to vault key name format
	 * Converts +1234567890 to phone__plus_1234567890
	 */
	normalizePhoneToKeyName(phoneNumber: string): string {
		// Remove all non-digit characters except +
		const cleaned = phoneNumber.replace(/[^\d+]/g, '')
		// Replace + with plus_ for vault key name
		const normalized = cleaned.replace(/\+/g, 'plus_')
		return `phone__${normalized}`
	}

	/**
	 * Create or get wallet for phone number
	 * Returns wallet info including address and vault key name
	 */
	async createWallet(phoneNumber: string): Promise<{
		address: string
		vaultKeyName: string
		publicKey: string
		phoneNumber: string
	}> {
		const vaultKeyName = this.normalizePhoneToKeyName(phoneNumber)
		
		try {
			// Try to get existing public key (this will create if doesn't exist)
			const publicKey = await this.walletService.getPublicKey(vaultKeyName, "ed25519")
			const encoder = EncoderFactory.getEncoder("algorand")
			const address = encoder.encodeAddress(publicKey)

			Logger.log(`Wallet created/retrieved for ${phoneNumber}`, "PhoneWalletService.createWallet")

			return {
				address,
				vaultKeyName,
				publicKey: publicKey.toString("base64"),
				phoneNumber,
			}
		} catch (error) {
			Logger.error(`Failed to create wallet for ${phoneNumber}: ${error.message}`, "PhoneWalletService.createWallet")
			throw error
		}
	}

	/**
	 * Check if vault key exists without creating it
	 */
	private async keyExists(vaultKeyName: string): Promise<boolean> {
		try {
			// Use Vault's list keys endpoint to check if key exists
			const response = await this.httpService.axiosRef.get(
				"http://localhost:8200/v1/transit/keys",
				{
					headers: {
						"X-Vault-Token": this.vaultToken,
					},
				}
			)
			
			const keys = response.data?.data?.keys || []
			return keys.includes(vaultKeyName)
		} catch (error) {
			// If list fails, fall back to trying to get the key
			// This might create the key, but it's better than failing completely
			Logger.warn(`Could not list keys, falling back to key check: ${error.message}`, "PhoneWalletService.keyExists")
			try {
				await this.walletService.getPublicKey(vaultKeyName, "ed25519")
				return true
			} catch {
				return false
			}
		}
	}

	/**
	 * Get wallet address for phone number (read-only, does not create)
	 * Throws NotFoundException if wallet doesn't exist
	 */
	async getAddress(phoneNumber: string): Promise<{
		address: string
		vaultKeyName: string
		phoneNumber: string
	}> {
		const vaultKeyName = this.normalizePhoneToKeyName(phoneNumber)
		
		// Check if key exists first
		const exists = await this.keyExists(vaultKeyName)
		if (!exists) {
			Logger.warn(`Wallet not found for ${phoneNumber}`, "PhoneWalletService.getAddress")
			throw new NotFoundException(`Wallet not found for phone number: ${phoneNumber}`)
		}
		
		try {
			// Get public key (key exists, so this won't create a new one)
			const publicKey = await this.walletService.getPublicKey(vaultKeyName, "ed25519")
			const encoder = EncoderFactory.getEncoder("algorand")
			const address = encoder.encodeAddress(publicKey)

			return {
				address,
				vaultKeyName,
				phoneNumber,
			}
		} catch (error) {
			Logger.error(`Error getting address for ${phoneNumber}: ${error.message}`, "PhoneWalletService.getAddress")
			throw new NotFoundException(`Wallet not found for phone number: ${phoneNumber}`)
		}
	}

	/**
	 * Sign transaction data using phone number's wallet
	 * Returns signature in vault format: vault:v1:signature_base64
	 */
	async signTransaction(phoneNumber: string, transactionData: string): Promise<string> {
		const vaultKeyName = this.normalizePhoneToKeyName(phoneNumber)
		
		try {
			// Decode base64 transaction data
			const txnBytes = Buffer.from(transactionData, "base64")
			
			// Sign using vault
			const signature = await this.walletService.rawSign(txnBytes, vaultKeyName)
			
			// Vault returns signature as "vault:v1:signature_base64"
			return signature.toString()
		} catch (error) {
			Logger.error(`Failed to sign transaction for ${phoneNumber}: ${error.message}`, "PhoneWalletService.signTransaction")
			throw error
		}
	}

	/**
	 * Submit signed transaction to Algorand network
	 * Returns transaction ID
	 */
	async submitTransaction(signedTransaction: string): Promise<string> {
		try {
			// Decode base64 signed transaction
			const signedTxnBytes = Buffer.from(signedTransaction, "base64")
			
			// Submit to Algorand network
			const txId = await this.walletService.submitTransaction(new Uint8Array(signedTxnBytes))
			
			Logger.log(`Transaction submitted: ${txId}`, "PhoneWalletService.submitTransaction")
			return txId
		} catch (error) {
			Logger.error(`Failed to submit transaction: ${error.message}`, "PhoneWalletService.submitTransaction")
			throw error
		}
	}
}

