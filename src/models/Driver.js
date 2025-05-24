const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
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
    phone: {
        type: String,
        required: true,
        trim: true
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true
    },
    documents: {
        drivingLicense: {
            number: String,
            expiryDate: Date,
            documentUrl: String,
            isVerified: {
                type: Boolean,
                default: false
            }
        },
        addressProof: {
            type: String,
            documentUrl: String,
            isVerified: {
                type: Boolean,
                default: false
            }
        },
        identityProof: {
            type: String,
            documentUrl: String,
            isVerified: {
                type: Boolean,
                default: false
            }
        }
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
        default: 'INACTIVE'
    },
    assignedVehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        default: null
    },
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    totalTrips: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const Driver = mongoose.model('Driver', driverSchema);

module.exports = Driver; 