# Security Mechanisms & Where They Are Used

This table maps the security concepts in your project to where they appear in the code and user interface. Use this to answer technical questions from your faculty.

| Security Mechanism                   | Feature / Location               | Purpose                                                                                                               |
| :----------------------------------- | :------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **AES-256 Encryption**               | **Document Upload**              | Protecting the contents of files so they cannot be read without a key.                                                |
| **SHA-256 Hashing + Salt**           | **User Registration (Password)** | Storing passwords securely. If the database is stolen, hackers only get meaningless strings, not real passwords.      |
| **HMAC-SHA256 (Digital Signature)**  | **Document Integrity**           | Verifying that a document has not been altered or tampered with after it was uploaded.                                |
| **RSA (Public/Private Keys)**        | **Secure Messaging**             | End-to-End Encryption. Only the intended recipient can decrypt the message with their private key.                    |
| **One-Time Password (OTP)**          | **Login**                        | 2-Factor Authentication (2FA). Ensures that even if someone steals your password, they can't log in without the code. |
| **WebAuthn / Biometrics**            | **Touch ID Login**               | Modern, passwordless authentication using fingerprint or face ID.                                                     |
| **Role-Based Access Control (RBAC)** | **Dashboard / API**              | Enforcing rules: Admins see all, Managers approve requests, Employees must ask for permission.                        |
| **JWT (JSON Web Tokens)**            | **API Requests**                 | Securely identifying the user on every request after they log in (Session Management).                                |
