const express = require('express');
const crypto = require('crypto');
const open = require('open').default;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-2026-secure';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// In-memory database (for demonstration)
const db = {
    users: [],
    documents: [],
    requests: [],
    messages: [], // Secure messages storage
    otps: new Map() // username -> {otp, expiresAt}
};

// Email transporter configuration (using ethereal for demo)
let transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
        user: 'demo@demo.com',
        pass: 'demo123'
    }
});

// Alternatively, create a test account
nodemailer.createTestAccount((err, account) => {
    if (!err) {
        transporter = nodemailer.createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
                user: account.user,
                pass: account.pass
            }
        });
    }
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Helper function to generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===== AUTHENTICATION ROUTES =====

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        
        // Validation
        if (!username || !email || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        // Check if user already exists
        if (db.users.find(u => u.username === username)) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        
        if (db.users.find(u => u.email === email)) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        
        // Hash password with salt (bcrypt automatically handles salt)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create user
        const user = {
            id: uuidv4(),
            username,
            email,
            password: hashedPassword,
            salt, // Store salt separately for demonstration
            role,
            createdAt: new Date().toISOString()
        };
        
        db.users.push(user);
        
        console.log(`✅ User registered: ${username} (${role})`);
        
        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// Login endpoint (Single-Factor Authentication)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user
        const user = db.users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Generate OTP for Multi-Factor Authentication
        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        
        db.otps.set(username, { otp, expiresAt });
        
        // Send OTP via email (in demo, we'll just log it)
        console.log(`📧 OTP for ${username}: ${otp}`);
        console.log(`🔐 OTP sent to ${user.email}`);
        
        // In production, send actual email:
        /*
        await transporter.sendMail({
            from: '"Document Access System" <noreply@docaccess.com>',
            to: user.email,
            subject: 'Your Login OTP',
            html: `<p>Your OTP is: <strong>${otp}</strong></p><p>Valid for 10 minutes.</p>`
        });
        */
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            message: 'OTP sent to email',
            otp, // In production, don't send OTP in response
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// ===== DOCUMENT ROUTES =====

// Get all documents
app.get('/api/documents', authenticateToken, (req, res) => {
    try {
        // Return ALL documents to everyone, but sanitize sensitive data if no access
        const visibleDocuments = db.documents.map(doc => {
            const hasAccess = 
                req.user.role === 'admin' || 
                doc.owner === req.user.username || 
                doc.classification === 'public' ||
                (doc.approvedUsers && doc.approvedUsers.includes(req.user.username));

            if (hasAccess) {
                return doc;
            } else {
                // Return metadata only (sanitize keys and content)
                const { encryptedContent, encryptionKey, ...metadata } = doc;
                return metadata;
            }
        });
        
        res.json({ documents: visibleDocuments });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ message: 'Error fetching documents' });
    }
});

// Upload document
app.post('/api/documents', authenticateToken, (req, res) => {
    try {
        const { title, encryptedContent, encryptionKey, signature, category, classification } = req.body;
        
        if (!title || !encryptedContent || !encryptionKey || !signature) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        const document = {
            id: uuidv4(),
            title,
            encryptedContent,
            encryptionKey,
            signature,
            category,
            classification,
            owner: req.user.username,
            createdAt: new Date().toISOString(),
            approvedUsers: [] // List of users who have been granted access
        };
        
        db.documents.push(document);
        
        console.log(`📄 Document uploaded: ${title} by ${req.user.username}`);
        
        res.status(201).json({
            message: 'Document uploaded successfully',
            document
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Error uploading document' });
    }
});

// Delete document
app.delete('/api/documents/:id', authenticateToken, (req, res) => {
    try {
        const docIndex = db.documents.findIndex(d => d.id === req.params.id);
        
        if (docIndex === -1) {
            return res.status(404).json({ message: 'Document not found' });
        }
        
        const doc = db.documents[docIndex];
        
        // Check if user has permission to delete
        if (doc.owner !== req.user.username && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Permission denied' });
        }
        
        db.documents.splice(docIndex, 1);
        
        console.log(`🗑️ Document deleted: ${doc.title} by ${req.user.username}`);
        
        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: 'Error deleting document' });
    }
});

// ===== ACCESS REQUEST ROUTES =====

// Get all requests
app.get('/api/requests', authenticateToken, (req, res) => {
    try {
        let visibleRequests = [];
        const currentUserRole = req.user.role;
        const currentUsername = req.user.username;
        
        if (currentUserRole === 'admin') {
            // Admin sees requests from Managers (to approve)
            visibleRequests = db.requests.filter(r => {
                // Find requester user object to check role
                const requesterUser = db.users.find(u => u.username === r.requester);
                return requesterUser && requesterUser.role === 'manager';
            });
        } else if (currentUserRole === 'manager') {
            // Manager sees requests from Employees (to approve)
            const requestsToApprove = db.requests.filter(r => {
                const requesterUser = db.users.find(u => u.username === r.requester);
                return requesterUser && requesterUser.role === 'employee';
            });
            
            // Manager also sees their OWN outgoing requests (to track status)
            const myRequests = db.requests.filter(r => r.requester === currentUsername);
            
            // Combine and remove duplicates
            const requestIds = new Set(requestsToApprove.map(r => r.id));
            myRequests.forEach(r => {
                if (!requestIds.has(r.id)) {
                    requestsToApprove.push(r);
                }
            });
            visibleRequests = requestsToApprove;
            
        } else {
            // Employees (and others) see only their own requests
            visibleRequests = db.requests.filter(r => r.requester === currentUsername);
        }
        
        res.json({ requests: visibleRequests });
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ message: 'Error fetching requests' });
    }
});

// Request access to document
app.post('/api/request-access', authenticateToken, (req, res) => {
    try {
        // Admins cannot request access (they have full access)
        if (req.user.role === 'admin') {
            return res.status(400).json({ message: 'Admins already have full access.' });
        }

        const { documentId } = req.body;
        
        const document = db.documents.find(d => d.id === documentId);
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }
        
        // Check if request already exists
        const existingRequest = db.requests.find(
            r => r.documentId === documentId && r.requester === req.user.username && r.status === 'pending'
        );
        
        if (existingRequest) {
            return res.status(400).json({ message: 'You already have a pending request for this document' });
        }
        
        const request = {
            id: uuidv4(),
            documentId,
            documentTitle: document.title,
            requester: req.user.username,
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        
        db.requests.push(request);
        
        console.log(`📝 Access request: ${document.title} by ${req.user.username}`);
        
        res.status(201).json({
            message: 'Access request submitted',
            request
        });
    } catch (error) {
        console.error('Request error:', error);
        res.status(500).json({ message: 'Error submitting request' });
    }
});

// Approve request
app.post('/api/approve-request', authenticateToken, (req, res) => {
    try {
        const { requestId } = req.body;
        
        // Check if user has permission to approve
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ message: 'Permission denied' });
        }
        
        const request = db.requests.find(r => r.id === requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        request.status = 'approved';
        request.approvedBy = req.user.username;
        request.approvedAt = new Date().toISOString();
        
        // Add requester to document's approved users list
        const document = db.documents.find(d => d.id === request.documentId);
        if (document) {
            if (!document.approvedUsers) {
                document.approvedUsers = [];
            }
            if (!document.approvedUsers.includes(request.requester)) {
                document.approvedUsers.push(request.requester);
            }
        }
        
        console.log(`✅ Request approved: ${request.documentTitle} for ${request.requester}`);
        
        res.json({
            message: 'Request approved',
            request
        });
    } catch (error) {
        console.error('Approve error:', error);
        res.status(500).json({ message: 'Error approving request' });
    }
});

// Deny request
app.post('/api/deny-request', authenticateToken, (req, res) => {
    try {
        const { requestId } = req.body;
        
        // Check if user has permission to deny
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ message: 'Permission denied' });
        }
        
        const request = db.requests.find(r => r.id === requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        request.status = 'denied';
        request.deniedBy = req.user.username;
        request.deniedAt = new Date().toISOString();
        
        console.log(`❌ Request denied: ${request.documentTitle} for ${request.requester}`);
        
        res.json({
            message: 'Request denied',
            request
        });
    } catch (error) {
        console.error('Deny error:', error);
        res.status(500).json({ message: 'Error denying request' });
    }
});

// ===== UTILITY ROUTES =====

// Generate QR Code
app.post('/api/generate-qr', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ message: 'Text is required' });
        }
        
        const qrCode = await QRCode.toDataURL(text);
        
        res.json({ qrCode });
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ message: 'Error generating QR code' });
    }
});

// ===== SECURE MESSAGING ROUTES =====

// Update Public Key
app.post('/api/keys', authenticateToken, (req, res) => {
    try {
        const { publicKey } = req.body;
        const user = db.users.find(u => u.username === req.user.username);
        
        if (user) {
            user.publicKey = publicKey;
            res.json({ message: 'Public key updated successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating key' });
    }
});

// Get Users (for sending messages)
app.get('/api/users-list', authenticateToken, (req, res) => {
    try {
        // Return list of users (username and role only)
        const users = db.users.map(u => ({ 
            username: u.username, 
            role: u.role,
            hasKey: !!u.publicKey 
        }));
        res.json({ users });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// Get User Public Key
app.get('/api/keys/:username', authenticateToken, (req, res) => {
    try {
        const user = db.users.find(u => u.username === req.params.username);
        if (user && user.publicKey) {
            res.json({ publicKey: user.publicKey });
        } else {
            res.status(404).json({ message: 'Public key not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching key' });
    }
});

// Send Message
app.post('/api/messages', authenticateToken, (req, res) => {
    try {
        const { recipient, encryptedContent } = req.body;
        
        const message = {
            id: uuidv4(),
            sender: req.user.username,
            recipient,
            encryptedContent,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        db.messages.push(message);
        console.log(`📨 Message sent: ${req.user.username} -> ${recipient}`);
        
        res.status(201).json({ message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending message' });
    }
});

// Get My Messages
app.get('/api/messages', authenticateToken, (req, res) => {
    try {
        const myMessages = db.messages.filter(m => m.recipient === req.user.username);
        res.json({ messages: myMessages });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// ===== WEBAUTHN ROUTES (TOUCH ID) =====
// Note: For a production-grade system, you MUST use a library like @simplewebauthn/server 
// to properly verify CBOR-encoded attestation objects and ASN.1 signatures.
// Below is a simplified implementation focusing on the protocol flow and ID verification.

// 1. Register Options
app.post('/api/webauthn/register/options', authenticateToken, (req, res) => {
    const user = db.users.find(u => u.username === req.user.username);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const challenge = crypto.randomBytes(32).toString('base64url').replace(/=/g, ''); 
    // Node 14+ supports 'base64url', fallback to 'base64' and replacing chars if needed. 
    // For broad compatibility here we use manual replacement if needed, 
    // but modern Node has 'base64url'. treating as base64 for now.
    
    // Store challenge if we were doing strict verification
    
    const options = {
        challenge: uuidv4(), // Simplified challenge
        rp: { name: "Document Access System", id: "localhost" },
        user: {
            id: Buffer.from(user.id).toString('base64').replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""),
            name: user.username,
            displayName: user.username
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { userVerification: "required" },
        timeout: 60000,
        attestation: "direct" // or "none"
    };
    
    res.json(options);
});

// 2. Register Verify
app.post('/api/webauthn/register/verify', authenticateToken, (req, res) => {
    const { credential } = req.body;
    const user = db.users.find(u => u.username === req.user.username);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // In a real app: Verify signature, attestation, challenge, origin, etc.
    // Here: We trust the browser's interaction and store the Credential ID.
    
    if (!user.authenticators) user.authenticators = [];
    
    // Prevent duplicate registration
    if (!user.authenticators.find(c => c.credentialId === credential.id)) {
        user.authenticators.push({
            credentialId: credential.id,
            publicKey: null, // We would parse this from attestationObject in real implementation
            counter: 0,
            transports: credential.transports
        });
        console.log(`👍 Touch ID registered for ${user.username}`);
    }
    
    res.json({ verified: true });
});

// 3. Login Options
app.post('/api/webauthn/login/options', (req, res) => {
    const { username } = req.body;
    const user = db.users.find(u => u.username === username);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const allowCredentials = (user.authenticators || []).map(auth => ({
        id: auth.credentialId,
        type: 'public-key',
        transports: ['internal'] // usually 'internal' for TouchID
    }));
    
    if (allowCredentials.length === 0) {
        return res.status(400).json({ message: 'No fingerprint registered for this user' });
    }

    const options = {
        challenge: uuidv4(),
        rpId: "localhost",
        allowCredentials,
        userVerification: "required",
        timeout: 60000
    };
    
    res.json(options);
});

// 4. Login Verify
app.post('/api/webauthn/login/verify', (req, res) => {
    const { username, credential } = req.body;
    const user = db.users.find(u => u.username === username);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Check if credential ID belongs to user
    const authenticator = (user.authenticators || []).find(a => a.credentialId === credential.id);
    
    if (!authenticator) {
        return res.status(400).json({ message: 'Unknown credential' });
    }
    
    // In real app: Verified signature using stored public key against authenticatorData + clientDataJSON
    
    console.log(`🔓 Biometric Login Verified for ${username}`);
    
    // Issue Token (Same as password login)
    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
    
    res.json({
        verified: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            token
        }
    });
});

// ===== SAMPLE DATA =====
async function initializeSampleData() {
    // Create sample users
    const sampleUsers = [
        { username: 'admin', email: 'admin@docaccess.com', password: 'admin123', role: 'admin' },
        { username: 'manager', email: 'manager@docaccess.com', password: 'manager123', role: 'manager' },
        { username: 'employee', email: 'employee@docaccess.com', password: 'employee123', role: 'employee' }
    ];
    
    for (const userData of sampleUsers) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        
        db.users.push({
            id: uuidv4(),
            username: userData.username,
            email: userData.email,
            password: hashedPassword,
            salt,
            role: userData.role,
            createdAt: new Date().toISOString()
        });
    }
    
    console.log('✅ Sample users created:');
    console.log('   - admin / admin123 (Admin)');
    console.log('   - manager / manager123 (Manager)');
    console.log('   - employee / employee123 (Employee)');
}

// Start server
app.listen(PORT, async () => {
    console.log('\n🚀 Document Access Request System Server');
    console.log('==========================================');
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('==========================================\n');

    initializeSampleData();

    // 🔥 AUTO OPEN BROWSER
    await open(`http://localhost:${PORT}`);
});
