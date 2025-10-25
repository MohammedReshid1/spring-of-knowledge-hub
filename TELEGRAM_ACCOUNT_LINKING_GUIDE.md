# Telegram Account Linking Guide

## Quick Setup for Parents and Teachers

### Step 1: Start Chat with Bot

1. **Open Telegram** on your phone or desktop
2. **Search for:** `@SpringKnowledgeOTP_bot`
3. **Click "START"** button or send `/start`

You should see a response from the bot confirming it's ready.

---

### Step 2: Get Your Chat ID

After starting the chat, you can get your `chat_id` in two ways:

#### Option A: Automated Linking (Recommended)

Send this message to the bot:
```
/link +251933778687
```

The bot will:
- Verify your phone number
- Link your Telegram account
- Send you a confirmation message

#### Option B: Manual Linking (Developer)

1. **Get Bot Updates:**
```bash
curl -s "https://api.telegram.org/bot8356570860:AAEMK-pMzddf5lH9e-mTzACvRlDZ2Ln3IoU/getUpdates" | python3 -m json.tool | grep -A 5 "chat"
```

2. **Find your chat_id** in the response:
```json
{
  "chat": {
    "id": 123456789,
    "first_name": "Your Name",
    ...
  }
}
```

3. **Update Database:**
```javascript
// MongoDB shell
use spring_of_knowledge

db.parents.updateOne(
  { father_phone: "+251933778687" },
  { $set: { telegram_chat_id: 123456789 } }
)
```

Or for teachers:
```javascript
db.teachers.updateOne(
  { phone: "+251933778687" },
  { $set: { telegram_chat_id: 123456789 } }
)
```

---

### Step 3: Test OTP Delivery

Once linked, test the OTP delivery:

```bash
curl -X POST http://localhost:8000/auth/parent/request-otp \
  -H "Content-Type: application/json" \
  -d '{"identifier": "+251933778687", "role": "parent"}'
```

You should receive the OTP via Telegram!

---

## Current Bot Configuration

**Bot Token:** `8356570860:AAEMK-pMzddf5lH9e-mTzACvRlDZ2Ln3IoU`
**Bot Username:** `@SpringKnowledgeOTP_bot`
**Bot Name:** Spring of Knowledge Academy OTP Bot
**Status:** ✅ Active

---

## What Happens When Linked?

### When You Request OTP:

1. ✅ **Telegram Attempt:** System tries to send OTP via Telegram first
2. ✅ **Instant Delivery:** You receive the OTP in your Telegram chat
3. ✅ **Formatted Message:** Beautiful formatted message with:
   - 🎓 School branding
   - 🔐 OTP code (large, easy to read)
   - ⏰ Expiration time (5 minutes)
   - 🔒 Security reminder
   - ✨ Professional formatting

### Fallback Behavior:

If Telegram delivery fails:
- ⚠️ System automatically falls back to Email
- 📧 OTP sent to your registered email
- 🔄 Seamless user experience (no error)

---

## Example OTP Message (Telegram)

When you request an OTP, you'll receive:

```
🎓 Spring of Knowledge Academy

Hello Ahmed! 👋

Your One-Time Password (OTP) for login is:

🔐 123456

⏰ This code expires in 5 minutes
🔒 Do not share this code with anyone

If you didn't request this code, please ignore this message.

---
Powered by Spring of Knowledge Academy
```

---

## Troubleshooting

### "Telegram account not linked"

**Problem:** Getting email OTP instead of Telegram

**Solution:**
1. Verify you've started chat with `@SpringKnowledgeOTP_bot`
2. Check if `telegram_chat_id` is in your parent/teacher record:
   ```bash
   mongosh
   use spring_of_knowledge
   db.parents.findOne({father_phone: "+251933778687"})
   ```
3. Re-link your account using the steps above

---

### "Chat not found"

**Problem:** Bot can't send message

**Solution:**
1. Ensure you haven't blocked the bot
2. Verify you've sent at least one message to the bot
3. Try sending `/start` again

---

### "Bot token invalid"

**Problem:** Bot not responding

**Solution:**
1. Check `.env` file has correct `TELEGRAM_BOT_TOKEN`
2. Restart backend server to pick up new environment variables
3. Verify token with:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"
   ```

---

## Security Notes

✅ **Bot is secure:**
- Only sends OTP codes
- Never asks for passwords
- Uses end-to-end encryption (Telegram)
- Codes expire in 5 minutes

✅ **Privacy protected:**
- Bot cannot see other chats
- Only stores chat_id (not messages)
- Cannot join groups without permission

⚠️ **Important:**
- Never share your OTP code with anyone
- Bot will NEVER ask for your password
- If you receive unexpected OTPs, change your password immediately

---

## For Developers

### Check Bot Status
```bash
curl "https://api.telegram.org/bot8356570860:AAEMK-pMzddf5lH9e-mTzACvRlDZ2Ln3IoU/getMe"
```

### Get Recent Updates
```bash
curl "https://api.telegram.org/bot8356570860:AAEMK-pMzddf5lH9e-mTzACvRlDZ2Ln3IoU/getUpdates"
```

### Send Test Message
```bash
curl -X POST "https://api.telegram.org/bot8356570860:AAEMK-pMzddf5lH9e-mTzACvRlDZ2Ln3IoU/sendMessage" \
  -d "chat_id=YOUR_CHAT_ID&text=Test message"
```

---

## Next Steps

1. ✅ Start chat with bot
2. ✅ Link your account (get chat_id)
3. ✅ Test OTP delivery
4. ✅ Enjoy instant Telegram OTPs!

---

**Need Help?**
Contact system administrator or refer to `TELEGRAM_BOT_SETUP.md` for more details.
