const nodemailer = require('nodemailer');
const Document = require('../models/Document');
const Vendor = require('../models/Vendor');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const logger = require('../config/logger');

class NotificationService {
    constructor() {
        this.transporter = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_PASS
                }
            });

            // Verify connection
            await this.transporter.verify();
            this.isInitialized = true;
            logger.info('Notification service initialized');
        } catch (error) {
            logger.error('Notification service initialization failed:', error);
            throw error;
        }
    }

    isInitialized() {
        return this.isInitialized;
    }

    async sendEmail(to, subject, text, html) {
        try {
            if (!this.isInitialized) {
                throw new Error('Notification service not initialized');
            }

            const mailOptions = {
                from: process.env.GMAIL_USER,
                to,
                subject,
                text,
                html
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info('Email sent:', info.messageId);
            return true;
        } catch (error) {
            logger.error('Email sending failed:', error);
            return false;
        }
    }

    async sendDocumentExpiryNotification({ vendorId, documentType, expiryDate }) {
        try {
            const subject = `Document Expiry Alert: ${documentType}`;
            const text = `Your ${documentType} is expiring on ${expiryDate}. Please renew it soon.`;
            const html = `
                <h2>Document Expiry Alert</h2>
                <p>Your ${documentType} is expiring on ${expiryDate}.</p>
                <p>Please renew it soon to maintain compliance.</p>
            `;

            return await this.sendEmail(
                process.env.GMAIL_USER, // Replace with vendor's email
                subject,
                text,
                html
            );
        } catch (error) {
            logger.error('Document expiry notification failed:', error);
            return false;
        }
    }

    async sendAssignmentNotification({ vehicleId, driverId, type }) {
        try {
            const subject = `Vehicle-Driver Assignment: ${type}`;
            const text = `Vehicle ${vehicleId} has been ${type.toLowerCase()} to driver ${driverId}.`;
            const html = `
                <h2>Vehicle-Driver Assignment</h2>
                <p>Vehicle ${vehicleId} has been ${type.toLowerCase()} to driver ${driverId}.</p>
            `;

            return await this.sendEmail(
                process.env.GMAIL_USER, // Replace with vendor's email
                subject,
                text,
                html
            );
        } catch (error) {
            logger.error('Assignment notification failed:', error);
            return false;
        }
    }

    async sendVerificationNotification({ documentId, status, remarks }) {
        try {
            const subject = `Document Verification: ${status}`;
            const text = `Document ${documentId} has been ${status.toLowerCase()}. Remarks: ${remarks}`;
            const html = `
                <h2>Document Verification</h2>
                <p>Document ${documentId} has been ${status.toLowerCase()}.</p>
                <p>Remarks: ${remarks}</p>
            `;

            return await this.sendEmail(
                process.env.GMAIL_USER, // Replace with vendor's email
                subject,
                text,
                html
            );
        } catch (error) {
            logger.error('Verification notification failed:', error);
            return false;
        }
    }

    async sendWelcomeNotification({ vendorId, email }) {
        try {
            const subject = 'Welcome to Fleet Management System';
            const text = `Welcome to our Fleet Management System. Your vendor ID is ${vendorId}.`;
            const html = `
                <h2>Welcome to Fleet Management System</h2>
                <p>Welcome to our Fleet Management System.</p>
                <p>Your vendor ID is ${vendorId}.</p>
            `;

            return await this.sendEmail(
                email,
                subject,
                text,
                html
            );
        } catch (error) {
            logger.error('Welcome notification failed:', error);
            return false;
        }
    }

    static async checkAndNotifyExpiringDocuments(daysThreshold = 30) {
        try {
            const now = new Date();
            const thresholdDate = new Date(now);
            thresholdDate.setDate(now.getDate() + daysThreshold);

            const expiringDocuments = await Document.find({
                expiryDate: {
                    $gte: now,
                    $lte: thresholdDate
                },
                status: 'ACTIVE'
            }).populate('vendor');

            logger.info('Found expiring documents', {
                count: expiringDocuments.length,
                daysThreshold
            });

            const notificationResults = await Promise.all(
                expiringDocuments.map(doc => this.sendDocumentExpiryNotification(doc, doc.vendor))
            );

            const successCount = notificationResults.filter(result => result).length;
            logger.info('Document expiry notifications sent', {
                total: expiringDocuments.length,
                successCount,
                failedCount: expiringDocuments.length - successCount
            });

            return {
                total: expiringDocuments.length,
                sent: successCount,
                failed: expiringDocuments.length - successCount
            };
        } catch (error) {
            logger.error('Error checking and notifying expiring documents', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    static async sendBulkNotification(vendorIds, subject, message) {
        try {
            const vendors = await Vendor.find({ _id: { $in: vendorIds } });

            logger.info('Preparing bulk notification', {
                vendorCount: vendors.length,
                subject
            });

            const mailOptions = {
                from: process.env.GMAIL_USER,
                bcc: vendors.map(vendor => vendor.email),
                subject: subject,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1976d2;">${subject}</h2>
                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            ${message}
                        </div>
                        <hr style="border: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            logger.info('Bulk notification sent successfully', {
                vendorCount: vendors.length,
                subject
            });
            return true;
        } catch (error) {
            logger.error('Error sending bulk notification', {
                error: error.message,
                stack: error.stack,
                vendorCount: vendorIds.length,
                subject
            });
            return false;
        }
    }

    async checkAndNotifyExpiringDocuments() {
        try {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            // Check vehicle documents
            const vehiclesWithExpiringDocs = await Vehicle.find({
                'documents.expiryDate': { $lte: thirtyDaysFromNow }
            }).populate('vendor');

            for (const vehicle of vehiclesWithExpiringDocs) {
                for (const [docType, doc] of Object.entries(vehicle.documents)) {
                    if (new Date(doc.expiryDate) <= thirtyDaysFromNow) {
                        await this.sendDocumentExpiryNotification(
                            doc,
                            vehicle.vendor
                        );
                    }
                }
            }

            // Check driver documents
            const driversWithExpiringDocs = await Driver.find({
                'documents.expiryDate': { $lte: thirtyDaysFromNow }
            }).populate('vendor');

            for (const driver of driversWithExpiringDocs) {
                for (const [docType, doc] of Object.entries(driver.documents)) {
                    if (new Date(doc.expiryDate) <= thirtyDaysFromNow) {
                        await this.sendDocumentExpiryNotification(
                            doc,
                            driver.vendor
                        );
                    }
                }
            }
        } catch (error) {
            logger.error('Error checking expiring documents:', {
                error: error.message,
                stack: error.stack
            });
        }
    }
}

module.exports = new NotificationService(); 