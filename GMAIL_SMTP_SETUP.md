# Gmail SMTP Setup for OTP Authentication

This guide explains how to configure Gmail SMTP for sending OTP (One-Time Password) emails in the Spring of Knowledge Academy system.

## 📋 Overview

The system uses Gmail's SMTP service to send secure OTP codes to users for two-factor authentication. This setup requires either:
1. **Gmail App Passwords** (Recommended for production)
2. **OAuth2 Authentication** (Most secure, enterprise-grade)

## 🔐 Option 1: Gmail App Passwords (Recommended)

### Prerequisites
- Gmail account with 2-Step Verification enabled
- Access to Google Account settings

### Step-by-Step Setup

#### 1. Enable 2-Step Verification
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", click on **2-Step Verification**
3. Click **Get Started** and follow the setup process
4. **2-Step Verification is required** to generate App Passwords

#### 2. Generate an App Password
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", click on **App Passwords**
3. You may need to sign in again
4. Under "Select app", choose **Mail**
5. Under "Select device", choose **Other (Custom name)**
6. Enter a descriptive name like "Spring of Knowledge OTP"
7. Click **Generate**
8. **Copy the 16-character password immediately** - you won't see it again

#### 3. Configure Environment Variables
Add the following to your `.env` file:

```env
# Gmail SMTP Configuration
GMAIL_SMTP_SERVER=smtp.gmail.com
GMAIL_SMTP_PORT=587
GMAIL_EMAIL=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password

# OTP Configuration (Optional)
OTP_EXPIRE_MINUTES=5
```

**Important:**
- Use the exact 16-character password (including spaces)
- Never commit real passwords to version control
- Use a dedicated Gmail account for production

## 🔐 Option 2: OAuth2 Authentication (Enterprise)

For production environments requiring enhanced security, use OAuth2:

### Required Credentials
- **Client ID**: From Google Cloud Console
- **Client Secret**: From Google Cloud Console
- **Refresh Token**: Generated once per account

### Setup Instructions

#### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Gmail API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click **Enable**

#### 2. Create OAuth2 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Select **Web application**
4. Add authorized redirect URI: `http://localhost:8000/auth/google/callback`
5. Save the Client ID and Client Secret

#### 3. Generate Refresh Token
Use the OAuth2 Playground or a script to generate a refresh token:

```python
# Example script for generating refresh token
import requests
from urllib.parse import urlencode

# Replace with your actual credentials
CLIENT_ID = 'your-client-id'
CLIENT_SECRET = 'your-client-secret'
REDIRECT_URI = 'http://localhost:8000/auth/google/callback'

# Get authorization URL
auth_params = {
    'client_id': CLIENT_ID,
    'redirect_uri': REDIRECT_URI,
    'scope': 'https://www.googleapis.com/auth/gmail.send',
    'response_type': 'code',
    'access_type': 'offline',
    'prompt': 'consent'
}

auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(auth_params)}"
print(f"Visit this URL: {auth_url}")
print("After authorizing, copy the 'code' parameter from the redirect URL")

# Exchange code for refresh token (replace with actual code)
code = "code-from-redirect-url"
token_data = {
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET,
    'code': code,
    'grant_type': 'authorization_code',
    'redirect_uri': REDIRECT_URI
}

response = requests.post('https://oauth2.googleapis.com/token', data=token_data)
tokens = response.json()
print(f"Refresh Token: {tokens['refresh_token']}")
```

#### 4. Configure OAuth2 Environment Variables
```env
# OAuth2 Configuration
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GMAIL_EMAIL=your-gmail@gmail.com
```

## 🛡️ Security Best Practices

### Production Environment
1. **Use a dedicated Gmail account** for the application
2. **Enable 2-Step Verification** on the Gmail account
3. **Use App Passwords** instead of the main password
4. **Monitor email sending limits** (Gmail: ~100 emails/day for regular accounts)
5. **Implement rate limiting** in your application
6. **Use OAuth2** for enterprise applications

### Development Environment
1. **Use environment variables** for all credentials
2. **Never commit secrets** to version control
3. **Use test email addresses** during development
4. **Consider using a test SMTP service** like Mailtrap for testing

## 📧 Email Templates

The system includes pre-designed HTML email templates with:
- **Professional branding** with school colors and logo
- **Security notices** and best practices
- **Mobile-responsive design**
- **Clear OTP code presentation**
- **Expiration time information**

### Template Customization
You can customize email templates in `backend/app/utils/otp_service.py`:
- Modify colors, fonts, and styling
- Add school-specific branding
- Include additional security information
- Change email subject and content

## 🔧 Troubleshooting

### Common Issues

#### 1. "Authentication failed" Error
- Verify 2-Step Verification is enabled
- Check if App Password is correct (copy exactly as generated)
- Ensure Gmail account allows less secure apps if not using App Passwords

#### 2. "Connection timeout" Error
- Check SMTP server and port settings
- Verify firewall allows outbound SMTP connections
- Ensure correct SSL/TLS settings

#### 3. "Email not received" Error
- Check spam/junk folders
- Verify email address is correct
- Check Gmail sending limits
- Verify DNS records if using custom domain

#### 4. "Invalid credentials" Error
- Generate a new App Password
- Ensure correct Client ID/Secret for OAuth2
- Check if refresh token has expired

### Testing the Configuration

#### Test SMTP Connection
```python
# Test script for Gmail SMTP
import smtplib
from email.mime.text import MIMEText
import os

def test_gmail_smtp():
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()

        email = os.getenv('GMAIL_EMAIL')
        app_password = os.getenv('GMAIL_APP_PASSWORD')

        server.login(email, app_password)
        print("✅ Gmail SMTP connection successful!")

        # Send test email
        msg = MIMEText('This is a test email from Spring of Knowledge Academy')
        msg['Subject'] = 'Test Email'
        msg['From'] = email
        msg['To'] = email

        server.sendmail(email, email, msg.as_string())
        print("✅ Test email sent successfully!")

        server.quit()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_gmail_smtp()
```

## 📊 Gmail Limits and Considerations

### Sending Limits
- **Regular Gmail accounts**: ~100 emails/day
- **Google Workspace accounts**: Varies by plan (2,000+ emails/day)
- **Rate limiting**: 10-20 emails per minute

### Recommendations
1. **Monitor sending volume** to avoid hitting limits
2. **Implement retry logic** for failed sends
3. **Use Google Workspace** for higher volume needs
4. **Consider transactional email services** for production (SendGrid, Mailgun)

## 🚀 Production Deployment

### Environment Variables (Production)
```env
# Gmail SMTP Configuration
GMAIL_SMTP_SERVER=smtp.gmail.com
GMAIL_SMTP_PORT=587
GMAIL_EMAIL=noreply@your-school-domain.com
GMAIL_APP_PASSWORD=your-production-app-password

# OTP Configuration
OTP_EXPIRE_MINUTES=5

# Security
ENVIRONMENT=production
```

### Monitoring and Logging
1. **Monitor email delivery rates**
2. **Log OTP generation and verification**
3. **Track failed login attempts**
4. **Set up alerts for SMTP issues**
5. **Monitor Gmail API quota usage**

## 📞 Support

For additional help:
1. **Google Workspace Admin Guide**: [Link](https://support.google.com/a/answer/176600)
2. **Gmail API Documentation**: [Link](https://developers.google.com/gmail/api)
3. **Google OAuth2 Documentation**: [Link](https://developers.google.com/identity/protocols/oauth2)

---

**Security Reminder**: Never share your App Passwords or OAuth2 credentials. Store them securely as environment variables and rotate them regularly.