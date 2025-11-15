import { Controller, Post, Get, Query, Body, Logger, NotFoundException } from "@nestjs/common"
import { PhoneWalletService } from "./phone-wallet.service"
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger"

@ApiTags("Phone Wallet")
@Controller("phone-wallet")
export class PhoneWalletController {
	constructor(private readonly phoneWalletService: PhoneWalletService) {}

	@Post("create")
	@ApiOperation({ summary: "Create or get wallet for phone number" })
	@ApiResponse({ status: 200, description: "Wallet created or retrieved successfully" })
	@ApiResponse({ status: 500, description: "Internal server error" })
	async createWallet(@Body() body: { phoneNumber: string }): Promise<{
		success: boolean
		wallet: {
			address: string
			vaultKeyName: string
			publicKey: string
			phoneNumber: string
		}
		message?: string
	}> {
		try {
			const wallet = await this.phoneWalletService.createWallet(body.phoneNumber)
			
			return {
				success: true,
				wallet,
			}
		} catch (error) {
			Logger.error(`Error creating wallet: ${error.message}`, "PhoneWalletController.createWallet")
			throw error
		}
	}

	@Get("address")
	@ApiOperation({ summary: "Get wallet address for phone number" })
	@ApiResponse({ status: 200, description: "Address retrieved successfully" })
	@ApiResponse({ status: 404, description: "Wallet not found" })
	async getAddress(@Query("phoneNumber") phoneNumber: string): Promise<{
		success: boolean
		address: string
		vaultKeyName: string
		phoneNumber: string
	}> {
		try {
			const walletInfo = await this.phoneWalletService.getAddress(phoneNumber)
			
			return {
				success: true,
				...walletInfo,
			}
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error
			}
			Logger.error(`Error getting address: ${error.message}`, "PhoneWalletController.getAddress")
			throw error
		}
	}

	@Post("sign")
	@ApiOperation({ summary: "Sign transaction using phone number's wallet" })
	@ApiResponse({ status: 200, description: "Transaction signed successfully" })
	@ApiResponse({ status: 404, description: "Wallet not found" })
	@ApiResponse({ status: 500, description: "Signing failed" })
	async signTransaction(@Body() body: {
		phoneNumber: string
		transactionData: string
	}): Promise<{
		success: boolean
		signature: string
		message?: string
	}> {
		try {
			const signature = await this.phoneWalletService.signTransaction(
				body.phoneNumber,
				body.transactionData
			)
			
			return {
				success: true,
				signature,
			}
		} catch (error) {
			Logger.error(`Error signing transaction: ${error.message}`, "PhoneWalletController.signTransaction")
			
			if (error instanceof NotFoundException) {
				throw error
			}
			
			return {
				success: false,
				signature: "",
				message: error.message || "Failed to sign transaction",
			}
		}
	}

	@Post("submit")
	@ApiOperation({ summary: "Submit signed transaction to Algorand network" })
	@ApiResponse({ status: 200, description: "Transaction submitted successfully" })
	@ApiResponse({ status: 500, description: "Submission failed" })
	async submitTransaction(@Body() body: {
		signedTransaction: string
	}): Promise<{
		success: boolean
		txId: string
		message?: string
	}> {
		try {
			const txId = await this.phoneWalletService.submitTransaction(body.signedTransaction)
			
			return {
				success: true,
				txId,
			}
		} catch (error) {
			Logger.error(`Error submitting transaction: ${error.message}`, "PhoneWalletController.submitTransaction")
			
			return {
				success: false,
				txId: "",
				message: error.message || "Failed to submit transaction",
			}
		}
	}
}

