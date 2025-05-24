const nodemailer = require('nodemailer');
const logger = require('./logger');
require('dotenv').config();

// Debug: Check if environment variables are loaded
logger.info('Email Configuration Check:', {
    gmailUserExists: !!process.env.GMAIL_USER,
    gmailAppPasswordExists: !!process.env.GMAIL_APP_PASSWORD
});

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    logger.error('Missing required email configuration', {
        requiredVariables: ['GMAIL_USER', 'GMAIL_APP_PASSWORD']
    });
}

// Create a transporter using Gmail
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    },
    tls: {
        rejectUnauthorized: false // Only use this in development
    }
});

// Verify transporter connection
transporter.verify((error, success) => {
    if (error) {
        logger.error('Email configuration error', {
            error: error.message,
            stack: error.stack,
            code: error.code
        });
        logger.error('Please ensure:');
        logger.error('1. Your .env file exists in the project root');
        logger.error('2. GMAIL_USER and GMAIL_APP_PASSWORD are set correctly');
        logger.error('3. You have enabled 2-Step Verification in your Google Account');
        logger.error('4. You have generated an App Password for this application');
    } else {
        logger.info('Email server is ready to send messages');
    }
});

module.exports = transporter; 