// ===== SECURITY UTILITIES =====

// Helper: Efficient Async Base64 conversion to fix UI lag
function arrayBufferToBase64(buffer) {
  return new Promise((resolve) => {
    const blob = new Blob([buffer]);
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.readAsDataURL(blob);
  });
}

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper: Base64URL for WebAuthn (replaces + with -, / with _, removes =)
function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = "";
    for (const charCode of bytes) {
        str += String.fromCharCode(charCode);
    }
    const base64 = btoa(str);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlToBuffer(base64url) {
    const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// 1. Hashing with Salt (SHA-256)
function generateSalt(length = 16) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function hashWithSalt(text, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 2. Encryption/Decryption (AES-256)
async function generateEncryptionKey() {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const exported = await crypto.subtle.exportKey("raw", key);
  return await arrayBufferToBase64(exported);
}

async function encryptText(text, keyBase64) {
  const keyData = base64ToUint8Array(keyBase64);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoder.encode(text),
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return await arrayBufferToBase64(combined);
}

async function decryptText(encryptedBase64, keyBase64) {
  try {
    const keyData = base64ToUint8Array(keyBase64);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const combined = base64ToUint8Array(encryptedBase64);
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encrypted,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error("Decryption failed: Invalid key or corrupted data");
  }
}

// 3. Digital Signature (HMAC-SHA256)
async function generateSignature(text, secret = "SECRET_KEY_2026") {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));

  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(text, signature, secret = "SECRET_KEY_2026") {
  const newSignature = await generateSignature(text, secret);
  return newSignature === signature;
}

// 4. Base64 Encoding/Decoding
function base64Encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function base64Decode(encoded) {
  return decodeURIComponent(escape(atob(encoded)));
}

// 5. Generate OTP
// 5. Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 6. RSA (Asymmetric) Utilities
async function generateRSAKeyPair() {
  return await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

async function exportKeyToPEM(key) {
  const exported = await crypto.subtle.exportKey(
    key.type === "private" ? "pkcs8" : "spki",
    key
  );
  const exportedAsBase64 = await arrayBufferToBase64(exported);
  const type = key.type === "private" ? "PRIVATE" : "PUBLIC";
  return `-----BEGIN ${type} KEY-----\n${exportedAsBase64}\n-----END ${type} KEY-----`;
}

async function importPublicKeyFromPEM(pem) {
  const base64 = pem.replace(/-----BEGIN.*?KEY-----/g, "").replace(/-----END.*?KEY-----/g, "").replace(/\s/g, "");
  const binaryDer = base64ToUint8Array(base64);

  return await crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

async function importPrivateKeyFromPEM(pem) {
  const base64 = pem.replace(/-----BEGIN.*?KEY-----/g, "").replace(/-----END.*?KEY-----/g, "").replace(/\s/g, "");
  const binaryDer = base64ToUint8Array(base64);

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// Hybrid Encryption (RSA + AES) to support long messages
async function encryptWithRSA(publicKey, text) {
  // 1. Generate a one-time AES key
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );
  
  // 2. Encrypt the message with AES
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encryptedMsg = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    encoder.encode(text)
  );

  // 3. Export AES key and encrypt it with RSA
  const aesKeyRaw = await crypto.subtle.exportKey("raw", aesKey);
  const encryptedAesKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    aesKeyRaw
  );

  // 4. Combine: [Encrypted AES Key (256 bytes)] + [IV (12 bytes)] + [Encrypted Message]
  const combined = new Uint8Array(256 + 12 + encryptedMsg.byteLength);
  combined.set(new Uint8Array(encryptedAesKey), 0);
  combined.set(iv, 256);
  combined.set(new Uint8Array(encryptedMsg), 268);

  return await arrayBufferToBase64(combined);
}

async function decryptWithRSA(privateKey, encryptedBase64) {
  try {
      const combined = base64ToUint8Array(encryptedBase64);
      
      // FALLBACK: Support for legacy messages (before Hybrid update)
      // Legacy formatted messages are exactly 256 bytes (RSA-2048 ciphertext)
      if (combined.byteLength === 256) {
          const decrypted = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            combined
          );
          const decoder = new TextDecoder();
          return decoder.decode(decrypted);
      }

      if (combined.byteLength < 268) {
          throw new Error("Invalid message format");
      }

      // 1. Extract parts
      const encryptedAesKey = combined.slice(0, 256);
      const iv = combined.slice(256, 268);
      const encryptedMsg = combined.slice(268);

      // 2. Decrypt AES Key using RSA
      const aesKeyRaw = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encryptedAesKey
      );

      // 3. Import AES Key
      const aesKey = await crypto.subtle.importKey(
        "raw",
        aesKeyRaw,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      // 4. Decrypt Message using AES
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        encryptedMsg
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
  } catch (e) {
      console.error("Decryption error:", e);
      throw new Error("Failed to decrypt.");
  }
}

// ===== AUTOMATED KEY MANAGEMENT =====
async function ensureUserKeys() {
  const username = state.currentUser.username;
  const storedPriv = localStorage.getItem(`priv_${username}`);
  const storedPub = localStorage.getItem(`pub_${username}`);

  let pubKeyPEM, privKeyPEM;

  if (storedPriv && storedPub) {
    console.log("🔑 Found existing keys in storage. Syncing...");
    pubKeyPEM = storedPub;
    privKeyPEM = storedPriv;
  } else {
    console.log("⚙️ Generating new RSA keys...");
    const keyPair = await generateRSAKeyPair();
    pubKeyPEM = await exportKeyToPEM(keyPair.publicKey);
    privKeyPEM = await exportKeyToPEM(keyPair.privateKey);
    
    // Save to LocalStorage
    localStorage.setItem(`priv_${username}`, privKeyPEM);
    localStorage.setItem(`pub_${username}`, pubKeyPEM);
  }

  // Always upload Public Key to server (in case server restarted)
  try {
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("authToken"),
      },
      body: JSON.stringify({ publicKey: pubKeyPEM }),
    });
    if (response.ok) {
      console.log("✅ Public Key synced to server.");
    }
  } catch (e) {
    console.error("Failed to sync public key:", e);
    showToast("Warning: Could not sync Public Key");
  }

  // Update UI if on messages tab
  if (document.getElementById("myPublicKey")) {
      document.getElementById("myPublicKey").value = pubKeyPEM;
      document.getElementById("myPrivateKey").value = privKeyPEM;
  }
}

// ===== STATE MANAGEMENT =====
const state = {
  currentUser: null,
  pendingOTP: null,
  pendingUserData: null,
  documents: [],
  requests: [],
  encryptionKey: null,
};

// Access Control Matrix (ACL)
const accessControlMatrix = {
  admin: {
    documents: ["read", "write", "delete"],
    requests: ["read", "write", "delete"],
    reports: ["read", "write", "delete"],
  },
  manager: {
    documents: ["read", "write"],
    requests: ["read", "write"],
    reports: ["read"],
  },
  employee: {
    documents: ["read"],
    requests: ["read", "write"],
    reports: ["none"],
  },
};

// ===== UI FUNCTIONS =====
function showToast(message) {
  const toast = document.getElementById("toast");
  const messageEl = toast.querySelector(".toast-message");
  messageEl.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function showSection(sectionId) {
  document
    .querySelectorAll(".auth-section, .dashboard-section")
    .forEach((section) => {
      section.classList.remove("active");
    });
  document.getElementById(sectionId).classList.add("active");
}

function switchTab(tabName, event) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelectorAll(".auth-form").forEach((form) => {
    form.classList.remove("active");
  });

  if (event && event.target) {
    event.target.classList.add("active");
  } else {
    // Fallback: find and activate the button with matching data-tab
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add("active");
  }
  document.getElementById(tabName + "Form").classList.add("active");
}

function switchDashboardSection(sectionName, event) {
  document.querySelectorAll(".dashboard-tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelectorAll(".dashboard-content").forEach((content) => {
    content.classList.remove("active");
  });

  if (event && event.target) {
    event.target.closest(".dashboard-tab").classList.add("active");
  } else {
    // Fallback: find and activate the button with matching data-section
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add("active");
  }
  document.getElementById(sectionName + "Content").classList.add("active");
}

// ===== AUTHENTICATION =====
async function handleRegister(event) {
  event.preventDefault();

  const username = document.getElementById("regUsername").value;
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;
  const role = document.getElementById("regRole").value;

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, role }),
    });

    const data = await response.json();

    if (response.ok) {
      showToast("Registration successful! Please log in.");
      document.querySelector('[data-tab="login"]').click();
      event.target.reset();
    } else {
      showToast(data.message || "Registration failed");
    }
  } catch (error) {
    showToast("Error: " + error.message);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Store OTP and user data for verification
      state.pendingOTP = data.otp;
      state.pendingUserData = data.user;

      // DEMO MODE: Show OTP in browser for easy testing
      showToast("🔐 Your OTP is: " + data.otp + " (valid for 10 minutes)");

      // Also show it in alert for visibility
      alert(
        "🔐 DEMO MODE - Your OTP Code\n\n" +
          "OTP: " +
          data.otp +
          "\n\n" +
          "This is shown in the browser for easy testing.\n" +
          "In production, this would only be sent via email.\n\n" +
          "Enter this code in the next screen.",
      );

      showSection("otpSection");
    } else {
      showToast(data.message || "Login failed");
    }
  } catch (error) {
    showToast("Error: " + error.message);
  }
}

async function handleOTPVerification(event) {
  event.preventDefault();

  const otpInput = document.getElementById("otpInput").value;

  if (otpInput === state.pendingOTP) {
    // OTP verified successfully

    state.currentUser = state.pendingUserData;
    localStorage.setItem("authToken", state.currentUser.token);

    showToast("Login successful! Welcome " + state.currentUser.username);
    initializeDashboard();
    // Auto-generate or Sync Keys
    await ensureUserKeys();
    showSection("dashboardSection");

    // Clear OTP data
    state.pendingOTP = null;
    state.pendingUserData = null;
    document.getElementById("otpInput").value = "";
  } else {
    showToast("Invalid OTP. Please try again.");
  }
}

function handleLogout() {
  state.currentUser = null;
  localStorage.removeItem("authToken");
  showToast("Logged out successfully");
  showSection("authSection");

  // Reset dashboard
  state.documents = [];
  state.requests = [];
}

// ===== DASHBOARD =====
function initializeDashboard() {
  // Set user info
  document.getElementById("userName").textContent = state.currentUser.username;
  document.getElementById("userRole").textContent = state.currentUser.role;
  document.getElementById("userAvatar").textContent = state.currentUser.username
    .charAt(0)
    .toUpperCase();

  // Load data
  loadDocuments();
  loadRequests();
  loadACLMatrix();
  updateStats();
  
  // Messaging
  loadMessagingUsers();
  loadMyMessages();
}

// ===== MESSAGING =====
async function handleGenerateKeys() {
  const btn = document.getElementById("generateKeysBtn");
  btn.textContent = "Generating...";
  btn.disabled = true;
  
  try {
    const keyPair = await generateRSAKeyPair();
    const publicKeyPEM = await exportKeyToPEM(keyPair.publicKey);
    const privateKeyPEM = await exportKeyToPEM(keyPair.privateKey);
    
    // Show keys
    document.getElementById("myPublicKey").value = publicKeyPEM;
    document.getElementById("myPrivateKey").value = privateKeyPEM;
    
    // Upload Public Key
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("authToken"),
      },
      body: JSON.stringify({ publicKey: publicKeyPEM }),
    });
    
    if (response.ok) {
       showToast("Keys generated and Public Key uploaded!");
    } else {
       showToast("Failed to upload public key");
    }
  } catch (error) {
    showToast("Error generating keys: " + error.message);
  } finally {
    btn.textContent = "Generate & Upload Keys";
    btn.disabled = false;
  }
}

async function loadMessagingUsers() {
  try {
    const response = await fetch("/api/users-list", {
      headers: { Authorization: "Bearer " + localStorage.getItem("authToken") },
    });
    const data = await response.json();
    
    if (response.ok && data && data.users) {
      const select = document.getElementById("msgRecipient");
      select.innerHTML = '<option value="">Select a user...</option>';
      
      data.users.forEach(u => {
         if (u.username !== state.currentUser.username) {
            const hasKey = u.hasKey ? "🔑 " : "⚠️ ";
            const option = document.createElement("option");
            option.value = u.username;
            
            if (!u.hasKey) {
               option.textContent = `⚠️ ${u.username} (No Keys Set - Click to see why)`;
               // We do NOT disable it anymore, effectively "Allowing" selection
               // option.disabled = true; 
            } else {
               option.textContent = `${hasKey}${u.username} (${u.role})`;
            }
            
            select.appendChild(option);
         }
      });
    } else {
      console.error("Failed to load messaging users:", data ? data.message : "Unknown error");
    }
  } catch (error) {
    console.error("Error loading users", error);
  }
}

async function loadMyMessages() {
  try {
    const response = await fetch("/api/messages", {
       headers: { Authorization: "Bearer " + localStorage.getItem("authToken") },
    });
    const data = await response.json();
    
    if (response.ok && data && data.messages) {
      const inbox = document.getElementById("messagesInbox");
      
      if (data.messages.length === 0) {
        inbox.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No messages</p>';
        return;
      }
      
      inbox.innerHTML = data.messages.map(msg => `
        <div class="request-card" 
             onclick="selectMessage(this)" 
             data-encrypted="${msg.encryptedContent}"
             data-sender="${msg.sender}"
             style="cursor: pointer; transition: all 0.2s;">
           <div class="request-header">
              <h4>From: ${msg.sender}</h4>
              <span style="font-size: 0.8rem; color: var(--text-secondary);">${new Date(msg.timestamp).toLocaleString()}</span>
           </div>
           <div style="margin-top: 5px;">
              <span style="font-size: 0.8rem; color: var(--primary);">👆 Click to Decrypt</span>
           </div>
        </div>
      `).join("");
    } else {
      console.error("Failed to load messages:", data ? data.message : "Unknown error");
    }
  } catch (error) {
    console.error("Error loading messages", error);
  }
}

function selectMessage(element) {
    const encrypted = element.getAttribute("data-encrypted");
    const sender = element.getAttribute("data-sender");
    
    // Highlight selection
    document.querySelectorAll("#messagesInbox .request-card").forEach(c => {
        c.style.borderColor = "rgba(255, 255, 255, 0.1)";
        c.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
    });
    element.style.borderColor = "var(--primary)";
    element.style.backgroundColor = "rgba(99, 102, 241, 0.1)";
    
    // Populate decryption zone
    document.getElementById("decryptMsgInput").value = encrypted;
    document.getElementById("decryptMsgOutput").value = ""; // Clear previous result
    
    // Focus private key input
    const keyInput = document.getElementById("decryptMsgKey");
    keyInput.value = ""; // Clear previous key
    keyInput.focus();
    
    // Scroll to decryption section
    document.getElementById("decryptMsgInput").scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    showToast(`Selected message from ${sender}. Enter Private Key to decrypt.`);
}

async function handleDecryptMessage() {
    const encryptedContent = document.getElementById("decryptMsgInput").value;
    const privateKeyPEM = document.getElementById("decryptMsgKey").value;
    const outputElem = document.getElementById("decryptMsgOutput");
    const btn = document.getElementById("decryptMsgBtn");

    if (!encryptedContent) {
        showToast("Please select a message first");
        return;
    }
    
    if (!privateKeyPEM) {
        showToast("Please enter your Private Key");
        return;
    }

    const originalText = btn.textContent;
    btn.textContent = "Decrypting...";
    btn.disabled = true;

    try {
        const privateKey = await importPrivateKeyFromPEM(privateKeyPEM.trim());
        const decrypted = await decryptWithRSA(privateKey, encryptedContent);

        outputElem.value = decrypted;
        showToast("Message decrypted successfully!");
    } catch (error) {
        console.error(error);
        outputElem.value = "Decryption Failed! Check your Private Key.";
        showToast("Decryption failed. Check console for details.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Manual Sync (can be attached to a button)
async function handleSyncKeys() {
    await ensureUserKeys();
    alert("Keys synchronized with server!");
}

async function handleSendMessage() {
  const recipient = document.getElementById("msgRecipient").value;
  const content = document.getElementById("msgContent").value;
  
  if (!recipient || !content) {
     showToast("Please select a recipient and enter a message");
     return;
  }
  
  const btn = document.getElementById("sendMsgBtn");
  btn.textContent = "Checking...";
  btn.disabled = true;
  
  try {
     // 1. Get Recipient Public Key
     // Ensure WE have keys first (just in case)
     await ensureUserKeys(); 
     
     const keyRes = await fetch(`/api/keys/${recipient}`, {
        headers: { Authorization: "Bearer " + localStorage.getItem("authToken") },
     });
     
     if (keyRes.status === 404) {
        alert(`User '${recipient}' is not ready to receive messages yet. They need to login at least once to sync their keys.`);
        throw new Error("Recipient key missing");
     }
     
     if (!keyRes.ok) throw new Error("Could not fetch recipient details");
     
     const keyData = await keyRes.json();
     if (!keyData.publicKey) throw new Error("Recipient has no Public Key");

     const publicKey = await importPublicKeyFromPEM(keyData.publicKey);
     
     btn.textContent = "Encrypting...";
     
     // 2. Encrypt (Hybrid)
     const encrypted = await encryptWithRSA(publicKey, content);
     
     // 3. Send
     const sendRes = await fetch("/api/messages", {
        method: "POST",
        headers: {
           "Content-Type": "application/json",
           Authorization: "Bearer " + localStorage.getItem("authToken"),
        },
        body: JSON.stringify({ recipient, encryptedContent: encrypted }),
     });
     
     if (sendRes.ok) {
        showToast("Secure message sent!");
        document.getElementById("msgContent").value = "";
     } else {
        showToast("Failed to send message");
     }
  } catch (error) {
     showToast("Error: " + error.message);
  } finally {
     btn.textContent = "Encrypt & Send";
     btn.disabled = false;
  }
}

async function loadDocuments() {
  try {
    const response = await fetch("/api/documents", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("authToken"),
      },
    });

    const data = await response.json();

    if (response.ok) {
      state.documents = data.documents;
      renderDocuments();
    }
  } catch (error) {
    console.error("Error loading documents:", error);
  }
}

function renderDocuments() {
  const grid = document.getElementById("documentsGrid");

  if (state.documents.length === 0) {
    grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                <p>No documents available. Upload your first document!</p>
            </div>
        `;
    return;
  }

  grid.innerHTML = state.documents
    .map(
      (doc) => `
        <div class="document-card">
            <div class="document-header">
                <div class="document-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
                        <polyline points="13 2 13 9 20 9"/>
                    </svg>
                </div>
                <span class="classification-badge ${doc.classification}">${
        doc.classification
      }</span>
            </div>
            <h4 class="document-title">${doc.title}</h4>
            <div class="document-meta">
                <span>📁 ${doc.category}</span>
                <span>👤 ${doc.owner}</span>
            </div>
            <div class="document-actions">
                <button class="btn-icon" onclick="requestAccess('${
                  doc.id
                }')">Request Access</button>
                ${
                  canAccessDocument(doc)
                    ? `<button class="btn-icon" onclick="viewDocument('${doc.id}')">View</button>`
                    : ""
                }
                ${
                  canDeleteDocument(doc)
                    ? `<button class="btn-icon" onclick="deleteDocument('${doc.id}')">Delete</button>`
                    : ""
                }
            </div>
        </div>
    `,
    )
    .join("");
}

async function loadRequests() {
  try {
    const response = await fetch("/api/requests", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("authToken"),
      },
    });

    const data = await response.json();

    if (response.ok) {
      state.requests = data.requests;
      renderRequests();
    }
  } catch (error) {
    console.error("Error loading requests:", error);
  }
}

function renderRequests() {
  const list = document.getElementById("requestsList");

  if (state.requests.length === 0) {
    list.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <p>No access requests available.</p>
            </div>
        `;
    return;
  }

  list.innerHTML = state.requests
    .map(
      (req) => `
        <div class="request-card">
            <div class="request-header">
                <div>
                    <h4 class="request-title">${req.documentTitle}</h4>
                    <p class="request-info">Requested by: ${
                      req.requester
                    } | ${new Date(req.timestamp).toLocaleDateString()}</p>
                </div>
                <span class="request-status ${req.status}">${req.status}</span>
            </div>
            ${
              state.currentUser.role === "admin" ||
              state.currentUser.role === "manager"
                ? `
                <div class="request-actions">
                    ${
                      req.status === "pending"
                        ? `
                        <button class="btn btn-primary" onclick="approveRequest('${req.id}')">Approve</button>
                        <button class="btn btn-secondary" onclick="denyRequest('${req.id}')">Deny</button>
                    `
                        : ""
                    }
                </div>
            `
                : ""
            }
        </div>
    `,
    )
    .join("");
}

function loadACLMatrix() {
  const matrix = document.getElementById("aclMatrix");

  matrix.innerHTML = `
        <table class="acl-table">
            <thead>
                <tr>
                    <th>Role (Subject)</th>
                    <th>Documents (Object)</th>
                    <th>Requests (Object)</th>
                    <th>Reports (Object)</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(accessControlMatrix)
                  .map(
                    ([role, permissions]) => `
                    <tr>
                        <td style="text-transform: capitalize; font-weight: 600;">${role}</td>
                        <td>${renderPermissions(permissions.documents)}</td>
                        <td>${renderPermissions(permissions.requests)}</td>
                        <td>${renderPermissions(permissions.reports)}</td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>
        
        <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px;">
            <h4 style="margin-bottom: 1rem;">Access Control Policy Justification</h4>
            <ul style="color: var(--text-secondary); line-height: 1.8;">
                <li><strong>Admin:</strong> Full access to all resources (read, write, delete) for system administration and oversight.</li>
                <li><strong>Manager:</strong> Can read and modify documents and requests, but only read reports. No deletion rights to prevent accidental data loss.</li>
                <li><strong>Employee:</strong> Read-only access to documents, can create and manage own access requests, no access to sensitive reports.</li>
            </ul>
        </div>
    `;
}

function renderPermissions(permissions) {
  if (Array.isArray(permissions)) {
    return permissions
      .map((perm) => `<span class="permission-badge ${perm}">${perm}</span>`)
      .join("");
  }
  return `<span class="permission-badge none">none</span>`;
}

function updateStats() {
  document.getElementById("totalDocs").textContent = state.documents.length;
  document.getElementById("pendingRequests").textContent =
    state.requests.filter((r) => r.status === "pending").length;
  document.getElementById("approvedRequests").textContent =
    state.requests.filter((r) => r.status === "approved").length;
}

// ===== ACCESS CONTROL =====
function canAccessDocument(doc) {
  const role = state.currentUser.role;
  
  // Admin has full access
  if (role === "admin") {
      return true;
  }

  const permissions = accessControlMatrix[role]?.documents || [];
  
  if (!permissions.includes("read")) {
    return false;
  }
  
  // If backend sanitized the document (no key), user cannot access it
  if (!doc.encryptionKey) {
      return false;
  }
  
  // Owner can always access their own documents
  if (doc.owner === state.currentUser.username) {
    return true;
  }
  
  // Check if user is in the approved users list
  if (doc.approvedUsers && doc.approvedUsers.includes(state.currentUser.username)) {
    return true;
  }
  
  return false;
}

function canDeleteDocument(doc) {
  const role = state.currentUser.role;
  const permissions = accessControlMatrix[role]?.documents || [];
  
  // Admins can delete any document
  if (role === "admin" && permissions.includes("delete")) {
    return true;
  }
  
  // Others can only delete their own documents
  return (
    permissions.includes("delete") && doc.owner === state.currentUser.username
  );
}

async function requestAccess(documentId) {
  try {
    const response = await fetch("/api/request-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("authToken"),
      },
      body: JSON.stringify({ documentId }),
    });

    const data = await response.json();

    if (response.ok) {
      showToast("Access request submitted successfully");
      loadRequests();
      updateStats();
    } else {
      showToast(data.message || "Request failed");
    }
  } catch (error) {
    showToast("Error: " + error.message);
  }
}

async function approveRequest(requestId) {
  try {
    const response = await fetch("/api/approve-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("authToken"),
      },
      body: JSON.stringify({ requestId }),
    });

    const data = await response.json();

    if (response.ok) {
      showToast("Request approved");
      loadRequests();
      updateStats();
    } else {
      showToast(data.message || "Approval failed");
    }
  } catch (error) {
    showToast("Error: " + error.message);
  }
}

async function denyRequest(requestId) {
  try {
    const response = await fetch("/api/deny-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("authToken"),
      },
      body: JSON.stringify({ requestId }),
    });

    const data = await response.json();

    if (response.ok) {
      showToast("Request denied");
      loadRequests();
      updateStats();
    } else {
      showToast(data.message || "Denial failed");
    }
  } catch (error) {
    showToast("Error: " + error.message);
  }
}

async function viewDocument(documentId) {
  const doc = state.documents.find((d) => d.id === documentId);
  if (!doc) return;

  try {
    // Decrypt document content
    const decrypted = await decryptText(
      doc.encryptedContent,
      doc.encryptionKey,
    );

    // Verify digital signature
    const isValid = await verifySignature(decrypted, doc.signature);

    if (isValid) {
      showToast("Document verified and decrypted successfully");
      alert(
        `Document: ${doc.title}\n\nContent:\n${decrypted}\n\nSignature: ✅ Verified`,
      );
    } else {
      showToast("Warning: Document signature verification failed!");
    }
  } catch (error) {
    showToast("Error accessing document: " + error.message);
  }
}

async function deleteDocument(documentId) {
  if (!confirm("Are you sure you want to delete this document?")) return;

  try {
    const response = await fetch("/api/documents/" + documentId, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("authToken"),
      },
    });

    const data = await response.json();

    if (response.ok) {
      showToast("Document deleted successfully");
      loadDocuments();
      updateStats();
    } else {
      showToast(data.message || "Deletion failed");
    }
  } catch (error) {
    showToast("Error: " + error.message);
  }
}

// ===== DOCUMENT UPLOAD =====
async function handleUpload(event) {
  event.preventDefault();

  const title = document.getElementById("docTitle").value;
  const content = document.getElementById("docContent").value;
  const category = document.getElementById("docCategory").value;
  const classification = document.getElementById("docClassification").value;

  try {
    // Generate encryption key
    const encryptionKey = await generateEncryptionKey();

    // Encrypt content
    const encryptedContent = await encryptText(content, encryptionKey);

    // Generate digital signature
    const signature = await generateSignature(content);

    const response = await fetch("/api/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("authToken"),
      },
      body: JSON.stringify({
        title,
        encryptedContent,
        encryptionKey,
        signature,
        category,
        classification,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      showToast("Document uploaded and encrypted successfully");
      document.getElementById("uploadModal").classList.remove("active");
      event.target.reset();
      loadDocuments();
      updateStats();
    } else {
      showToast(data.message || "Upload failed");
    }
  } catch (error) {
    showToast("Error: " + error.message);
  }
}

// ===== ENCRYPTION TOOLS =====
async function handleEncrypt() {
  const input = document.getElementById("encryptInput").value;
  const btn = document.getElementById("encryptBtn");

  if (!input) {
    showToast("Please enter text to encrypt");
    return;
  }

  const originalText = btn.textContent;
  btn.textContent = "Encrypting...";
  btn.disabled = true;

  try {
    const key = await generateEncryptionKey();
    const encrypted = await encryptText(input, key);

    document.getElementById("encryptOutput").value = encrypted;
    document.getElementById("encryptionKey").value = key;
    showToast("Text encrypted successfully");
  } catch (error) {
    showToast("Encryption error: " + error.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function handleDecrypt() {
  const input = document.getElementById("decryptInput").value;
  const key = document.getElementById("decryptionKey").value;
  const btn = document.getElementById("decryptBtn");

  if (!input || !key) {
    showToast("Please enter both encrypted text and key");
    return;
  }

  const originalText = btn.textContent;
  btn.textContent = "Decrypting...";
  btn.disabled = true;

  try {
    const decrypted = await decryptText(input, key);
    document.getElementById("decryptOutput").value = decrypted;
    showToast("Text decrypted successfully");
  } catch (error) {
    showToast("Decryption error: " + error.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function handleHash() {
  const input = document.getElementById("hashInput").value;
  if (!input) {
    showToast("Please enter text to hash");
    return;
  }

  try {
    const salt = generateSalt();
    const hash = await hashWithSalt(input, salt);

    document.getElementById("saltOutput").value = salt;
    document.getElementById("hashOutput").value = hash;
    showToast("Hash generated successfully");
  } catch (error) {
    showToast("Hashing error: " + error.message);
  }
}

async function handleSign() {
  const input = document.getElementById("signInput").value;
  if (!input) {
    showToast("Please enter content to sign");
    return;
  }

  try {
    const signature = await generateSignature(input);
    document.getElementById("signatureOutput").value = signature;
    showToast("Digital signature generated");
  } catch (error) {
    showToast("Signing error: " + error.message);
  }
}

async function handleVerifySign() {
  const input = document.getElementById("signInput").value;
  const signature = document.getElementById("signatureOutput").value;

  if (!input || !signature) {
    showToast("Please generate a signature first");
    return;
  }

  try {
    const isValid = await verifySignature(input, signature);
    const resultDiv = document.getElementById("verifyResult");

    if (isValid) {
      resultDiv.innerHTML =
        '<div style="padding: 1rem; background: rgba(76, 175, 80, 0.2); color: #4caf50; border-radius: 8px; font-weight: 600;">✅ Signature is valid and verified</div>';
    } else {
      resultDiv.innerHTML =
        '<div style="padding: 1rem; background: rgba(244, 67, 54, 0.2); color: #f44336; border-radius: 8px; font-weight: 600;">❌ Signature verification failed</div>';
    }
  } catch (error) {
    showToast("Verification error: " + error.message);
  }
}

async function handleGenerateQR() {
  const input = document.getElementById("qrInput").value;
  if (!input) {
    showToast("Please enter text to encode");
    return;
  }

  try {
    const response = await fetch("/api/generate-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById(
        "qrOutput",
      ).innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
      showToast("QR Code generated successfully");
    } else {
      showToast("QR generation failed");
    }
  } catch (error) {
    showToast("Error: " + error.message);
  }
}

// ===== EVENT LISTENERS =====
document.addEventListener("DOMContentLoaded", () => {
  // Auth tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tab = e.target.dataset.tab;
      switchTab(tab, e);
    });
  });

  // Auth forms
  document
    .getElementById("registerFormElement")
    .addEventListener("submit", handleRegister);
  document
    .getElementById("loginFormElement")
    .addEventListener("submit", handleLogin);
  document
    .getElementById("otpFormElement")
    .addEventListener("submit", handleOTPVerification);

  // Dashboard tabs
  document.querySelectorAll(".dashboard-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const section = tab.dataset.section;
      switchDashboardSection(section, e);
    });
  });

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);

  // Upload modal
  document.getElementById("uploadDocBtn").addEventListener("click", () => {
    document.getElementById("uploadModal").classList.add("active");
  });

  document.getElementById("closeUploadModal").addEventListener("click", () => {
    document.getElementById("uploadModal").classList.remove("active");
  });

  document.getElementById("cancelUpload").addEventListener("click", () => {
    document.getElementById("uploadModal").classList.remove("active");
  });

  document
    .getElementById("uploadForm")
    .addEventListener("submit", handleUpload);

  // Encryption tools
  document
    .getElementById("encryptBtn")
    .addEventListener("click", handleEncrypt);
  document
    .getElementById("decryptBtn")
    .addEventListener("click", handleDecrypt);
  document.getElementById("hashBtn").addEventListener("click", handleHash);
  document.getElementById("signBtn").addEventListener("click", handleSign);
  document
    .getElementById("verifySignBtn")
    .addEventListener("click", handleVerifySign);
  document
    .getElementById("generateQRBtn")
    .addEventListener("click", handleGenerateQR);

  // RSA Tools
  document.getElementById("generateKeysBtn").addEventListener("click", handleGenerateKeys);
  document.getElementById("sendMsgBtn").addEventListener("click", handleSendMessage);
  document.getElementById("decryptMsgBtn").addEventListener("click", handleDecryptMessage);

  // Check for existing auth token
  const token = localStorage.getItem("authToken");
  if (token) {
    // Auto-login if token exists (simplified, in production verify token with backend)
    showSection("authSection");
  }

  // WebAuthn
  const regBioBtn = document.getElementById("registerBiometricBtn");
  if (regBioBtn) regBioBtn.addEventListener("click", handleRegisterBiometric);
  
  const loginBioBtn = document.getElementById("loginBiometricBtn");
  if (loginBioBtn) loginBioBtn.addEventListener("click", handleLoginBiometric);
});

// ===== WEBAUTHN (TOUCH ID) =====
async function handleRegisterBiometric() {
    try {
        if (!state.currentUser) {
            showToast("Please login first to enable Touch ID");
            return;
        }

        const username = state.currentUser.username;
        showToast("Prepare your Touch ID / Fingerprint...");

        // 1. Get Options
        const optionsRes = await fetch("/api/webauthn/register/options", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("authToken")
            },
            body: JSON.stringify({ username })
        });
        
        const options = await optionsRes.json();
        
        // Decode challenge and user ID
        options.challenge = base64urlToBuffer(options.challenge);
        options.user.id = base64urlToBuffer(options.user.id);
        
        // 2. Create Credential (Touch ID Prompt)
        const credential = await navigator.credentials.create({ publicKey: options });
        
        // 3. Send to Server to Verify
        const credentialObj = {
            id: credential.id,
            rawId: bufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
                attestationObject: bufferToBase64url(credential.response.attestationObject),
                clientDataJSON: bufferToBase64url(credential.response.clientDataJSON)
            }
        };

        const verifyRes = await fetch("/api/webauthn/register/verify", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("authToken")
            },
            body: JSON.stringify({ credential: credentialObj })
        });

        if (verifyRes.ok) {
            showToast("✅ Touch ID Registered Successfully!");
        } else {
            const err = await verifyRes.json();
            showToast("Registration Failed: " + err.message);
        }

    } catch (error) {
        console.error("WebAuthn Error:", error);
        showToast("Error: " + error.message);
    }
}

async function handleLoginBiometric() {
    try {
        const username = document.getElementById("loginUsername").value;
        if (!username) {
            showToast("Please enter your username first");
            document.getElementById("loginUsername").focus();
            return;
        }
        
        showToast("Requesting Touch ID...");

        // 1. Get Options
        const optionsRes = await fetch("/api/webauthn/login/options", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username })
        });
        
        if (!optionsRes.ok) {
            const err = await optionsRes.json();
            throw new Error(err.message || "User not found or no biometrics registered");
        }
        
        const options = await optionsRes.json();
        options.challenge = base64urlToBuffer(options.challenge);
        
        // Fix allowCredentials
        if (options.allowCredentials) {
            options.allowCredentials = options.allowCredentials.map(c => ({
                ...c,
                id: base64urlToBuffer(c.id)
            }));
        }

        // 2. Authenticate (Touch ID Prompt)
        const credential = await navigator.credentials.get({ publicKey: options });

        // 3. Verify
        const credentialObj = {
            id: credential.id,
            rawId: bufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
                authenticatorData: bufferToBase64url(credential.response.authenticatorData),
                clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
                signature: bufferToBase64url(credential.response.signature),
                userHandle: credential.response.userHandle ? bufferToBase64url(credential.response.userHandle) : null
            }
        };

        const verifyRes = await fetch("/api/webauthn/login/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, credential: credentialObj })
        });

        const data = await verifyRes.json();
        if (verifyRes.ok) {
             // Login Success
            state.currentUser = data.user;
            localStorage.setItem("authToken", state.currentUser.token);
            
            showToast("✅ Biometric Login Successful!");
            initializeDashboard();
            await ensureUserKeys();
            showSection("dashboardSection");
            
            // Clear passwords
            document.getElementById("loginPassword").value = "";
        } else {
            showToast("Login Failed: " + data.message);
        }

    } catch (error) {
         console.error("WebAuthn Login Error:", error);
         showToast("Biometric Login Failed: " + error.message);
    }
}
