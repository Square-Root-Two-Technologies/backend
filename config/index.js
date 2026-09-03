module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  mongoUri: process.env.DATABASE,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  mailjet: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  salesforce: {
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    callbackUrl: process.env.SALESFORCE_CALLBACK_URL,
    // 32-byte hex key used to encrypt stored access/refresh tokens at rest.
    // Generate once with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    tokenEncryptionKey: process.env.SALESFORCE_TOKEN_ENCRYPTION_KEY,
  },
};
