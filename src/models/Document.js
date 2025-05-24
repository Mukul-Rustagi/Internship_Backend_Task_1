const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    entityType: {
        type: String,
        required: true,
        enum: ['VEHICLE', 'DRIVER', 'VENDOR']
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'entityType'
    },
    documentType: {
        type: String,
        required: true
    },
    documentNumber: {
        type: String,
        required: true
    },
    documentUrl: {
        type: String,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationRemarks: {
        type: String
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor'
    },
    verifiedAt: {
        type: Date
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'EXPIRED', 'PENDING_VERIFICATION'],
        default: 'PENDING_VERIFICATION'
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Indexes for better query performance
documentSchema.index({ entityType: 1, entityId: 1 });
documentSchema.index({ vendor: 1 });
documentSchema.index({ expiryDate: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ isVerified: 1 });

// Pre-save middleware to update status based on expiry date
documentSchema.pre('save', function (next) {
    const now = new Date();
    if (this.expiryDate < now) {
        this.status = 'EXPIRED';
    } else if (this.isVerified) {
        this.status = 'ACTIVE';
    } else {
        this.status = 'PENDING_VERIFICATION';
    }
    next();
});

// Static method to find expiring documents
documentSchema.statics.findExpiringDocuments = function (daysThreshold = 30) {
    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setDate(now.getDate() + daysThreshold);

    return this.find({
        expiryDate: {
            $gte: now,
            $lte: thresholdDate
        },
        status: 'ACTIVE'
    }).populate('vendor', 'name email');
};

// Static method to find expired documents
documentSchema.statics.findExpiredDocuments = function () {
    const now = new Date();
    return this.find({
        expiryDate: { $lt: now },
        status: { $ne: 'EXPIRED' }
    }).populate('vendor', 'name email');
};

// Static method to get document compliance report
documentSchema.statics.getComplianceReport = async function (vendorId) {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const [total, verified, expired, expiringSoon] = await Promise.all([
        this.countDocuments({ vendor: vendorId }),
        this.countDocuments({ vendor: vendorId, isVerified: true, status: 'ACTIVE' }),
        this.countDocuments({ vendor: vendorId, status: 'EXPIRED' }),
        this.countDocuments({
            vendor: vendorId,
            expiryDate: { $lte: thirtyDaysFromNow, $gt: now },
            status: 'ACTIVE'
        })
    ]);

    return {
        total,
        verified,
        expired,
        expiringSoon,
        complianceRate: total > 0 ? (verified / total) * 100 : 0
    };
};

const Document = mongoose.model('Document', documentSchema);

module.exports = Document; 