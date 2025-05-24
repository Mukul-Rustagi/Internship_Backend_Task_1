const mongoose = require('mongoose');

// Check if document is expired
const isDocumentExpired = (expiryDate) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    return today > expiry;
};

// Check if document is expiring soon (within days)
const isDocumentExpiringSoon = (expiryDate, days = 30) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days && diffDays > 0;
};

// Get days until expiry
const getDaysUntilExpiry = (expiryDate) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Check all documents for a vehicle
const checkVehicleDocuments = async (vehicleId) => {
    const Vehicle = mongoose.model('Vehicle');
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) return null;

    const documents = vehicle.documents;
    const status = {
        isExpired: false,
        expiringSoon: false,
        expiredDocuments: [],
        expiringSoonDocuments: []
    };

    // Check Registration Certificate
    if (documents.registrationCertificate) {
        const rc = documents.registrationCertificate;
        if (isDocumentExpired(rc.expiryDate)) {
            status.isExpired = true;
            status.expiredDocuments.push({
                type: 'registrationCertificate',
                expiryDate: rc.expiryDate,
                daysOverdue: -getDaysUntilExpiry(rc.expiryDate)
            });
        } else if (isDocumentExpiringSoon(rc.expiryDate)) {
            status.expiringSoon = true;
            status.expiringSoonDocuments.push({
                type: 'registrationCertificate',
                expiryDate: rc.expiryDate,
                daysUntilExpiry: getDaysUntilExpiry(rc.expiryDate)
            });
        }
    }

    // Check Permit
    if (documents.permit) {
        const permit = documents.permit;
        if (isDocumentExpired(permit.expiryDate)) {
            status.isExpired = true;
            status.expiredDocuments.push({
                type: 'permit',
                expiryDate: permit.expiryDate,
                daysOverdue: -getDaysUntilExpiry(permit.expiryDate)
            });
        } else if (isDocumentExpiringSoon(permit.expiryDate)) {
            status.expiringSoon = true;
            status.expiringSoonDocuments.push({
                type: 'permit',
                expiryDate: permit.expiryDate,
                daysUntilExpiry: getDaysUntilExpiry(permit.expiryDate)
            });
        }
    }

    // Check Pollution Certificate
    if (documents.pollutionCertificate) {
        const puc = documents.pollutionCertificate;
        if (isDocumentExpired(puc.expiryDate)) {
            status.isExpired = true;
            status.expiredDocuments.push({
                type: 'pollutionCertificate',
                expiryDate: puc.expiryDate,
                daysOverdue: -getDaysUntilExpiry(puc.expiryDate)
            });
        } else if (isDocumentExpiringSoon(puc.expiryDate)) {
            status.expiringSoon = true;
            status.expiringSoonDocuments.push({
                type: 'pollutionCertificate',
                expiryDate: puc.expiryDate,
                daysUntilExpiry: getDaysUntilExpiry(puc.expiryDate)
            });
        }
    }

    return status;
};

// Check all documents for a driver
const checkDriverDocuments = async (driverId) => {
    const Driver = mongoose.model('Driver');
    const driver = await Driver.findById(driverId);

    if (!driver) return null;

    const documents = driver.documents;
    const status = {
        isExpired: false,
        expiringSoon: false,
        expiredDocuments: [],
        expiringSoonDocuments: []
    };

    // Check Driving License
    if (documents.drivingLicense) {
        const dl = documents.drivingLicense;
        if (isDocumentExpired(dl.expiryDate)) {
            status.isExpired = true;
            status.expiredDocuments.push({
                type: 'drivingLicense',
                expiryDate: dl.expiryDate,
                daysOverdue: -getDaysUntilExpiry(dl.expiryDate)
            });
        } else if (isDocumentExpiringSoon(dl.expiryDate)) {
            status.expiringSoon = true;
            status.expiringSoonDocuments.push({
                type: 'drivingLicense',
                expiryDate: dl.expiryDate,
                daysUntilExpiry: getDaysUntilExpiry(dl.expiryDate)
            });
        }
    }

    // Check Address Proof
    if (documents.addressProof) {
        const address = documents.addressProof;
        if (isDocumentExpired(address.expiryDate)) {
            status.isExpired = true;
            status.expiredDocuments.push({
                type: 'addressProof',
                expiryDate: address.expiryDate,
                daysOverdue: -getDaysUntilExpiry(address.expiryDate)
            });
        } else if (isDocumentExpiringSoon(address.expiryDate)) {
            status.expiringSoon = true;
            status.expiringSoonDocuments.push({
                type: 'addressProof',
                expiryDate: address.expiryDate,
                daysUntilExpiry: getDaysUntilExpiry(address.expiryDate)
            });
        }
    }

    // Check Identity Proof
    if (documents.identityProof) {
        const identity = documents.identityProof;
        if (isDocumentExpired(identity.expiryDate)) {
            status.isExpired = true;
            status.expiredDocuments.push({
                type: 'identityProof',
                expiryDate: identity.expiryDate,
                daysOverdue: -getDaysUntilExpiry(identity.expiryDate)
            });
        } else if (isDocumentExpiringSoon(identity.expiryDate)) {
            status.expiringSoon = true;
            status.expiringSoonDocuments.push({
                type: 'identityProof',
                expiryDate: identity.expiryDate,
                daysUntilExpiry: getDaysUntilExpiry(identity.expiryDate)
            });
        }
    }

    return status;
};

module.exports = {
    isDocumentExpired,
    isDocumentExpiringSoon,
    getDaysUntilExpiry,
    checkVehicleDocuments,
    checkDriverDocuments
}; 