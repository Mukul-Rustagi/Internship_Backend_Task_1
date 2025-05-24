const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const vendorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    vendorType: {
        type: String,
        enum: ['SUPER', 'REGIONAL', 'CITY', 'SUB', 'LOCAL'],
        required: true
    },
    parentVendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        default: null
    },
    permissions: [{
        type: String,
        enum: [
            'ALL',
            'FLEET_MANAGEMENT',
            'DRIVER_MANAGEMENT',
            'PAYMENT_PROCESSING',
            'COMPLIANCE_TRACKING',
            'DOCUMENT_VERIFICATION',
            'REPORT_GENERATION',
            'USER_MANAGEMENT',
            'SETTINGS_MANAGEMENT'
        ]
    }],
    operatingArea: {
        city: {
            type: String,
            trim: true
        },
        zones: [{
            type: String,
            trim: true
        }],
        pincodes: [{
            type: String,
            trim: true
        }]
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Hash password before saving
vendorSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
vendorSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const Vendor = mongoose.model('Vendor', vendorSchema);

module.exports = Vendor;
