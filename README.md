# Fleet Management System Backend

A comprehensive backend system for managing fleet operations, including vendor management, vehicle tracking, driver management, and document compliance.

## Features

### 1. Vendor Management
- Hierarchical vendor structure (Super, City, Sub, Local)
- Role-based access control with granular permissions
- Vendor registration and authentication
- Profile management and dashboard
- Operating area management
- Vendor status management

### 2. Vehicle Management
- Vehicle registration and tracking
- Document management (RC, permit, insurance)
- Vehicle status tracking
- Driver assignment
- Document expiry monitoring
- Vehicle type and model management

### 3. Driver Management
- Driver registration and profile management
- Document management (license, address proof, ID proof)
- Vehicle assignment
- Performance tracking
- Document expiry monitoring
- Driver status management

### 4. Document Management
- Document upload and verification
- Expiry tracking and notifications
- Compliance reporting
- Document status monitoring
- Automated expiry checks

### 5. Dashboard & Analytics
- Fleet statistics
- Document compliance status
- Active/Inactive counts
- Revenue tracking (to be implemented)
- Trip management (to be implemented)

### 6. System Monitoring
- Performance monitoring
- Resource monitoring
- Error tracking
- API statistics
- System health checks

## Technical Stack

- **Framework:** Node.js with Express
- **Database:** MongoDB
- **Cache:** Redis
- **Authentication:** JWT
- **Email:** Nodemailer with Gmail
- **Logging:** Winston
- **Scheduling:** Node-cron
- **File Storage:** AWS S3 (to be implemented)

## Service Documentation

### 1. Authentication Service
```javascript
// Usage Example
const authService = require('./services/authService');

// Register a new vendor
await authService.registerVendor({
  name: 'Vendor Name',
  email: 'vendor@example.com',
  password: 'securePassword',
  vendorType: 'CITY',
  permissions: ['FLEET_MANAGEMENT', 'DRIVER_MANAGEMENT']
});

// Login
const { token, vendor } = await authService.loginVendor({
  email: 'vendor@example.com',
  password: 'securePassword'
});
```

### 2. Cache Service
```javascript
// Usage Example
const cacheService = require('./services/cacheService');

// Set cache
await cacheService.set('key', value, 3600); // 1 hour expiry

// Get cache
const value = await cacheService.get('key');

// Delete cache
await cacheService.del('key');

// Clear cache by pattern
await cacheService.clearByPattern('pattern*');
```

### 3. Notification Service
```javascript
// Usage Example
const notificationService = require('./services/notificationService');

// Send document expiry notification
await notificationService.sendDocumentExpiryNotification({
  vendorId: 'vendor_id',
  documentType: 'drivingLicense',
  expiryDate: '2024-12-31'
});

// Check and notify expiring documents
await notificationService.checkAndNotifyExpiringDocuments(30); // 30 days threshold
```

### 4. Scheduler Service
```javascript
// Usage Example
const schedulerService = require('./services/schedulerService');

// Start all scheduled jobs
await schedulerService.startAllJobs();

// Schedule a new job
await schedulerService.scheduleJob('jobName', '0 0 * * *', async () => {
  // Job logic
});

// Stop a job
await schedulerService.stopJob('jobName');
```

### 5. Document Service
```javascript
// Usage Example
const documentService = require('./services/documentService');

// Upload document
await documentService.uploadDocument({
  entityType: 'DRIVER',
  entityId: 'driver_id',
  documentType: 'drivingLicense',
  file: fileBuffer
});

// Verify document
await documentService.verifyDocument({
  documentId: 'document_id',
  status: 'VERIFIED',
  remarks: 'Document verified'
});
```

## API Documentation

Detailed API documentation is available in `api.txt`. The API follows RESTful principles and includes:

- Authentication endpoints
- Vendor management endpoints
- Vehicle management endpoints
- Driver management endpoints
- Document management endpoints
- Dashboard and analytics endpoints

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   PORT=3000
   MONGODB_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   REDIS_URL=your_redis_url
   GMAIL_USER=your_gmail
   GMAIL_PASS=your_app_specific_password
   ```
4. Start the server:
   ```bash
   npm start
   ```

## Project Structure

```
src/
├── config/         # Configuration files
│   ├── database.js    # MongoDB configuration
│   ├── redis.js       # Redis configuration
│   ├── email.js       # Email configuration
│   └── logger.js      # Winston logger configuration
├── controllers/    # Route controllers
│   ├── vendorController.js
│   ├── vehicleController.js
│   ├── driverController.js
│   └── documentController.js
├── middleware/     # Custom middleware
│   ├── auth.js        # Authentication middleware
│   ├── error.js       # Error handling middleware
│   └── validation.js  # Request validation middleware
├── models/         # Database models
│   ├── Vendor.js
│   ├── Vehicle.js
│   ├── Driver.js
│   └── Document.js
├── routes/         # API routes
│   ├── vendorRoutes.js
│   ├── vehicleRoutes.js
│   ├── driverRoutes.js
│   └── documentRoutes.js
├── services/       # Business logic
│   ├── authService.js
│   ├── cacheService.js
│   ├── notificationService.js
│   ├── schedulerService.js
│   └── documentService.js
├── utils/          # Utility functions
│   ├── errors.js      # Custom error classes
│   ├── validators.js  # Validation utilities
│   └── helpers.js     # Helper functions
└── app.js          # Application entry point
```

## Key Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Permission-based authorization
- Secure password handling

### Caching
- Redis-based caching for frequently accessed data
- Cache invalidation on updates
- Configurable cache expiration

### Logging
- Winston logger implementation
- Different log levels (error, warn, info, debug)
- File-based logging
- Request logging with Morgan

### Scheduled Tasks
- Daily document expiry checks
- Weekly compliance report generation
- Weekly document cleanup
- Automated notifications

### Error Handling
- Centralized error handling
- Custom error classes
- Detailed error logging
- Client-friendly error responses

### Security
- Input sanitization
- Rate limiting
- CORS configuration
- Helmet security headers
- XSS protection
- MongoDB query sanitization

## Development

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Redis
- Gmail account for notifications

### Development Setup
1. Install development dependencies:
   ```bash
   npm install --save-dev nodemon
   ```
2. Start development server:
   ```bash
   npm run dev
   ```

### Testing
- Unit tests (to be implemented)
- Integration tests (to be implemented)
- API tests (to be implemented)

## Deployment

### Production Setup
1. Set environment variables
2. Configure logging
3. Set up monitoring
4. Configure SSL
5. Set up backup strategy

### Deployment Checklist
- [ ] Environment variables configured
- [ ] Database connection secured
- [ ] Redis connection configured
- [ ] Email service configured
- [ ] Logging configured
- [ ] Security measures in place
- [ ] SSL certificate installed
- [ ] Backup strategy implemented

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@example.com or create an issue in the repository.

## Service Architecture

### 1. Authentication Service (`authService.js`)
**Purpose**: Handles user authentication and authorization
**Why**: Ensures secure access to the system and protects sensitive data
**Example**:
```javascript
// Register a new vendor
const vendor = await authService.registerVendor({
  name: 'City Fleet Manager',
  email: 'city@example.com',
  password: 'securePassword',
  vendorType: 'CITY'
});

// Login and get JWT token
const { token, vendor } = await authService.loginVendor({
  email: 'city@example.com',
  password: 'securePassword'
});
```

### 2. Cache Service (`cacheService.js`)
**Purpose**: Manages Redis caching for improved performance
**Why**: Reduces database load and improves response times for frequently accessed data
**Example**:
```javascript
// Cache vehicle list for a vendor
await cacheService.set('vehicles:vendor:123', vehicles, 3600);

// Get cached vehicles
const vehicles = await cacheService.get('vehicles:vendor:123');

// Clear cache when data changes
await cacheService.clearByPattern('vehicles:vendor:*');
```

### 3. Notification Service (`notificationService.js`)
**Purpose**: Handles system notifications and alerts
**Why**: Keeps users informed about important events and document expirations
**Example**:
```javascript
// Send document expiry notification
await notificationService.sendDocumentExpiryNotification({
  vendorId: 'vendor_123',
  documentType: 'drivingLicense',
  expiryDate: '2024-12-31'
});

// Check and notify expiring documents
await notificationService.checkAndNotifyExpiringDocuments(30);
```

### 4. Scheduler Service (`schedulerService.js`)
**Purpose**: Manages automated tasks and periodic jobs
**Why**: Automates routine tasks and ensures timely execution of maintenance jobs
**Example**:
```javascript
// Start all scheduled jobs
await schedulerService.startAllJobs();

// Schedule document check
await schedulerService.scheduleJob('documentCheck', '0 0 * * *', async () => {
  await notificationService.checkAndNotifyExpiringDocuments(30);
});
```

### 5. Document Service (`documentService.js`)
**Purpose**: Handles document upload, verification, and management
**Why**: Centralizes document handling and ensures proper verification
**Example**:
```javascript
// Upload driver document
await documentService.uploadDocument({
  entityType: 'DRIVER',
  entityId: 'driver_123',
  documentType: 'drivingLicense',
  file: fileBuffer
});

// Verify document
await documentService.verifyDocument({
  documentId: 'doc_123',
  status: 'VERIFIED',
  remarks: 'Document verified'
});
```

### 6. Monitoring Service (`monitoringService.js`)
**Purpose**: Tracks system performance and health metrics
**Why**: Provides insights into system behavior and helps identify issues early
**Example**:
```javascript
// Track API request
monitoringService.trackRequest(req, res, next);

// Get system metrics
const metrics = await monitoringService.getSystemMetrics();
console.log('System Health:', metrics);
```

## Service Integration Examples

### 1. Vehicle Assignment Flow
```javascript
// Example: Assign driver to vehicle
const vehicleService = require('./services/vehicleService');
const driverService = require('./services/driverService');
const notificationService = require('./services/notificationService');

async function assignDriverToVehicle(vehicleId, driverId) {
  // Assign driver
  const assignment = await vehicleService.assignDriver(vehicleId, driverId);
  
  // Clear relevant caches
  await cacheService.clearByPattern(`vehicle:${vehicleId}`);
  await cacheService.clearByPattern(`driver:${driverId}`);
  
  // Send notification
  await notificationService.sendAssignmentNotification({
    vehicleId,
    driverId,
    type: 'ASSIGNMENT'
  });
  
  return assignment;
}
```

### 2. Document Verification Flow
```javascript
// Example: Verify document
const documentService = require('./services/documentService');
const notificationService = require('./services/notificationService');

async function verifyDocument(documentId, status, remarks) {
  // Verify document
  const document = await documentService.verifyDocument({
    documentId,
    status,
    remarks
  });
  
  // Clear document cache
  await cacheService.clearByPattern(`document:${documentId}`);
  
  // Send verification notification
  await notificationService.sendVerificationNotification({
    documentId,
    status,
    remarks
  });
  
  return document;
}
```

### 3. Vendor Registration Flow
```javascript
// Example: Register vendor
const authService = require('./services/authService');
const notificationService = require('./services/notificationService');

async function registerVendor(vendorData) {
  // Register vendor
  const vendor = await authService.registerVendor(vendorData);
  
  // Clear vendor cache
  await cacheService.clearByPattern('vendors:*');
  
  // Send welcome notification
  await notificationService.sendWelcomeNotification({
    vendorId: vendor.id,
    email: vendor.email
  });
  
  return vendor;
}
```

## Best Practices

1. **Error Handling**
   - Always use try-catch blocks
   - Use custom error classes
   - Log errors appropriately
   - Return meaningful error messages

2. **Caching**
   - Cache frequently accessed data
   - Clear cache on updates
   - Use appropriate cache expiration
   - Handle cache misses gracefully

3. **Notifications**
   - Send notifications asynchronously
   - Include relevant context
   - Handle notification failures
   - Log notification status

4. **Scheduling**
   - Use appropriate cron expressions
   - Handle job failures
   - Log job execution
   - Implement job retry mechanism

5. **Document Management**
   - Validate document types
   - Check file sizes
   - Handle upload failures
   - Implement cleanup for old documents #   I n t e r n s h i p _ B a c k e n d _ T a s k _ 1  
 