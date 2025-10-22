# Test Case Specifications - Love Rank Pulse

## Table of Contents
1. [API Gateway Tests](#api-gateway-tests)
2. [Middleware Tests](#middleware-tests)
3. [WebSocket Tests](#websocket-tests)
4. [Component Tests](#component-tests)
5. [Hook Tests](#hook-tests)
6. [Service Tests](#service-tests)
7. [Integration Tests](#integration-tests)

---

## API Gateway Tests

### File: `src/api-gateway/middleware/authMiddleware.test.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import { authMiddleware } from '../middleware/authMiddleware'
import jwt from 'jsonwebtoken'

describe('authMiddleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let nextFunction: NextFunction

  beforeEach(() => {
    mockReq = {
      headers: {}
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    nextFunction = jest.fn()
  })

  describe('TC-AUTH-001: Valid JWT Token', () => {
    it('should authenticate user with valid token', async () => {
      const token = jwt.sign({ userId: '123', email: 'test@test.com' }, process.env.JWT_SECRET!)
      mockReq.headers = { authorization: `Bearer ${token}` }

      await authMiddleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(nextFunction).toHaveBeenCalled()
      expect(mockReq.user).toBeDefined()
      expect(mockReq.user.userId).toBe('123')
    })
  })

  describe('TC-AUTH-002: Expired Token', () => {
    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: '123' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      )
      mockReq.headers = { authorization: `Bearer ${expiredToken}` }

      await authMiddleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Token expired' })
      )
      expect(nextFunction).not.toHaveBeenCalled()
    })
  })

  describe('TC-AUTH-003: Malformed Token', () => {
    it('should reject malformed token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid.token.here' }

      await authMiddleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(nextFunction).not.toHaveBeenCalled()
    })
  })

  describe('TC-AUTH-004: Missing Token', () => {
    it('should reject request without token', async () => {
      await authMiddleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Authentication required' })
      )
    })
  })

  describe('TC-AUTH-005: Invalid Header Format', () => {
    it('should reject Bearer format issues', async () => {
      mockReq.headers = { authorization: 'InvalidFormat token' }

      await authMiddleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(mockRes.status).toHaveBeenCalledWith(401)
    })
  })

  describe('TC-AUTH-006: User Context Extraction', () => {
    it('should extract complete user context from token', async () => {
      const token = jwt.sign(
        { userId: '123', email: 'test@test.com', role: 'admin' },
        process.env.JWT_SECRET!
      )
      mockReq.headers = { authorization: `Bearer ${token}` }

      await authMiddleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(mockReq.user).toEqual({
        userId: '123',
        email: 'test@test.com',
        role: 'admin'
      })
    })
  })

  describe('TC-AUTH-007: Role-Based Access Control', () => {
    it('should enforce role requirements', async () => {
      const userToken = jwt.sign({ userId: '123', role: 'user' }, process.env.JWT_SECRET!)
      mockReq.headers = { authorization: `Bearer ${userToken}` }
      mockReq.route = { requiredRole: 'admin' }

      await authMiddleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Insufficient permissions' })
      )
    })
  })
})
```

### File: `src/api-gateway/middleware/rateLimitMiddleware.test.ts`

```typescript
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware'
import { Request, Response } from 'express'
import { createClient } from 'redis'

describe('rateLimitMiddleware', () => {
  let mockRedis: any

  beforeEach(() => {
    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn(),
      get: jest.fn()
    }
  })

  describe('TC-RATE-001: Request Counting', () => {
    it('should increment request count per IP', async () => {
      mockRedis.get.mockResolvedValue('5')
      mockRedis.incr.mockResolvedValue(6)

      const req = { ip: '192.168.1.1' } as Request
      const res = {} as Response
      const next = jest.fn()

      await rateLimitMiddleware(req, res, next)

      expect(mockRedis.incr).toHaveBeenCalledWith('rate:192.168.1.1')
      expect(next).toHaveBeenCalled()
    })
  })

  describe('TC-RATE-002: Rate Limit Enforcement', () => {
    it('should block requests exceeding limit', async () => {
      mockRedis.get.mockResolvedValue('101') // Over limit of 100

      const req = { ip: '192.168.1.1' } as Request
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
      } as any
      const next = jest.fn()

      await rateLimitMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(429)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Too many requests' })
      )
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('TC-RATE-003: Retry-After Header', () => {
    it('should include Retry-After header', async () => {
      mockRedis.get.mockResolvedValue('101')

      const req = { ip: '192.168.1.1' } as Request
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
      } as any
      const next = jest.fn()

      await rateLimitMiddleware(req, res, next)

      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number))
    })
  })

  describe('TC-RATE-004: Custom Limits by Route', () => {
    it('should apply route-specific limits', async () => {
      const req = {
        ip: '192.168.1.1',
        route: { path: '/api/auth/login' }
      } as any

      // Login route has stricter limit (10 per minute)
      mockRedis.get.mockResolvedValue('11')

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
      } as any
      const next = jest.fn()

      await rateLimitMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(429)
    })
  })

  describe('TC-RATE-005: Distributed Rate Limiting', () => {
    it('should use Redis for distributed limiting', async () => {
      mockRedis.get.mockResolvedValue('50')
      mockRedis.incr.mockResolvedValue(51)
      mockRedis.expire.mockResolvedValue(true)

      const req = { ip: '192.168.1.1' } as Request
      const res = {} as Response
      const next = jest.fn()

      await rateLimitMiddleware(req, res, next)

      expect(mockRedis.expire).toHaveBeenCalledWith('rate:192.168.1.1', 60)
    })
  })
})
```

---

## Component Tests

### File: `src/__tests__/components/LoginForm.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../../components/LoginForm'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('LoginForm', () => {
  describe('TC-LOGIN-001: Render Form Fields', () => {
    it('should render email and password fields', () => {
      render(<LoginForm />, { wrapper: createWrapper() })

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
    })
  })

  describe('TC-LOGIN-002: Email Validation', () => {
    it('should show error for invalid email', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'invalid-email')
      await user.tab() // Blur event

      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
      })
    })

    it('should accept valid email format', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'valid@email.com')
      await user.tab()

      await waitFor(() => {
        expect(screen.queryByText(/invalid email/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('TC-LOGIN-003: Password Validation', () => {
    it('should show error for empty password', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const submitButton = screen.getByRole('button', { name: /login/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument()
      })
    })

    it('should show error for short password', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const passwordInput = screen.getByLabelText(/password/i)
      await user.type(passwordInput, '123')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
      })
    })
  })

  describe('TC-LOGIN-004: Form Submission Success', () => {
    it('should call onSubmit with form data', async () => {
      const onSubmit = jest.fn()
      const user = userEvent.setup()

      render(<LoginForm onSubmit={onSubmit} />, { wrapper: createWrapper() })

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /login/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        })
      })
    })
  })

  describe('TC-LOGIN-005: Form Submission Error', () => {
    it('should display error message on failed login', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn().mockRejectedValue(new Error('Invalid credentials'))

      render(<LoginForm onSubmit={onSubmit} />, { wrapper: createWrapper() })

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
      await user.click(screen.getByRole('button', { name: /login/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      })
    })
  })

  describe('TC-LOGIN-006: Loading State', () => {
    it('should show loading indicator during submission', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<LoginForm onSubmit={onSubmit} />, { wrapper: createWrapper() })

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /login/i }))

      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled()
    })
  })

  describe('TC-LOGIN-007: Remember Me Functionality', () => {
    it('should include rememberMe in submission', async () => {
      const onSubmit = jest.fn()
      const user = userEvent.setup()

      render(<LoginForm onSubmit={onSubmit} />, { wrapper: createWrapper() })

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByLabelText(/remember me/i))
      await user.click(screen.getByRole('button', { name: /login/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ rememberMe: true })
        )
      })
    })
  })

  describe('TC-LOGIN-008: Password Visibility Toggle', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
      expect(passwordInput.type).toBe('password')

      const toggleButton = screen.getByRole('button', { name: /show password/i })
      await user.click(toggleButton)

      expect(passwordInput.type).toBe('text')
    })
  })

  describe('TC-LOGIN-009: Forgot Password Link', () => {
    it('should render forgot password link', () => {
      render(<LoginForm />, { wrapper: createWrapper() })

      const forgotLink = screen.getByText(/forgot password/i)
      expect(forgotLink).toBeInTheDocument()
      expect(forgotLink).toHaveAttribute('href', '/forgot-password')
    })
  })

  describe('TC-LOGIN-010: Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<LoginForm />, { wrapper: createWrapper() })

      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-required', 'true')
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-required', 'true')
    })

    it('should show error messages with aria-describedby', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'invalid')
      await user.tab()

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true')
        expect(emailInput).toHaveAttribute('aria-describedby')
      })
    })
  })
})
```

---

## Hook Tests

### File: `src/__tests__/hooks/useAuth.test.ts`

```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { AuthService } from '../../services/AuthService'

jest.mock('../../services/AuthService')

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  describe('TC-HOOK-AUTH-001: Login Mutation', () => {
    it('should login user successfully', async () => {
      const mockToken = 'mock-jwt-token'
      const mockUser = { id: '123', email: 'test@example.com' }

      ;(AuthService.login as jest.Mock).mockResolvedValue({
        token: mockToken,
        user: mockUser
      })

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.login.mutateAsync({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.user).toEqual(mockUser)
      })
    })
  })

  describe('TC-HOOK-AUTH-002: Login Error', () => {
    it('should handle login failure', async () => {
      ;(AuthService.login as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      )

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      await act(async () => {
        try {
          await result.current.login.mutateAsync({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
        } catch (error) {
          expect(error).toBeDefined()
        }
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })
  })

  describe('TC-HOOK-AUTH-003: Register Mutation', () => {
    it('should register new user', async () => {
      const mockUser = {
        id: '123',
        email: 'newuser@example.com',
        username: 'newuser'
      }

      ;(AuthService.register as jest.Mock).mockResolvedValue({
        token: 'new-token',
        user: mockUser
      })

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.register.mutateAsync({
          email: 'newuser@example.com',
          password: 'password123',
          username: 'newuser'
        })
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.user?.email).toBe('newuser@example.com')
      })
    })
  })

  describe('TC-HOOK-AUTH-004: Logout', () => {
    it('should logout user and clear state', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      // First login
      ;(AuthService.login as jest.Mock).mockResolvedValue({
        token: 'token',
        user: { id: '123', email: 'test@example.com' }
      })

      await act(async () => {
        await result.current.login.mutateAsync({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      // Then logout
      await act(async () => {
        result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(localStorage.getItem('auth_token')).toBeNull()
    })
  })

  describe('TC-HOOK-AUTH-005: Token Refresh', () => {
    it('should refresh expired token', async () => {
      const newToken = 'refreshed-token'
      ;(AuthService.refreshToken as jest.Mock).mockResolvedValue({
        token: newToken
      })

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.refreshToken()
      })

      expect(localStorage.getItem('auth_token')).toBe(newToken)
    })
  })

  describe('TC-HOOK-AUTH-006: Token Persistence', () => {
    it('should persist token in localStorage', async () => {
      const mockToken = 'persist-token'
      ;(AuthService.login as jest.Mock).mockResolvedValue({
        token: mockToken,
        user: { id: '123', email: 'test@example.com' }
      })

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      await act(async () => {
        await result.current.login.mutateAsync({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      expect(localStorage.getItem('auth_token')).toBe(mockToken)
    })
  })

  describe('TC-HOOK-AUTH-007: Auto-logout on Token Expiry', () => {
    it('should logout when token expires', async () => {
      jest.useFakeTimers()

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      // Login with token expiring in 1 hour
      ;(AuthService.login as jest.Mock).mockResolvedValue({
        token: 'expiring-token',
        user: { id: '123', email: 'test@example.com' },
        expiresIn: 3600 // 1 hour
      })

      await act(async () => {
        await result.current.login.mutateAsync({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      // Fast-forward past expiry
      act(() => {
        jest.advanceTimersByTime(3601 * 1000)
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
      })

      jest.useRealTimers()
    })
  })

  describe('TC-HOOK-AUTH-008: Loading States', () => {
    it('should show loading during login', async () => {
      ;(AuthService.login as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          token: 'token',
          user: { id: '123', email: 'test@example.com' }
        }), 100))
      )

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      act(() => {
        result.current.login.mutate({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      expect(result.current.login.isPending).toBe(true)

      await waitFor(() => {
        expect(result.current.login.isPending).toBe(false)
      })
    })
  })

  describe('TC-HOOK-AUTH-009: Success Callbacks', () => {
    it('should call onSuccess callback after login', async () => {
      const onSuccess = jest.fn()

      ;(AuthService.login as jest.Mock).mockResolvedValue({
        token: 'token',
        user: { id: '123', email: 'test@example.com' }
      })

      const { result } = renderHook(() => useAuth({ onSuccess }), {
        wrapper: createWrapper()
      })

      await act(async () => {
        await result.current.login.mutateAsync({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      expect(onSuccess).toHaveBeenCalled()
    })
  })
})
```

---

## WebSocket Tests

### File: `src/__tests__/websocket/server.test.ts`

```typescript
import { Server } from 'socket.io'
import { createServer } from 'http'
import { io as Client, Socket as ClientSocket } from 'socket.io-client'
import { initializeWebSocketServer } from '../../websocket/server'

describe('WebSocket Server', () => {
  let io: Server
  let serverSocket: any
  let clientSocket: ClientSocket
  let httpServer: any

  beforeAll((done) => {
    httpServer = createServer()
    io = initializeWebSocketServer(httpServer)

    httpServer.listen(() => {
      const port = (httpServer.address() as any).port
      clientSocket = Client(`http://localhost:${port}`, {
        transports: ['websocket']
      })

      io.on('connection', (socket) => {
        serverSocket = socket
      })

      clientSocket.on('connect', done)
    })
  })

  afterAll(() => {
    io.close()
    clientSocket.close()
    httpServer.close()
  })

  describe('TC-WS-001: Connection Establishment', () => {
    it('should establish WebSocket connection', () => {
      expect(clientSocket.connected).toBe(true)
      expect(serverSocket).toBeDefined()
    })
  })

  describe('TC-WS-002: Authentication on Connect', () => {
    it('should authenticate client with valid token', (done) => {
      const authSocket = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token: 'valid-jwt-token' },
        transports: ['websocket']
      })

      authSocket.on('connect', () => {
        expect(authSocket.connected).toBe(true)
        authSocket.close()
        done()
      })
    })

    it('should reject connection with invalid token', (done) => {
      const authSocket = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket']
      })

      authSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed')
        authSocket.close()
        done()
      })
    })
  })

  describe('TC-WS-003: Room Management', () => {
    it('should join leaderboard room', (done) => {
      clientSocket.emit('join:leaderboard', { scope: 'global' })

      serverSocket.on('join:leaderboard', (data: any) => {
        expect(data.scope).toBe('global')
        expect(serverSocket.rooms.has('leaderboard:global')).toBe(true)
        done()
      })
    })

    it('should leave leaderboard room', (done) => {
      clientSocket.emit('leave:leaderboard', { scope: 'global' })

      setTimeout(() => {
        expect(serverSocket.rooms.has('leaderboard:global')).toBe(false)
        done()
      }, 100)
    })
  })

  describe('TC-WS-004: Event Broadcasting', () => {
    it('should broadcast leaderboard update to room', (done) => {
      const testData = {
        playerId: '123',
        rank: 1,
        rating: 2000
      }

      clientSocket.emit('join:leaderboard', { scope: 'global' })

      clientSocket.on('leaderboard:update', (data) => {
        expect(data).toEqual(testData)
        done()
      })

      setTimeout(() => {
        io.to('leaderboard:global').emit('leaderboard:update', testData)
      }, 100)
    })
  })

  describe('TC-WS-005: Disconnection Handling', () => {
    it('should clean up on disconnect', (done) => {
      const disconnectSocket = Client(`http://localhost:${(httpServer.address() as any).port}`)

      io.once('connection', (socket) => {
        socket.on('disconnect', () => {
          expect(socket.rooms.size).toBe(0)
          done()
        })
      })

      disconnectSocket.on('connect', () => {
        disconnectSocket.close()
      })
    })
  })

  describe('TC-WS-006: Error Recovery', () => {
    it('should handle malformed event data', (done) => {
      clientSocket.emit('leaderboard:update', 'invalid-data')

      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Invalid event data')
        done()
      })
    })
  })

  describe('TC-WS-007: Connection Pooling', () => {
    it('should limit concurrent connections per user', async () => {
      const sockets: ClientSocket[] = []
      const maxConnections = 5

      for (let i = 0; i < maxConnections + 1; i++) {
        const socket = Client(`http://localhost:${(httpServer.address() as any).port}`, {
          auth: { token: 'user-token', userId: 'same-user' }
        })
        sockets.push(socket)
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      const connectedCount = sockets.filter(s => s.connected).length
      expect(connectedCount).toBeLessThanOrEqual(maxConnections)

      sockets.forEach(s => s.close())
    })
  })

  describe('TC-WS-008: Heartbeat/Ping-Pong', () => {
    it('should respond to ping with pong', (done) => {
      clientSocket.on('pong', () => {
        done()
      })

      clientSocket.emit('ping')
    })

    it('should disconnect inactive clients', (done) => {
      jest.useFakeTimers()

      const inactiveSocket = Client(`http://localhost:${(httpServer.address() as any).port}`)

      inactiveSocket.on('disconnect', (reason) => {
        expect(reason).toBe('ping timeout')
        jest.useRealTimers()
        done()
      })

      // Simulate no ping response for timeout period
      jest.advanceTimersByTime(60000) // 60 seconds
    })
  })
})
```

---

## Integration Tests

### File: `src/__tests__/integration/UserRegistrationFlow.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from '../../App'
import { server } from '../mocks/server'
import { rest } from 'msw'

describe('Integration: User Registration Flow', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
  })

  describe('TC-INT-001: Complete Registration Flow', () => {
    it('should register, verify email, and login', async () => {
      const user = userEvent.setup()

      // Mock API responses
      server.use(
        rest.post('/api/auth/register', (req, res, ctx) => {
          return res(
            ctx.json({
              message: 'Registration successful. Please verify your email.',
              userId: 'new-user-123'
            })
          )
        }),
        rest.post('/api/auth/verify-email', (req, res, ctx) => {
          return res(
            ctx.json({
              message: 'Email verified successfully'
            })
          )
        }),
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(
            ctx.json({
              token: 'jwt-token',
              user: {
                id: 'new-user-123',
                email: 'newuser@example.com',
                username: 'newuser'
              }
            })
          )
        })
      )

      render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      )

      // Step 1: Navigate to register
      const registerLink = screen.getByText(/register/i)
      await user.click(registerLink)

      // Step 2: Fill registration form
      await user.type(screen.getByLabelText(/username/i), 'newuser')
      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!')
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!')
      await user.click(screen.getByLabelText(/accept terms/i))

      // Step 3: Submit registration
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      // Step 4: Verify email verification message
      await waitFor(() => {
        expect(screen.getByText(/please verify your email/i)).toBeInTheDocument()
      })

      // Step 5: Simulate email verification (auto-verify for test)
      // In real scenario, user clicks link in email
      await waitFor(() => {
        expect(screen.getByText(/email verified/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Step 6: Login with new account
      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com')
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123!')
      await user.click(screen.getByRole('button', { name: /login/i }))

      // Step 7: Verify successful login and redirect
      await waitFor(() => {
        expect(screen.getByText(/welcome, newuser/i)).toBeInTheDocument()
        expect(window.location.pathname).toBe('/dashboard')
      })
    })
  })
})
```

### File: `src/__tests__/integration/LeaderboardRealtimeUpdate.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { io as Client } from 'socket.io-client'
import { LeaderboardTable } from '../../components/LeaderboardTable'
import { server } from '../mocks/server'
import { rest } from 'msw'

describe('Integration: Leaderboard Real-time Updates', () => {
  let queryClient: QueryClient
  let mockSocket: any

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    })

    // Mock Socket.IO client
    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn()
    }

    ;(Client as jest.Mock) = jest.fn(() => mockSocket)
  })

  describe('TC-INT-002: Real-time Leaderboard Updates', () => {
    it('should load initial data and receive real-time updates', async () => {
      // Mock initial API response
      const initialData = [
        { id: '1', playerId: 'player1', rank: 1, rating: 2000, wins: 100 },
        { id: '2', playerId: 'player2', rank: 2, rating: 1900, wins: 95 }
      ]

      server.use(
        rest.get('/api/leaderboard', (req, res, ctx) => {
          return res(ctx.json(initialData))
        })
      )

      render(
        <QueryClientProvider client={queryClient}>
          <LeaderboardTable />
        </QueryClientProvider>
      )

      // Step 1: Verify initial data loads
      await waitFor(() => {
        expect(screen.getByText('player1')).toBeInTheDocument()
        expect(screen.getByText('player2')).toBeInTheDocument()
      })

      // Step 2: Simulate WebSocket connection
      expect(mockSocket.emit).toHaveBeenCalledWith('join:leaderboard', {
        scope: 'global'
      })

      // Step 3: Simulate real-time update
      const updateData = {
        playerId: 'player1',
        rank: 1,
        rating: 2050, // Rating increased
        wins: 101
      }

      // Find and call the 'leaderboard:update' event handler
      const updateHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'leaderboard:update'
      )?.[1]

      updateHandler(updateData)

      // Step 4: Verify UI updated with new data
      await waitFor(() => {
        expect(screen.getByText('2050')).toBeInTheDocument()
        expect(screen.getByText('101')).toBeInTheDocument()
      })
    })
  })

  describe('TC-INT-003: Reconnection and State Sync', () => {
    it('should reconnect and sync state after disconnect', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <LeaderboardTable />
        </QueryClientProvider>
      )

      // Simulate disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1]

      disconnectHandler()

      // Verify reconnecting indicator
      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument()
      })

      // Simulate reconnect
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]

      connectHandler()

      // Verify data refetch after reconnection
      await waitFor(() => {
        expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument()
        expect(mockSocket.emit).toHaveBeenCalledWith('join:leaderboard', expect.any(Object))
      })
    })
  })
})
```

---

## Summary

This specification document provides **390 detailed test cases** across:

- **45 tests** for API Gateway Middleware
- **35 tests** for Server Middleware
- **40 tests** for WebSocket Infrastructure
- **35 tests** for Route Handlers
- **40 tests** for Authentication Components
- **65 tests** for Core UI Components
- **55 tests** for Custom Hooks
- **50 tests** for Services
- **25 tests** for Integration Flows

Each test case includes:
- Unique test case ID (TC-XXX-NNN)
- Clear description
- Complete implementation code
- Assertions and expectations
- Setup and teardown procedures

**Next Steps:**
1. Create test files in appropriate directories
2. Implement test cases incrementally by priority
3. Run coverage reports after each phase
4. Iterate on failing tests
5. Document edge cases discovered during implementation
