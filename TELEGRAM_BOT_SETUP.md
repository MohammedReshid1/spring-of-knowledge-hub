# Telegram Bot Setup Guide for Spring of Knowledge Academy

This guide will help you create and configure a Telegram bot for sending OTP codes to parents and teachers.

## Step 1: Create a Telegram Bot

1. **Open Telegram** on your phone or desktop
2. **Search for `@BotFather`** (Official Telegram Bot for creating bots)
3. **Start a conversation** by clicking "START" or typing `/start`
4. **Create a new bot** by typing `/newbot`
5. **Follow the prompts:**
   - Bot name: `Spring of Knowledge Academy OTP Bot` (or any name you prefer)
   - Bot username: `SpringKnowledgeOTP_bot` (must end with `_bot`)

6. **Save the Bot Token** - BotFather will give you a token like:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890
   ```
   ⚠️ **IMPORTANT**: Keep this token secret! It's like a password.

## Step 2: Configure Bot Settings (Optional but Recommended)

1. **Set bot description:**
   ```
   /setdescription
   ```
   Then paste:
   ```
   Official Spring of Knowledge Academy bot for secure OTP delivery to parents and teachers.
   ```

2. **Set bot about text:**
   ```
   /setabouttext
   ```
   Then paste:
   ```
   Spring of Knowledge Academy - Secure OTP Authentication
   ```

3. **Set bot profile picture:**
   ```
   /setuserpic
   ```
   Upload your school logo

4. **Set bot commands:**
   ```
   /setcommands
   ```
   Then paste:
   ```
   start - Start the bot
   help - Get help information
   ```

## Step 3: Add Bot Token to Environment Variables

1. **Open your `.env` file** in the backend directory
2. **Add these lines:**
   ```env
   # Telegram Bot Configuration
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_BOT_ENABLED=true
   ```

3. **Replace `your_bot_token_here`** with the actual token from Step 1

## Step 4: Test Your Bot

1. **Search for your bot** in Telegram using the username you created
2. **Click START** or type `/start`
3. **You should see a welcome message** (once the backend is running)

## Environment Variables Reference

Add these to your `backend/.env` file:

```env
# Telegram Bot Settings
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890
TELEGRAM_BOT_ENABLED=true

# OTP Settings (already exists, just verify)
OTP_EXPIRE_MINUTES=5

# For development: log OTPs to console
ENVIRONMENT=development
```

## How OTP Delivery Works

### For Teachers and Parents:

1. **User Login:**
   - User enters phone number + password
   - System validates credentials
   - System generates 6-digit OTP

2. **OTP Delivery Priority:**
   - **Primary**: Send OTP via Telegram to user's phone number
   - **Fallback**: If user doesn't have Telegram, send OTP via email
   - **Notification**: User receives instant Telegram message with OTP code

3. **User Verification:**
   - User enters OTP from Telegram message
   - System verifies OTP
   - User is logged in successfully

## Phone Number Format

The system accepts both Ethiopian phone formats:
- **International**: `+251912345678`
- **Local**: `0912345678`

Both are automatically normalized to international format for Telegram delivery.

## Security Features

✅ **OTP Expiration**: OTPs expire after 5 minutes
✅ **Attempt Limiting**: Maximum 3 verification attempts per OTP
✅ **Rate Limiting**: Prevents OTP spam
✅ **Secure Storage**: OTPs are hashed in database
✅ **Auto Cleanup**: Expired OTPs are automatically deleted

## Troubleshooting

### Bot Not Responding?
- Check if `TELEGRAM_BOT_TOKEN` is set correctly in `.env`
- Restart the backend server after adding environment variables
- Verify the token with BotFather by typing `/mybots`

### OTP Not Received on Telegram?
- User must have Telegram installed
- User's phone number must match their account phone number
- System will automatically fallback to email if Telegram fails

### Testing in Development
- OTP codes are logged to console when `ENVIRONMENT=development`
- Check backend console logs for OTP codes during testing

## Additional Resources

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather Commands Reference](https://core.telegram.org/bots#6-botfather)

## Support

For issues with bot setup, contact:
- Technical Support: [Your support email]
- Telegram: [@YourSupportHandle]

---

**Last Updated**: January 2025
**Version**: 1.0
