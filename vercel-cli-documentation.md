# Vercel CLI Installation and Authentication Guide

## Installation

The Vercel CLI has been successfully installed on this system with the following command:

```bash
npm install -g vercel
```

Current installed version: **Vercel CLI 48.4.1**

## Authentication Process

After installing the Vercel CLI, you'll need to authenticate to connect the CLI with your Vercel account. Follow these steps:

1. **Initiate the login process** by running:
   ```bash
   vercel login
   ```

2. **Choose authentication method**:
   - The CLI will prompt you to choose between email and SSO authentication
   - For email authentication, you'll be asked to enter your email address
   - For SSO authentication, you'll need to provide your team ID

3. **Complete the authentication**:
   - For email authentication:
     - A verification email will be sent to your provided email address
     - Open the email and click the verification link
     - The browser will open and confirm the authentication
     - Return to your terminal where you should see a success message

   - For browser-based authentication (default in most environments):
     - A browser window will automatically open
     - Log in with your Vercel account credentials or SSO
     - After successful login, the browser will confirm authentication
     - Return to your terminal where you should see a success message

4. **Verify successful authentication** by running:
   ```bash
   vercel whoami
   ```
   This should display your username or email address, confirming you're logged in.

## Potential Installation Issues and Solutions

### Issue 1: Permission Errors During Installation

**Symptoms**: Error messages containing "EACCES" or "permission denied" when running `npm install -g vercel`.

**Solutions**:
- **Option 1**: Use sudo (not recommended for security reasons)
  ```bash
  sudo npm install -g vercel
  ```

- **Option 2**: Fix npm permissions (recommended)
  ```bash
  mkdir -p ~/.npm-global
  npm config set prefix '~/.npm-global'
  echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
  source ~/.profile
  npm install -g vercel
  ```

### Issue 2: Node.js Version Compatibility

**Symptoms**: Error messages about incompatible Node.js version.

**Solution**: Update Node.js to a compatible version
  ```bash
  # Using nvm (Node Version Manager)
  nvm install --lts
  nvm use --lts
  
  # Or update Node.js directly
  npm install -g n
  n stable
  ```

### Issue 3: Network Issues During Authentication

**Symptoms**: Timeout errors or connection refused errors during the login process.

**Solutions**:
- Check your internet connection
- If behind a corporate firewall or proxy, configure npm to use it:
  ```bash
  npm config set proxy http://your-proxy-address:port
  npm config set https-proxy http://your-proxy-address:port
  ```

### Issue 4: Login Token Expiration

**Symptoms**: Previously working commands suddenly require authentication.

**Solution**: Re-authenticate by running:
  ```bash
  vercel logout
  vercel login
  ```

## Additional Commands

- **Logout from Vercel**:
  ```bash
  vercel logout
  ```

- **Check current user**:
  ```bash
  vercel whoami
  ```

- **Switch between teams/scopes**:
  ```bash
  vercel switch [team-name]
  ```

- **Get help with any command**:
  ```bash
  vercel help [command]
  ```

## Telemetry Notice

The Vercel CLI collects telemetry data regarding usage. To opt out of this program, visit:
https://vercel.com/docs/cli/about-telemetry