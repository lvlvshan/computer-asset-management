# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please open an issue with the label `security` or contact the repository maintainer directly.

Please do **not** report security vulnerabilities through public GitHub issues if they involve:
- Authentication bypass
- SQL injection
- Remote code execution
- Sensitive data exposure

For these, please use GitHub's private vulnerability reporting feature instead.

## Known Security Notes

- This is a **LAN-oriented** tool. In production, ensure it runs on a trusted network.
- JWT secret should be changed from the default via the `JWT_SECRET` environment variable.
- CORS is configured to allow all origins by default — restrict in production.
- User passwords are hashed with bcrypt (10 rounds).
- The scan upload endpoint is unauthenticated by design (for script-based data collection).
