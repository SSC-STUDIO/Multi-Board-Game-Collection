# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within Multi-Board-Game-Collection, please send an email to the project maintainers. All security vulnerabilities will be promptly addressed.

**Please do NOT report security vulnerabilities through public GitHub issues.**

### What to include

- Type of issue (e.g., XSS, data exposure, API key leak)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact assessment

### Response timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix or mitigation**: Within 2 weeks for critical issues

### LLM API Key Security

The LLM Coach feature allows users to enter their own API keys. These keys are:
- Stored only in the user's browser (localStorage)
- Never sent to any server other than the user's configured API endpoint
- Obfuscated using XOR + Base64 for basic protection
- Users are responsible for keeping their API keys secure

### Best Practices for Users

1. Never share your API keys publicly
2. Use API keys with minimal required permissions
3. Regularly rotate your API keys
4. Monitor your API usage for unexpected activity

## Security Best Practices in the Codebase

- No hardcoded API keys or secrets
- Client-side storage only (no server-side data collection)
- Open source — full code transparency
- Regular dependency updates via npm audit
