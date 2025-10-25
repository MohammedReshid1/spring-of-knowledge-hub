# 📱 Telegram Account Auto-Linking Guide

**Last Updated:** 2025-10-18
**Status:** ✅ Production Ready

---

## 🎯 Overview

This guide explains how parents and teachers can automatically link their Telegram accounts to receive instant OTP codes for secure login.

---

## 🚀 Quick Start (For Users)

### Step 1: Request Linking Code

1. **Log in** to your Spring of Knowledge Academy account
2. Go to **Account Settings**
3. Click **"Link Telegram Account"** button
4. You'll see a unique 8-character code (e.g., `ABC123XY`)

### Step 2: Open Telegram

**Option A: Click the Link (Recommended)**
- Click the provided Telegram link
- It will automatically open Telegram app
- Bot will auto-link your account

**Option B: Manual Linking**
1. Open Telegram on your phone/desktop
2. Search for `@SpringKnowledgeOTP_bot`
3. Send: `/start ABC123XY` (replace with your code)

### Step 3: Confirmation

You'll receive a success message:
```
🎉 Account Linked Successfully!

Hello Ahmed Test! 👋

Your Telegram account has been linked to your
Spring of Knowledge Academy account.

✅ What's Next?
• You'll now receive OTP codes via Telegram
• Instant delivery (no email delays!)
• Secure and encrypted
```

That's it! You're all set! 🎊

---

## 🔧 Technical Implementation

### Backend API Endpoints

#### 1. Generate Linking Token

**Endpoint:** `POST /telegram/generate-link-token`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request:**
```json
{
  "phone": "+251933778687"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Linking token generated successfully...",
  "linking_token": "ABC123XY",
  "telegram_link": "https://t.me/SpringKnowledgeOTP_bot?start=ABC123XY",
  "bot_username": "SpringKnowledgeOTP_bot",
  "expires_in_minutes": 15
}
```

#### 2. Check Link Status

**Endpoint:** `GET /telegram/link-status`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "linked": true,
  "message": "Telegram account is linked",
  "linked_at": "2025-10-18T10:35:57.591Z"
}
```

#### 3. Unlink Account

**Endpoint:** `DELETE /telegram/unlink`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Telegram account unlinked successfully"
}
```

---

## 🤖 Telegram Bot Commands

### `/start TOKEN`

Links your Telegram account using the provided token.

**Example:**
```
/start ABC123XY
```

**Response:**
```
🎉 Account Linked Successfully!
...
```

### `/start` (no token)

Shows welcome message and instructions.

**Response:**
```
🎓 Welcome to Spring of Knowledge Academy!
...
```

### `/help`

Shows bot commands and usage instructions.

---

## 🔒 Security Features

### Token Security

✅ **8-Character Random Tokens**
- Generated using cryptographically secure random
- Uses uppercase letters and digits only
- Excludes confusing characters (0, O, I, 1)
- Example: `ABC123XY`, `P7R4M9QZ`

✅ **15-Minute Expiration**
- Tokens expire after 15 minutes
- Must be used within this window
- Expired tokens cannot be reused

✅ **Single-Use Tokens**
- Each token can only be used once
- Marked as "used" after successful linking
- Cannot be reused even if within expiration window

### Privacy Protection

✅ **Secure Storage**
- Only `chat_id` is stored (not messages)
- Telegram username stored optionally
- No access to other Telegram data

✅ **Encrypted Communication**
- All Telegram messages are end-to-end encrypted
- OTP codes never exposed to third parties
- Secure HTTPS for API calls

---

## 📊 Database Schema

### Telegram Linking Tokens Collection

```javascript
{
  _id: ObjectId("..."),
  token: "ABC123XY",
  phone: "+251933778687",
  role: "parent", // or "teacher"
  used: false,
  expires_at: ISODate("2025-10-18T11:00:00.000Z"),
  created_at: ISODate("2025-10-18T10:45:00.000Z"),
  // After linking:
  used_at: ISODate("2025-10-18T10:50:00.000Z"),
  chat_id: 957359467
}
```

### Parent Collection (Updated)

```javascript
{
  _id: ObjectId("..."),
  father_name: "Ahmed Test",
  father_phone: "+251933778687",
  father_email: "ahmed.test@example.com",
  // Telegram fields:
  telegram_chat_id: 957359467,
  telegram_linked_at: ISODate("2025-10-18T10:50:00.000Z"),
  telegram_username: "ahmed_aay",
  telegram_first_name: "Ahmed",
  // ... other fields
}
```

### Teacher Collection (Updated)

```javascript
{
  _id: ObjectId("..."),
  first_name: "Sarah",
  last_name: "Smith",
  phone: "+251945678901",
  email: "sarah.teacher@example.com",
  // Telegram fields:
  telegram_chat_id: 123456789,
  telegram_linked_at: ISODate("2025-10-18T10:50:00.000Z"),
  telegram_username: "sarah_smith",
  telegram_first_name: "Sarah",
  // ... other fields
}
```

---

## 🎨 Frontend Implementation

### Example UI Component (React)

```typescript
import React, { useState } from 'react';
import { Button, Input, Card, Alert } from '@/components/ui';

export const TelegramLinking: React.FC = () => {
  const [linkingCode, setLinkingCode] = useState('');
  const [telegramLink, setTelegramLink] = useState('');
  const [isLinked, setIsLinked] = useState(false);
  const [loading, setLoading] = useState(false);

  const generateLinkingCode = async () => {
    setLoading(true);
    try {
      const response = await fetch('/telegram/generate-link-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: user.phone // Get from auth context
        })
      });

      const data = await response.json();

      if (data.success) {
        setLinkingCode(data.linking_token);
        setTelegramLink(data.telegram_link);
      }
    } catch (error) {
      console.error('Failed to generate linking code:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkLinkStatus = async () => {
    try {
      const response = await fetch('/telegram/link-status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const data = await response.json();
      setIsLinked(data.linked);
    } catch (error) {
      console.error('Failed to check link status:', error);
    }
  };

  return (
    <Card>
      <h3>Telegram OTP Delivery</h3>

      {!isLinked ? (
        <>
          <Button onClick={generateLinkingCode} disabled={loading}>
            Link Telegram Account
          </Button>

          {linkingCode && (
            <div className="mt-4">
              <Alert type="success">
                <p>Your linking code:</p>
                <code className="text-2xl font-bold">{linkingCode}</code>
                <p className="mt-2">Expires in 15 minutes</p>
              </Alert>

              <div className="mt-4">
                <p><strong>Option 1 (Recommended):</strong></p>
                <a
                  href={telegramLink}
                  target="_blank"
                  className="btn btn-primary"
                >
                  Open Telegram & Link Account
                </a>

                <p className="mt-4"><strong>Option 2 (Manual):</strong></p>
                <ol>
                  <li>Open Telegram</li>
                  <li>Search for: @SpringKnowledgeOTP_bot</li>
                  <li>Send: /start {linkingCode}</li>
                </ol>
              </div>

              <Button
                onClick={checkLinkStatus}
                className="mt-4"
              >
                Check if Linked
              </Button>
            </div>
          )}
        </>
      ) : (
        <Alert type="success">
          ✅ Telegram account is linked!
          You'll receive OTP codes via Telegram.
        </Alert>
      )}
    </Card>
  );
};
```

---

## 🧪 Testing the Integration

### Test 1: Generate Linking Code

```bash
curl -X POST http://localhost:8000/telegram/generate-link-token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+251933778687"}'
```

**Expected Response:**
```json
{
  "success": true,
  "linking_token": "ABC123XY",
  "telegram_link": "https://t.me/SpringKnowledgeOTP_bot?start=ABC123XY"
}
```

### Test 2: Link via Telegram

1. Copy the `telegram_link` from response
2. Open in browser or Telegram app
3. Bot sends `/start ABC123XY` automatically
4. Receive confirmation message

### Test 3: Verify Linking

```bash
curl http://localhost:8000/telegram/link-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "linked": true,
  "message": "Telegram account is linked"
}
```

### Test 4: Test OTP Delivery

```bash
curl -X POST http://localhost:8000/auth/parent/request-otp \
  -H "Content-Type: application/json" \
  -d '{"identifier": "+251933778687", "role": "parent"}'
```

**Expected:**
- OTP sent via Telegram ✅
- Message received in bot chat ✅

---

## 🐛 Troubleshooting

### Issue 1: "Invalid or expired linking token"

**Causes:**
- Token expired (15 minutes)
- Token already used
- Wrong token entered

**Solution:**
- Generate a new linking code
- Use it within 15 minutes
- Double-check the code

### Issue 2: Bot doesn't respond

**Causes:**
- Bot not running
- Bot token invalid
- Network issues

**Solution:**
1. Check bot status:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getMe"
   ```
2. Restart bot service
3. Verify token in `.env` file

### Issue 3: "Failed to link account"

**Causes:**
- Phone number mismatch
- Database connection issue
- Account not found

**Solution:**
1. Verify phone number in database
2. Check MongoDB connection
3. Ensure account exists in parents/teachers collection

---

## 📱 Running the Telegram Bot

### Option 1: Standalone Bot Service

```bash
cd backend
python3 -m app.utils.telegram_bot_handler
```

**Output:**
```
🤖 Telegram bot started - listening for commands...
```

### Option 2: Integrated with FastAPI (Future)

Add to `main.py`:
```python
from .utils.telegram_bot_handler import run_telegram_bot
import asyncio

@app.on_event("startup")
async def startup_event():
    # Start Telegram bot in background
    asyncio.create_task(run_telegram_bot())
```

---

## 🚀 Production Deployment

### Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=8356570860:AAEMK-pMzddf5lH9e-mTzACvRlDZ2Ln3IoU
TELEGRAM_BOT_ENABLED=true

# Database
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=spring_of_knowledge
```

### Systemd Service (Linux)

Create `/etc/systemd/system/telegram-bot.service`:

```ini
[Unit]
Description=Spring of Knowledge Telegram Bot
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/backend
ExecStart=/usr/bin/python3 -m app.utils.telegram_bot_handler
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable telegram-bot
sudo systemctl start telegram-bot
sudo systemctl status telegram-bot
```

---

## 📈 Analytics & Monitoring

### Track Linking Success Rate

```javascript
// MongoDB aggregation
db.telegram_linking_tokens.aggregate([
  {
    $group: {
      _id: "$used",
      count: { $sum: 1 }
    }
  }
])
```

### Monitor Active Links

```javascript
// Get linked accounts
db.parents.countDocuments({ telegram_chat_id: { $exists: true } })
db.teachers.countDocuments({ telegram_chat_id: { $exists: true } })
```

---

## 🎉 Success Metrics

The auto-linking system is successful when:

✅ Users can generate linking codes easily
✅ Telegram deep links open automatically
✅ Bot responds within seconds
✅ Accounts link successfully
✅ OTP delivery works immediately after linking
✅ Token expiration works correctly
✅ Security measures prevent abuse

---

## 📚 Related Documentation

- **Telegram OTP Integration:** `TELEGRAM_OTP_INTEGRATION_SUCCESS.md`
- **Bot Setup:** `TELEGRAM_BOT_SETUP.md`
- **Manual Linking:** `TELEGRAM_ACCOUNT_LINKING_GUIDE.md`
- **API Testing:** `TEST_RESULTS_PARENT_TEACHER_AUTH.md`

---

**Last Updated:** 2025-10-18
**Status:** ✅ Production Ready
**Tested:** ✅ Yes
