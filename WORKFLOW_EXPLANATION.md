# Document Access System - Project Workflow Explained

This guide explains the complete workflow of the **Secure Document Access System** designed for the FCS evaluation.

---

## 1. Authentication & Security (Entry Point)

- **Registration**: A user signs up with a `username`, `password`, and `role` (Admin, Manager, Employee).
  - _Security_: Password is **Hashed & Salted** (using bcrypt) before storage. We verify this via the **"Encryption Tools"** tab.
- **Login**: The user enters credentials.
  - _Security_: If valid, the system generates a **One-Time Password (OTP)**.
  - **2FA**: The user must enter this OTP (simulated via alert/log) to fully authenticate.
  - _Option_: **Biometric Login (Touch ID)** is available using WebAuthn for passwordless access after initial setup.

## 2. Document Management (The Core)

- **Uploading**: Any user can upload a document.
  - _Process_:
    1.  **Encryption**: The browser generates a unique **AES-256 Key** and encrypts the content _before_ sending it to the server.
    2.  **Signing**: A **Digital Signature (HMAC)** is created to ensure data integrity.
    3.  **Storage**: The server stores the _encrypted_ content. It cannot read the document without the key.
- **Visibility**:
  - **Global List**: Every user can see the _titles_ and _owners_ of all documents (transparency).
  - **Access Control**: However, they **cannot open** them. The content and encryption keys are stripped from the response for unauthorized users.

## 3. Access Control Hierarchy (Role-Based Access Control)

The system enforces strict rules on _who_ can open a document:

### **A. Admin (The "Super User")**

- **Privilege**: Has **Full Access** to all documents automatically.
- **Workflow**:
  - Sees all documents.
  - Can "View" (decrypt) any file immediately without asking.
  - Can **Approves Requests** from Managers.

### **B. Manager (Middle Tier)**

- **Privilege**: Can view their own files and Employee files (if approved).
- **Workflow**:
  - Can upload their own documents.
  - **Requesting Access**: To see an Admin's file, they must click **"Request Access"**.
  - ** approving Requests**: They receive requests from **Employees** and can Approve/Decline them.

### **C. Employee (Standard User)**

- **Privilege**: Restricted access.
- **Workflow**:
  - Can upload their own documents.
  - **Requesting Access**: To see a Manager's or Admin's file, they must click **"Request Access"**.
  - Their request goes to a **Manager** for approval.

## 4. The Request-Approval Cycle (Workflow Demo)

1.  **Step 1 (Employee)**: Logs in, sees "Project Plan" (uploaded by Manager). Tries to open -> **Access Denied**.
2.  **Step 2 (Employee)**: Clicks **"Request Access"**. Status changes to "Pending".
3.  **Step 3 (Manager)**: Logs in, goes to **"Access Requests"** tab. Sees the request from Employee.
4.  **Step 4 (Manager)**: Clicks **"Approve"**.
5.  **Step 5 (Employee)**: Logs back in. The "Request Access" button is replaced by **"View Document"**.
    - _Behind the Scenes_: The server now sends the **Encryption Key** to the Employee.
6.  **Step 6 (View)**: Employee clicks "View".
    - _Security_: Browser decrypts the content locally using the key.
    - _Verification_: Browser checks the **Digital Signature** to confirm the admin hasn't tampered with it.

## 5. Secure Messaging (End-to-End Encryption)

- **Sending**: User A selects User B.
  - System fetches User B's **Public Key** (RSA).
  - System **Encrypts** the message with that Public Key.
- **Receiving**: User B sees the encrypted message in their Inbox.
- **Decrypting**:
  1.  User B clicks the message.
  2.  User B **manually enters their Private Key**.
  3.  System decrypts and shows the message.
  - _Proof_: Server never sees the Private Key, so it cannot read the messages.

## 6. Audit & Tools (Evaluation)

- **Encryption Tab**: A "playground" to prove the math works.
  - You can manually Encrypt/Decrypt text.
  - You can generate Hashes and Digital Signatures.
  - You can generate QR Codes for 2FA.
