🚛 Fleet Management System Backend
A powerful and scalable backend system to manage vendors, vehicles, drivers, documents, and system health, optimized for compliance, performance, and automation.

✨ Features at a Glance
Feature	Highlights
🧑‍💼 Vendor Management	Multi-level hierarchy (Super, City, Sub, Local), role-based access, area-based ops
🚗 Vehicle Management	Registration, document handling, status tracking, driver assignment
🧑‍✈️ Driver Management	Registration, profile & document tracking, performance stats
📁 Document Management	Uploads, verification, expiry tracking, compliance status
📊 Analytics Dashboard	Stats, document compliance, active/inactive status, (Revenue + Trips - upcoming)
⚙️ System Monitoring	API performance, error logs, resource metrics, health checks

🏗️ Tech Stack
Backend Framework: Node.js + Express

Database: MongoDB

Caching: Redis

Authentication: JWT

Email Service: Nodemailer (Gmail)

Logging: Winston

Scheduling: node-cron

File Storage: AWS S3 (📦 Coming Soon)

📁 Project Structure
bash
Copy
Edit
src/
├── config/         # Database, Redis, Email, Logger configs
├── controllers/    # Route controllers for vendor, driver, etc.
├── middleware/     # Auth, error handling, validations
├── models/         # MongoDB models
├── routes/         # Route declarations
├── services/       # Business logic (auth, docs, notifications, etc.)
├── utils/          # Helpers, error classes, validators
└── app.js          # Express app entry point
🔐 Authentication & Authorization
JWT-secured login

Role-based + permission-based access

Password hashing & secure token handling

🚀 Getting Started
🧩 Prerequisites
Node.js (v14+)

MongoDB

Redis

Gmail (App Password Enabled)

🛠️ Setup Instructions
bash
Copy
Edit
# 1. Clone the repo
git clone https://github.com/your-repo/fleet-backend.git
cd fleet-backend

# 2. Install dependencies
npm install

# 3. Create .env file
touch .env
Sample .env
ini
Copy
Edit
PORT=3000
MONGODB_URI=mongodb+srv://your-db
JWT_SECRET=supersecretkey
REDIS_URL=redis://localhost:6379
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
▶️ Start the Server
bash
Copy
Edit
# For development
npm run dev

# For production
npm start
⚙️ Core Services & Usage
1. 🔐 Authentication Service
js
Copy
Edit
await authService.registerVendor({
  name: 'Fleet Corp',
  email: 'fleet@example.com',
  password: 'securePass123',
  vendorType: 'CITY'
});
2. 📦 Cache Service
js
Copy
Edit
await cacheService.set('vehicles:vendor:123', vehicles, 3600);
const data = await cacheService.get('vehicles:vendor:123');
3. 📧 Notification Service
js
Copy
Edit
await notificationService.sendDocumentExpiryNotification({
  vendorId: 'vendor_1',
  documentType: 'insurance',
  expiryDate: '2025-01-01'
});
4. 🕒 Scheduler Service
js
Copy
Edit
await schedulerService.scheduleJob('dailyDocCheck', '0 0 * * *', () => {
  notificationService.checkAndNotifyExpiringDocuments(30);
});
5. 📁 Document Service
js
Copy
Edit
await documentService.uploadDocument({
  entityType: 'DRIVER',
  entityId: 'driver_123',
  documentType: 'license',
  file: fileBuffer
});
📊 Dashboard & Monitoring (Planned)
📈 Fleet analytics (active vehicles, compliance)

🔔 Document alerts

📉 Inactive status detection

💸 Revenue + 🚕 Trip analytics (Coming Soon)

🛡️ Security Highlights
✅ Helmet for secure headers

🧼 Input sanitization

❌ NoSQL injection protection

🔁 Rate limiting

🔒 JWT + hashed passwords

📅 Scheduled Jobs
⏰ Daily document expiry checks

📤 Weekly compliance reports

🧹 Weekly expired document cleanup

🧪 Testing (To Be Added)
✅ Unit Tests

🔁 Integration Tests

🌐 API Contract Tests

🚀 Deployment Ready
Checklist	Status
Env Vars Configured	✅
DB & Redis Secured	✅
Email Notifications Setup	✅
Winston Logging in Place	✅
Security Middleware Active	✅
SSL/HTTPS	🔜
Backup Strategy	🔜

