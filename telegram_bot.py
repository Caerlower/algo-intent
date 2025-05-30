import os
import json
import logging
import re
import hashlib
import time
from datetime import datetime, timedelta
from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    filters,
    CallbackContext,
    ConversationHandler
)
from functools import wraps
from ai_intent import AIIntentParser
from wallet import create_wallet, connect_wallet, disconnect_wallet, get_connected_wallet, sign_transaction
from transaction_builder import build_and_send_transaction, create_nft
from utils import get_algod_client, generate_unit_name

# Configuration
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
SESSIONS_FILE = "telegram_sessions.json"
SECURITY_LOG_FILE = "security_events.log"

# Conversation states
PASSWORD, MNEMONIC, PASSWORD_FOR_CONNECT, TRANSACTION_PASSWORD = range(4)

# Security Configuration
MAX_MESSAGE_LENGTH = 1000
MAX_PASSWORD_ATTEMPTS = 3
SESSION_TIMEOUT_HOURS = 24
MAX_TRANSACTIONS_PER_HOUR = 10

# Set up comprehensive logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
    handlers=[
        logging.FileHandler("bot.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Security logger
security_logger = logging.getLogger("security")
security_handler = logging.FileHandler(SECURITY_LOG_FILE)
security_handler.setFormatter(logging.Formatter("%(asctime)s - SECURITY - %(message)s"))
security_logger.addHandler(security_handler)
security_logger.setLevel(logging.INFO)

def log_security_event(user_id, event_type, details=""):
    """Log security-related events"""
    security_logger.info(f"User {user_id} - {event_type} - {details}")

def sanitize_input(text):
    """Sanitize user input to prevent injection attacks"""
    if not text or not isinstance(text, str):
        return ""
    
    # Remove control characters and limit length
    sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    sanitized = sanitized[:MAX_MESSAGE_LENGTH]
    
    # Remove potentially dangerous patterns
    dangerous_patterns = [
        r'<script.*?</script>',
        r'javascript:',
        r'data:',
        r'vbscript:',
        r'onload=',
        r'onerror=',
        r'eval\(',
        r'exec\(',
    ]
    
    for pattern in dangerous_patterns:
        sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE)
    
    return sanitized.strip()

def validate_algorand_address(address):
    """Validate Algorand address format with additional security checks"""
    if not address or not isinstance(address, str):
        return False
    
    # Basic format validation
    if len(address) != 58:
        return False
    
    # Check for valid base32 characters
    if not re.match(r'^[A-Z2-7]{58}$', address):
        return False
    
    # Additional checksum validation would go here
    return True

def check_user_rate_limit(user_id, action_type="general"):
    """Check if user is within rate limits"""
    sessions = load_sessions()
    user_key = str(user_id)
    current_time = datetime.now()
    
    if user_key not in sessions:
        return True
    
    user_session = sessions[user_key]
    
    # Check transaction rate limit
    if action_type == "transaction":
        recent_transactions = user_session.get('recent_transactions', [])
        # Remove transactions older than 1 hour
        recent_transactions = [
            tx_time for tx_time in recent_transactions 
            if datetime.fromisoformat(tx_time) > current_time - timedelta(hours=1)
        ]
        
        if len(recent_transactions) >= MAX_TRANSACTIONS_PER_HOUR:
            log_security_event(user_id, "RATE_LIMIT_EXCEEDED", f"Transaction limit: {len(recent_transactions)}")
            return False
        
        # Add current transaction
        recent_transactions.append(current_time.isoformat())
        user_session['recent_transactions'] = recent_transactions
        sessions[user_key] = user_session
        save_sessions(sessions)
    
    return True

def validate_session(user_id):
    """Validate user session and check for expiry"""
    sessions = load_sessions()
    user_key = str(user_id)
    
    if user_key not in sessions:
        return False
    
    user_session = sessions[user_key]
    
    # Check session expiry
    if 'last_activity' in user_session:
        last_activity = datetime.fromisoformat(user_session['last_activity'])
        if datetime.now() - last_activity > timedelta(hours=SESSION_TIMEOUT_HOURS):
            log_security_event(user_id, "SESSION_EXPIRED")
            del sessions[user_key]
            save_sessions(sessions)
            return False
    
    # Update last activity
    user_session['last_activity'] = datetime.now().isoformat()
    sessions[user_key] = user_session
    save_sessions(sessions)
    
    return True

def load_sessions():
    """Load user sessions with error handling"""
    try:
        if os.path.exists(SESSIONS_FILE):
            with open(SESSIONS_FILE, 'r') as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"Failed to load sessions: {e}")
        # Backup corrupted file
        if os.path.exists(SESSIONS_FILE):
            backup_name = f"{SESSIONS_FILE}.backup.{int(time.time())}"
            os.rename(SESSIONS_FILE, backup_name)
            logger.info(f"Corrupted sessions file backed up as {backup_name}")
    
    return {}

def save_sessions(sessions):
    """Save user sessions securely"""
    try:
        # Write to temporary file first
        temp_file = f"{SESSIONS_FILE}.tmp"
        with open(temp_file, 'w') as f:
            json.dump(sessions, f)
        
        # Atomically replace the original file
        os.replace(temp_file, SESSIONS_FILE)
    except IOError as e:
        logger.error(f"Failed to save sessions: {e}")

def parse_nft_command_fallback(text):
    """Secure fallback NFT parser"""
    text = sanitize_input(text)
    if not text:
        return None
    
    patterns = [
        r"(?i)(create|mint|make)\s+(?:an?\s+)?nft\s+(?:with\s+name\s+|named\s+|called\s+)?(?P<name>[a-zA-Z0-9\s]{1,50})",
        r"(?i)(?:help\s+me\s+)?(create|mint|make)\s+(?:an?\s+)?nft\s+(?:with\s+name\s+|named\s+|called\s+)?(?P<name>[a-zA-Z0-9\s]{1,50})",
        r"(?i)(create|mint|make)\s+(?P<name>[a-zA-Z0-9\s]{1,50})\s+nft"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            name = sanitize_input(match.group('name'))
            if name and len(name.strip()) > 0:
                return {
                    'intent': 'create_nft',
                    'parameters': {
                        'name': name.strip(),
                        'supply': 1,
                        'description': ''
                    }
                }
    return None

def parse_send_command_fallback(text):
    """Secure fallback send parser"""
    text = sanitize_input(text)
    if not text:
        return None
    
    pattern = r"(?i)(send|transfer|pay)\s+(?P<amount>[\d\.]{1,20}|\w+(?:\s+\w+)*)\s+(?:algo|algos)\s+to\s+(?P<address>[A-Z2-7]{58})"
    match = re.search(pattern, text)
    
    if match:
        amount_text = sanitize_input(match.group('amount'))
        address = sanitize_input(match.group('address'))
        
        # Validate address
        if not validate_algorand_address(address):
            return None
        
        # Convert and validate amount
        try:
            amount = float(amount_text)
            if amount <= 0 or amount > 1000000:  # Reasonable limits
                return None
        except ValueError:
            from utils import text_to_number
            amount = text_to_number(amount_text)
            if amount is None or amount <= 0 or amount > 1000000:
                return None
        
        return {
            'intent': 'send_algo',
            'parameters': {
                'amount': amount,
                'recipient': address
            }
        }
    return None

async def start(update: Update, context: CallbackContext):
    """Welcome message for all users"""
    user = update.effective_user
    user_id = user.id
    
    log_security_event(user_id, "BOT_STARTED", f"Username: {user.username}, Name: {user.first_name}")
    
    await update.message.reply_text(
        f"👋 Welcome {user.first_name} to Algo-Intent Bot!\n"
        "🔒 This bot helps you manage Algorand wallets securely.\n\n"
        "Available commands:\n"
        "• 'Create a new wallet'\n"
        "• 'Send X ALGO to ADDRESS'\n"
        "• 'Create NFT named NAME'\n"
        "• 'Check my balance'\n"
        "• 'Disconnect my wallet'\n\n"
        "⚠️ Security Notice: Never share your wallet passwords or mnemonic phrases with anyone!"
    )

async def handle_message(update: Update, context: CallbackContext):
    """Main message handler with comprehensive security"""
    user = update.effective_user
    user_id = user.id
    user_input = sanitize_input(update.message.text)
    
    if not user_input:
        await update.message.reply_text("❌ Invalid input received.")
        return
    
    # Rate limiting check
    if not check_user_rate_limit(user_id):
        await update.message.reply_text("⏱️ You're sending requests too quickly. Please wait a moment and try again.")
        return
    
    # Check conversation state
    current_state = context.user_data.get('state')
    if current_state:
        return await handle_conversation_state(update, context)
    
    # Log user interaction
    logger.info(f"User {user_id} ({user.username}): {user_input[:100]}...")
    
    # Parse intent
    parsed = None
    try:
        intent_parser = AIIntentParser()
        parsed = intent_parser.parse(user_input)
    except Exception as e:
        logger.error(f"AI parsing failed for user {user_id}: {e}")
    
    # Fallback parsing
    if not parsed or parsed.get('intent') == 'unknown':
        parsed = parse_nft_command_fallback(user_input)
        if not parsed:
            parsed = parse_send_command_fallback(user_input)
    
    if not parsed:
        await update.message.reply_text(
            "❌ I didn't understand that command.\n\n"
            "Try:\n"
            "• 'Create a new wallet'\n"
            "• 'Send 5 ALGO to [ADDRESS]'\n"
            "• 'Create NFT named Dragon'\n"
            "• 'Check my balance'"
        )
        return
    
    intent = parsed['intent']
    params = parsed.get('parameters', {})
    
    try:
        if intent == 'create_wallet':
            log_security_event(user_id, "WALLET_CREATION_INITIATED")
            context.user_data['state'] = 'creating_wallet'
            await update.message.reply_text(
                "🔒 Creating a new wallet...\n"
                "Please set a secure password (minimum 8 characters):"
            )
        elif intent == 'connect_wallet':
            log_security_event(user_id, "WALLET_CONNECTION_INITIATED")
            context.user_data['state'] = 'connecting_wallet'
            await update.message.reply_text(
                "🔑 Connecting to existing wallet...\n"
                "Please enter your 25-word mnemonic phrase:"
            )
        elif intent == 'send_algo':
            await handle_send_transaction(update, context, params)
        elif intent == 'create_nft':
            await handle_nft_creation(update, context, params)
        elif intent == 'disconnect':
            await handle_disconnect(update, context)
        elif intent == 'balance':
            await handle_balance_check(update, context)
        else:
            await update.message.reply_text("❌ Unsupported action")
    except Exception as e:
        logger.error(f"Error handling message for user {user_id}: {e}")
        await update.message.reply_text("❌ An error occurred. Please try again later.")

async def handle_conversation_state(update: Update, context: CallbackContext):
    """Handle conversation states with security validation"""
    user_id = update.effective_user.id
    state = context.user_data.get('state')
    message_text = sanitize_input(update.message.text)
    
    if not message_text:
        await update.message.reply_text("❌ Invalid input received.")
        return
    
    # Check for failed attempts
    failed_attempts = context.user_data.get('failed_attempts', 0)
    if failed_attempts >= MAX_PASSWORD_ATTEMPTS:
        log_security_event(user_id, "MAX_ATTEMPTS_EXCEEDED", f"State: {state}")
        context.user_data.clear()
        await update.message.reply_text("❌ Too many failed attempts. Please start over.")
        return
    
    if state == 'creating_wallet':
        await handle_wallet_creation_password(update, context, message_text)
    elif state == 'connecting_wallet':
        await handle_mnemonic_input(update, context, message_text)
    elif state == 'connecting_password':
        await handle_connection_password(update, context, message_text)
    elif state == 'transaction_password':
        await handle_transaction_password(update, context, message_text)
    else:
        context.user_data.clear()
        await update.message.reply_text("❌ Invalid state. Please start over.")

async def handle_wallet_creation_password(update: Update, context: CallbackContext, password: str):
    """Handle wallet creation with password validation"""
    user_id = update.effective_user.id
    
    # Validate password strength
    if len(password) < 8:
        await update.message.reply_text("❌ Password must be at least 8 characters long.")
        return
    
    if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
        await update.message.reply_text("❌ Password must contain both letters and numbers.")
        return
    
    try:
        wallet_data = create_wallet(password)
        sessions = load_sessions()
        sessions[str(user_id)] = {
            "address": wallet_data["address"],
            "encrypted_mnemonic": wallet_data["encrypted_mnemonic"],
            "created_at": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat()
        }
        save_sessions(sessions)
        
        log_security_event(user_id, "WALLET_CREATED", f"Address: {wallet_data['address']}")
        
        await update.message.reply_text(
            "✅ Wallet created successfully!\n\n"
            f"📍 Address: `{wallet_data['address']}`\n\n"
            f"🔑 **IMPORTANT - Save this mnemonic phrase:**\n"
            f"`{wallet_data['mnemonic']}`\n\n"
            "⚠️ **WARNING**: This mnemonic will not be shown again!\n"
            "Store it safely and never share it with anyone.",
            parse_mode="Markdown"
        )
        context.user_data.clear()
    except Exception as e:
        logger.error(f"Wallet creation failed for user {user_id}: {e}")
        log_security_event(user_id, "WALLET_CREATION_FAILED", str(e))
        await update.message.reply_text("❌ Failed to create wallet. Please try again.")
        context.user_data.clear()

async def handle_send_transaction(update: Update, context: CallbackContext, params: dict):
    """Handle send transaction with security checks"""
    user_id = update.effective_user.id
    
    # Validate session
    if not validate_session(user_id):
        await update.message.reply_text("❌ Please connect a wallet first!")
        return
    
    # Check transaction rate limit
    if not check_user_rate_limit(user_id, "transaction"):
        await update.message.reply_text("⏱️ Transaction rate limit exceeded. Please wait before sending another transaction.")
        return
    
    # Validate parameters
    required_params = ['amount', 'recipient']
    if not all(param in params for param in required_params):
        await update.message.reply_text("❌ Missing transaction details. Example: 'Send 5 ALGO to address'")
        return
    
    # Additional validation
    if not validate_algorand_address(params['recipient']):
        await update.message.reply_text("❌ Invalid recipient address format.")
        return
    
    if params['amount'] <= 0 or params['amount'] > 1000000:
        await update.message.reply_text("❌ Invalid amount. Must be between 0 and 1,000,000 ALGO.")
        return
    
    sessions = load_sessions()
    user_session = sessions.get(str(user_id), {})
    
    try:
        algod_client = get_algod_client()
        result = build_and_send_transaction(
            sender=user_session["address"],
            recipient=params['recipient'],
            amount=params['amount'],
            algod_client=algod_client,
            frontend='telegram'
        )
        
        if result.get('status') == 'awaiting_approval':
            context.user_data['pending_txn'] = result['unsigned_txn']
            context.user_data['state'] = 'transaction_password'
            context.user_data['transaction_type'] = 'send'
            
            log_security_event(user_id, "TRANSACTION_PENDING", f"Amount: {params['amount']} to {params['recipient']}")
            
            await update.message.reply_text(
                f"📝 **Transaction Confirmation Required**\n\n"
                f"💰 Amount: **{params['amount']} ALGO**\n"
                f"📍 To: `{params['recipient']}`\n"
                f"💸 Fee: ~0.001 ALGO\n\n"
                f"🔒 Enter your wallet password to confirm:",
                parse_mode="Markdown"
            )
        else:
            log_security_event(user_id, "TRANSACTION_COMPLETED", f"TxID: {result.get('txid', 'unknown')}")
            await update.message.reply_text(f"✅ {result['message']}")
    except Exception as e:
        logger.error(f"Transaction failed for user {user_id}: {e}")
        log_security_event(user_id, "TRANSACTION_FAILED", str(e))
        await update.message.reply_text("❌ Transaction failed. Please check your balance and try again.")

async def handle_transaction_password(update: Update, context: CallbackContext, password: str):
    """Handle transaction password with security checks"""
    user_id = update.effective_user.id
    
    try:
        pending_txn = context.user_data.get('pending_txn')
        transaction_type = context.user_data.get('transaction_type', 'send')
        
        if not pending_txn:
            await update.message.reply_text("❌ No pending transaction found.")
            context.user_data.clear()
            return
        
        signed_txn = sign_transaction(pending_txn, password=password, frontend='telegram')
        algod_client = get_algod_client()
        txid = algod_client.send_transaction(signed_txn)
        
        if transaction_type == 'nft':
            from algosdk.transaction import wait_for_confirmation
            confirmed_txn = wait_for_confirmation(algod_client, txid, 4)
            asset_id = confirmed_txn["asset-index"]
            
            log_security_event(user_id, "NFT_CREATED", f"Asset ID: {asset_id}, TxID: {txid}")
            
            await update.message.reply_text(
                f"✅ **NFT Created Successfully!**\n"
                f"🎨 Asset ID: `{asset_id}`\n"
                f"📄 Transaction ID: `{txid}`",
                parse_mode="Markdown"
            )
        else:
            log_security_event(user_id, "TRANSACTION_SIGNED", f"TxID: {txid}")
            
            await update.message.reply_text(
                f"✅ **Transaction Successful!**\n"
                f"📄 Transaction ID: `{txid}`",
                parse_mode="Markdown"
            )
        
        context.user_data.clear()
    except Exception as e:
        failed_attempts = context.user_data.get('failed_attempts', 0) + 1
        context.user_data['failed_attempts'] = failed_attempts
        
        logger.error(f"Transaction signing failed for user {user_id}: {e}")
        log_security_event(user_id, "TRANSACTION_SIGN_FAILED", f"Attempt {failed_attempts}")
        
        if failed_attempts >= MAX_PASSWORD_ATTEMPTS:
            context.user_data.clear()
            await update.message.reply_text("❌ Too many failed password attempts. Transaction cancelled.")
        else:
            await update.message.reply_text(f"❌ Incorrect password. {MAX_PASSWORD_ATTEMPTS - failed_attempts} attempts remaining.")

async def handle_nft_creation(update: Update, context: CallbackContext, params: dict):
    """Handle NFT creation with validation"""
    user_id = update.effective_user.id
    
    if not validate_session(user_id):
        await update.message.reply_text("❌ Please connect a wallet first!")
        return
    
    if 'name' not in params or not params['name']:
        await update.message.reply_text("❌ Missing NFT name. Example: 'Create NFT named Dragon'")
        return
    
    # Validate NFT name
    nft_name = sanitize_input(params['name'])
    if not nft_name or len(nft_name) < 1 or len(nft_name) > 50:
        await update.message.reply_text("❌ NFT name must be 1-50 characters long.")
        return
    
    sessions = load_sessions()
    user_session = sessions.get(str(user_id), {})
    
    try:
        algod_client = get_algod_client()
        result = create_nft(
            name=nft_name,
            unit_name=generate_unit_name(nft_name),
            total_supply=params.get('supply', 1),
            description=sanitize_input(params.get('description', "")),
            algod_client=algod_client,
            sender=user_session["address"],
            frontend='telegram'
        )
        
        if isinstance(result, dict) and result.get('status') == 'awaiting_approval':
            context.user_data['pending_txn'] = result['unsigned_txn']
            context.user_data['state'] = 'transaction_password'
            context.user_data['transaction_type'] = 'nft'
            
            log_security_event(user_id, "NFT_CREATION_PENDING", f"Name: {nft_name}")
            
            await update.message.reply_text(
                f"🎨 **NFT Creation Confirmation**\n\n"
                f"📛 Name: **{nft_name}**\n"
                f"📊 Supply: {params.get('supply', 1)}\n"
                f"📝 Description: {params.get('description', 'None')}\n"
                f"💸 Fee: ~0.001 ALGO\n\n"
                f"🔒 Enter your wallet password to create this NFT:",
                parse_mode="Markdown"
            )
        else:
            log_security_event(user_id, "NFT_CREATED", f"Asset ID: {result}")
            await update.message.reply_text(f"✅ NFT created! Asset ID: {result}")
    except Exception as e:
        logger.error(f"NFT creation failed for user {user_id}: {e}")
        log_security_event(user_id, "NFT_CREATION_FAILED", str(e))
        await update.message.reply_text("❌ Failed to create NFT. Please try again.")

async def handle_balance_check(update: Update, context: CallbackContext):
    """Check wallet balance securely"""
    user_id = update.effective_user.id
    
    if not validate_session(user_id):
        await update.message.reply_text("❌ Please connect a wallet first!")
        return
    
    sessions = load_sessions()
    user_session = sessions.get(str(user_id), {})
    
    try:
        algod_client = get_algod_client()
        account_info = algod_client.account_info(user_session["address"])
        balance = account_info.get("amount", 0) / 1_000_000
        
        log_security_event(user_id, "BALANCE_CHECKED")
        
        await update.message.reply_text(
            f"💰 **Wallet Balance**\n"
            f"Balance: **{balance:.6f} ALGO**",
            parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"Balance check failed for user {user_id}: {e}")
        await update.message.reply_text("❌ Failed to check balance. Please try again.")

async def handle_disconnect(update: Update, context: CallbackContext):
    """Disconnect wallet securely"""
    user_id = update.effective_user.id
    sessions = load_sessions()
    
    if str(user_id) in sessions:
        log_security_event(user_id, "WALLET_DISCONNECTED")
        del sessions[str(user_id)]
        save_sessions(sessions)
    
    context.user_data.clear()
    await update.message.reply_text("✅ Wallet disconnected securely")

async def handle_mnemonic_input(update: Update, context: CallbackContext, mnemonic: str):
    """Handle mnemonic input securely"""
    # Validate mnemonic format
    words = mnemonic.strip().split()
    if len(words) != 25:
        await update.message.reply_text("❌ Invalid mnemonic. Must be exactly 25 words.")
        return
    
    context.user_data['mnemonic'] = mnemonic
    context.user_data['state'] = 'connecting_password'
    await update.message.reply_text("🔒 Please set a password to secure this wallet:")

async def handle_connection_password(update: Update, context: CallbackContext, password: str):
    """Handle wallet connection password"""
    user_id = update.effective_user.id
    mnemonic = context.user_data.get('mnemonic')
    
    try:
        wallet_data = connect_wallet(mnemonic, password)
        sessions = load_sessions()
        sessions[str(user_id)] = {
            "address": wallet_data["address"],
            "encrypted_mnemonic": wallet_data["encrypted_mnemonic"],
            "connected_at": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat()
        }
        save_sessions(sessions)
        
        log_security_event(user_id, "WALLET_CONNECTED", f"Address: {wallet_data['address']}")
        
        await update.message.reply_text(
            f"✅ **Wallet Connected Successfully!**\n"
            f"📍 Address: `{wallet_data['address']}`",
            parse_mode="Markdown"
        )
        context.user_data.clear()
    except Exception as e:
        logger.error(f"Wallet connection failed for user {user_id}: {e}")
        log_security_event(user_id, "WALLET_CONNECTION_FAILED", str(e))
        await update.message.reply_text("❌ Failed to connect wallet. Please check your mnemonic and try again.")
        context.user_data.clear()

def main():
    """Start the bot with security logging"""
    if not BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not found in environment variables")
        return
    
    logger.info("Starting Algo-Intent Bot with enhanced security")
    security_logger.info("Bot started with public access enabled")
    
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    
    # Add handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    logger.info("🤖 Secure Bot started! Ready for public use.")
    application.run_polling()

if __name__ == "__main__":
    main()
