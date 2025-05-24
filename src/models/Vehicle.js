const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    registrationNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    model: {
        type: String,
        required: true,
        trim: true
    },
    seatingCapacity: {
        type: Number,
        required: true
    },
    fuelType: {
        type: String,
        enum: ['PETROL', 'DIESEL', 'CNG', 'ELECTRIC'],
        required: true
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true
    },
    documents: {
        registrationCertificate: {
            number: String,
            expiryDate: Date,
            documentUrl: String,
            isVerified: {
                type: Boolean,
                default: false
            }
        },
        permit: {
            number: String,
            expiryDate: Date,
            documentUrl: String,
            isVerified: {
                type: Boolean,
                default: false
            }
        },
        pollutionCertificate: {
            number: String,
            expiryDate: Date,
            documentUrl: String,
            isVerified: {
                type: Boolean,
                default: false
            }
        }
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'SUSPENDED'],
        default: 'INACTIVE'
    },
    assignedDriver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        default: null
    }
}, {
    timestamps: true
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle; 