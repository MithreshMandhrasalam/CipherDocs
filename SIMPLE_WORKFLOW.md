# Simple Explanation for Faculty (Workflow)

Here is a simple, step-by-step story of how your project works. You can tell this to your faculty as if you are walking through the app with a new user.

---

### **1. The Security Check-In (Login)**

- **Imagine**: You are entering a highly secure bank.
- **What Happens**:
  1.  First, you give your name and password. The system checks a **hashed code** (so even the system owner doesn't know your real password!).
  2.  _Next Level Security_: The system asks for a **One-Time Code (OTP)** sent to your email.
  3.  _Even Cooler_: Once inside, you can set up your **Fingerprint (Touch ID)** so next time you can just scan your finger to get in instantly!

### **2. The Secret Vault (Documents)**

- **Imagine**: A room full of locked safe boxes.
- **Uploading a File**:
  - When you upload a file, the system automatically acts like a shredder—not destroying it, but scrambling it into **gibberish (Encryption)** using a secret digital key.
  - It then puts this scrambled file into a "box" and locks it.
- **The List**: Everyone can walk into the room and see the _boxes_ (Document Titles), but **nobody can open** a box without the key.

### **3. The "Boss" Rules (Hierarchy)**

The system is built like a company:

- **Admin (CEO)**: Has the master key. Can open ANY box instantly.
- **Manager (Boss)**: Can open their own boxes. If they want to see the CEO's box, they must **ask for permission**.
- **Employee (Worker)**: Can only open their own boxes. To see a Manager's box? They must **ask for permission**.

### **4. Asking for Permission (The Workflow)**

Let’s say an **Employee** wants to see a **Manager's** file:

1.  **Employee**: Sees the file "Q4 Report" in the list. Tries to open -> **"Access Denied!"**
2.  **Employee**: Clicks the **"Request Access"** button.
3.  **Manager**: Gets a notification. They review it and click **"Approve"**.
4.  **Employee**: Now, the system secretly hands them the key! The "Request" button turns into **"View"**.
5.  **Result**: The Employee can now open and read the file safely.

### **5. Secret Messages (Private Chat)**

- **Imagine**: Sending a letter in a lockbox.
- **Sending**: You write a message to your friend. The system locks it with **their specific lock** (Public Key).
- **Receiving**: Your friend gets the lockbox. To open it, they must use **their own private key** (which only they have). Even the mailman (the server) cannot peek inside!

### **Why Is This "Secure"?**

- **Double-Locking**: We use passwords AND OTPs.
- **Encryption**: Even if a hacker steals the database, all they get is scrambled gibberish files they can't read.
- **Audit Trail**: We know exactly who asked for access and who approved it.
