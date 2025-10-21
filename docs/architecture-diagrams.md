# Love Rank Pulse - Architecture Diagrams

## System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Client[React Frontend<br/>TypeScript]
    end

    subgraph "API Gateway Layer"
        Gateway[API Gateway<br/>Express.js]
        RateLimit[Rate Limiter<br/>5-100 req/15min]
        Auth[Auth Middleware<br/>JWT Verification]
        CORS[CORS Handler<br/>Whitelisted Origins]
        Logger[Request Logger<br/>Winston]
        ErrorHandler[Error Handler<br/>Structured Responses]
    end

    subgraph "Service Layer"
        PlayerSvc[PlayerService<br/>Auth & Profiles]
        MatchSvc[MatchService<br/>ELO & Results]
        LeaderboardSvc[LeaderboardService<br/>Rankings & Cache]
    end

    subgraph "Data Layer"
        Prisma[Prisma ORM<br/>Type-Safe Queries]
        Redis[(Redis Cache<br/>60s TTL)]
        PostgreSQL[(PostgreSQL<br/>Primary Database)]
    end

    Client -->|HTTPS| Gateway
    Gateway --> RateLimit
    RateLimit --> CORS
    CORS --> Auth
    Auth --> Logger
    Logger --> PlayerSvc
    Logger --> MatchSvc
    Logger --> LeaderboardSvc

    PlayerSvc --> Prisma
    MatchSvc --> Prisma
    LeaderboardSvc --> Prisma
    LeaderboardSvc <-->|Cache Aside| Redis

    Prisma --> PostgreSQL

    PlayerSvc -.->|Errors| ErrorHandler
    MatchSvc -.->|Errors| ErrorHandler
    LeaderboardSvc -.->|Errors| ErrorHandler
    ErrorHandler -.->|Response| Client

    style Client fill:#e1f5ff
    style Gateway fill:#fff4e1
    style PlayerSvc fill:#e8f5e9
    style MatchSvc fill:#e8f5e9
    style LeaderboardSvc fill:#e8f5e9
    style Redis fill:#ffe1e1
    style PostgreSQL fill:#e8eaf6
```

## Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant Client as React App
    participant Gateway as API Gateway
    participant Auth as Auth Middleware
    participant PlayerSvc as PlayerService
    participant DB as PostgreSQL
    participant JWT as JWT Service

    User->>Client: Enter credentials
    Client->>Gateway: POST /api/auth/login
    Gateway->>Auth: Verify CORS
    Auth->>PlayerSvc: login(credentials)
    PlayerSvc->>DB: Find user by email
    DB-->>PlayerSvc: User data + password hash
    PlayerSvc->>PlayerSvc: bcrypt.compare(password, hash)
    alt Password Valid
        PlayerSvc->>JWT: Generate access token (15min)
        PlayerSvc->>JWT: Generate refresh token (7d)
        JWT-->>PlayerSvc: tokens
        PlayerSvc-->>Gateway: AuthResponse{user, tokens}
        Gateway-->>Client: 200 OK {user, tokens}
        Client->>Client: Store tokens in localStorage
        Client-->>User: Login successful
    else Password Invalid
        PlayerSvc-->>Gateway: Error: Invalid credentials
        Gateway-->>Client: 401 Unauthorized
        Client-->>User: Login failed
    end
```

## Match Result Submission Flow

```mermaid
sequenceDiagram
    actor User
    participant Client as React App
    participant Gateway as API Gateway
    participant Auth as Auth Middleware
    participant MatchSvc as MatchService
    participant DB as PostgreSQL
    participant LeaderboardSvc as LeaderboardService
    participant Redis as Redis Cache

    User->>Client: Submit match result
    Client->>Gateway: POST /api/matches/:id/result<br/>{player1Score, player2Score}
    Gateway->>Auth: Verify JWT token
    Auth-->>Gateway: User authenticated
    Gateway->>MatchSvc: submitMatchResult(input)

    Note over MatchSvc,DB: Transaction Start
    MatchSvc->>DB: Get match with players
    DB-->>MatchSvc: Match{player1, player2}
    MatchSvc->>MatchSvc: Calculate ELO changes<br/>P1: 1200 → 1232<br/>P2: 1250 → 1218

    par Update Operations
        MatchSvc->>DB: Create MatchResult
        MatchSvc->>DB: Update Player 1 rating
        MatchSvc->>DB: Update Player 2 rating
        MatchSvc->>DB: Update Match status
    end
    Note over MatchSvc,DB: Transaction Commit

    DB-->>MatchSvc: MatchResult
    MatchSvc->>LeaderboardSvc: invalidateCache(player1, player2)
    LeaderboardSvc->>Redis: DEL leaderboard:*
    LeaderboardSvc->>Redis: DEL player:{id}:*
    Redis-->>LeaderboardSvc: Cache cleared

    MatchSvc-->>Gateway: MatchResult
    Gateway-->>Client: 200 OK {result}
    Client-->>User: Match result recorded
```

## Leaderboard Query Flow (Cache-Aside Pattern)

```mermaid
sequenceDiagram
    actor User
    participant Client as React App
    participant Gateway as API Gateway
    participant LeaderboardSvc as LeaderboardService
    participant Redis as Redis Cache
    participant DB as PostgreSQL

    User->>Client: View leaderboard
    Client->>Gateway: GET /api/leaderboard?page=1&limit=50
    Gateway->>LeaderboardSvc: getLeaderboard({page, limit})

    LeaderboardSvc->>LeaderboardSvc: Build cache key<br/>"leaderboard:page:1:limit:50:type:GLOBAL"
    LeaderboardSvc->>Redis: GET cache_key

    alt Cache Hit (85-95% of requests)
        Redis-->>LeaderboardSvc: Cached data
        LeaderboardSvc-->>Gateway: LeaderboardResponse (< 50ms)
        Gateway-->>Client: 200 OK {entries, pagination}
        Client-->>User: Display leaderboard
    else Cache Miss
        Redis-->>LeaderboardSvc: null
        LeaderboardSvc->>DB: Query leaderboard entries
        DB-->>LeaderboardSvc: Entries + total count
        LeaderboardSvc->>LeaderboardSvc: Format response
        LeaderboardSvc->>Redis: SETEX cache_key 60 data
        Redis-->>LeaderboardSvc: OK
        LeaderboardSvc-->>Gateway: LeaderboardResponse (200-500ms)
        Gateway-->>Client: 200 OK {entries, pagination}
        Client-->>User: Display leaderboard
    end
```

## Rate Limiting Flow

```mermaid
sequenceDiagram
    actor User
    participant Client as React App
    participant Gateway as API Gateway
    participant RateLimiter as Rate Limiter
    participant Redis as Redis (Rate Limit Store)
    participant Service as Service Layer

    User->>Client: Make API request
    Client->>Gateway: Request
    Gateway->>RateLimiter: Check rate limit
    RateLimiter->>Redis: GET rate_limit:{ip}:{endpoint}
    Redis-->>RateLimiter: Current count

    alt Within Limit
        RateLimiter->>Redis: INCR rate_limit:{ip}:{endpoint}
        RateLimiter->>Redis: EXPIRE 900 (15min)
        RateLimiter-->>Gateway: Allow request
        Gateway->>Service: Process request
        Service-->>Gateway: Response
        Gateway-->>Client: 200 OK + X-RateLimit-Remaining: 95
        Client-->>User: Success
    else Rate Limit Exceeded
        RateLimiter-->>Gateway: Reject request
        Gateway-->>Client: 429 Too Many Requests<br/>X-RateLimit-Reset: 600s
        Client-->>User: Error: Please wait
    end
```

## Database Schema Relationships

```mermaid
erDiagram
    Player ||--o{ Match : "plays as player1"
    Player ||--o{ Match : "plays as player2"
    Player ||--o{ MatchResult : "wins"
    Player ||--o{ MatchResult : "loses"
    Player ||--o{ LeaderboardEntry : "has"
    Match ||--|| MatchResult : "has"

    Player {
        string id PK
        string username UK
        string email UK
        int elo_rating
        int rank
        int matches_played
        int wins
        int losses
        int draws
        datetime created_at
        datetime last_active_at
    }

    Match {
        string id PK
        string player1_id FK
        string player2_id FK
        enum status
        enum match_type
        datetime created_at
        datetime completed_at
    }

    MatchResult {
        string id PK
        string match_id FK UK
        string winner_id FK
        string loser_id FK
        int player1_score
        int player2_score
        int rating_change
        int winner_new_elo
        int loser_new_elo
        enum result_type
        datetime created_at
    }

    LeaderboardEntry {
        string id PK
        string player_id FK
        int rank
        int previous_rank
        int rank_change
        int elo_rating
        int peak_elo
        int wins
        int losses
        int draws
        float win_rate
        datetime last_updated
    }
```

## Service Dependencies

```mermaid
graph TD
    subgraph "Frontend"
        React[React App]
    end

    subgraph "API Gateway"
        Express[Express Server]
    end

    subgraph "Services"
        PlayerSvc[PlayerService]
        MatchSvc[MatchService]
        LeaderboardSvc[LeaderboardService]
    end

    subgraph "External Dependencies"
        Prisma[Prisma ORM]
        JWT[jsonwebtoken]
        Bcrypt[bcrypt]
        Redis[Redis Client]
        Winston[Winston Logger]
        Helmet[Helmet.js]
        RateLimit[express-rate-limit]
    end

    subgraph "Infrastructure"
        PostgreSQL[(PostgreSQL)]
        RedisDB[(Redis)]
    end

    React --> Express
    Express --> PlayerSvc
    Express --> MatchSvc
    Express --> LeaderboardSvc

    Express --> Helmet
    Express --> RateLimit
    Express --> Winston

    PlayerSvc --> Prisma
    PlayerSvc --> JWT
    PlayerSvc --> Bcrypt

    MatchSvc --> Prisma

    LeaderboardSvc --> Prisma
    LeaderboardSvc --> Redis

    Prisma --> PostgreSQL
    Redis --> RedisDB
    RateLimit --> RedisDB

    style React fill:#61dafb
    style Express fill:#68a063
    style PlayerSvc fill:#3178c6
    style MatchSvc fill:#3178c6
    style LeaderboardSvc fill:#3178c6
    style PostgreSQL fill:#336791
    style RedisDB fill:#dc382d
```

## ELO Rating Calculation Flow

```mermaid
flowchart TD
    Start[Match Completed] --> GetRatings[Get Current Ratings<br/>Player 1: R₁<br/>Player 2: R₂]
    GetRatings --> CalcExpected[Calculate Expected Scores<br/>E₁ = 1/(1+10^((R₂-R₁)/400))<br/>E₂ = 1/(1+10^((R₁-R₂)/400))]
    CalcExpected --> GetActual[Get Actual Scores<br/>Win: 1.0<br/>Draw: 0.5<br/>Loss: 0.0]
    GetActual --> CalcNew[Calculate New Ratings<br/>R₁_new = R₁ + K*(S₁ - E₁)<br/>R₂_new = R₂ + K*(S₂ - E₂)<br/>K-Factor = 32]
    CalcNew --> Clamp[Clamp Ratings<br/>Min: 100<br/>Max: 3000]
    Clamp --> Round[Round to Integer]
    Round --> CalcChange[Calculate Change<br/>Δ = |R_new - R_old|]
    CalcChange --> UpdateDB[Update Database<br/>Transaction Start]
    UpdateDB --> CreateResult[Create MatchResult]
    CreateResult --> UpdateP1[Update Player 1 Rating]
    UpdateP1 --> UpdateP2[Update Player 2 Rating]
    UpdateP2 --> UpdateMatch[Update Match Status]
    UpdateMatch --> Commit[Transaction Commit]
    Commit --> InvalidateCache[Invalidate Leaderboard Cache]
    InvalidateCache --> End[Complete]

    style Start fill:#e1f5ff
    style CalcExpected fill:#fff4e1
    style CalcNew fill:#fff4e1
    style UpdateDB fill:#ffe1e1
    style Commit fill:#e8f5e9
    style End fill:#e1f5ff
```

## Cache Invalidation Strategy

```mermaid
flowchart TD
    Event{Cache Invalidation<br/>Event}

    Event -->|Match Result| MatchEvent[Match Completed]
    Event -->|Player Action| PlayerEvent[Player Profile Updated]
    Event -->|System| SystemEvent[Rank Recalculation]

    MatchEvent --> InvalidatePlayer[Invalidate Player Caches<br/>player:{id}:*]
    MatchEvent --> InvalidateLeaderboard[Invalidate Leaderboard<br/>leaderboard:*]

    PlayerEvent --> InvalidatePlayerProfile[Invalidate Player Profile<br/>player:{id}:*]

    SystemEvent --> InvalidateAll[Invalidate All Caches<br/>leaderboard:*<br/>player:*]

    InvalidatePlayer --> Redis1[(Redis DEL)]
    InvalidateLeaderboard --> Redis1
    InvalidatePlayerProfile --> Redis2[(Redis DEL)]
    InvalidateAll --> Redis3[(Redis FLUSHDB)]

    Redis1 --> WarmCache1[Warm Cache<br/>Pre-fetch Top 100]
    Redis2 --> End1[Complete]
    Redis3 --> WarmCache2[Warm Cache<br/>Pre-fetch Top 3 Pages]

    WarmCache1 --> End2[Complete]
    WarmCache2 --> End3[Complete]

    style Event fill:#fff4e1
    style InvalidatePlayer fill:#ffe1e1
    style InvalidateLeaderboard fill:#ffe1e1
    style InvalidateAll fill:#ffe1e1
    style WarmCache1 fill:#e8f5e9
    style WarmCache2 fill:#e8f5e9
```

## Deployment Architecture (Production)

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Nginx Load Balancer<br/>SSL Termination]
    end

    subgraph "Application Servers (3 instances)"
        App1[API Gateway 1<br/>Express + Services]
        App2[API Gateway 2<br/>Express + Services]
        App3[API Gateway 3<br/>Express + Services]
    end

    subgraph "Database Cluster"
        PG_Primary[(PostgreSQL Primary<br/>Read/Write)]
        PG_Replica1[(PostgreSQL Replica 1<br/>Read Only)]
        PG_Replica2[(PostgreSQL Replica 2<br/>Read Only)]
    end

    subgraph "Cache Cluster"
        Redis_Master[(Redis Master)]
        Redis_Replica[(Redis Replica)]
    end

    subgraph "Monitoring"
        Prometheus[Prometheus<br/>Metrics]
        Grafana[Grafana<br/>Dashboards]
        Winston[Winston Logs]
        ELK[ELK Stack<br/>Log Aggregation]
    end

    Internet((Internet)) --> LB
    LB --> App1
    LB --> App2
    LB --> App3

    App1 --> PG_Primary
    App2 --> PG_Primary
    App3 --> PG_Primary

    App1 -.->|Read| PG_Replica1
    App2 -.->|Read| PG_Replica2
    App3 -.->|Read| PG_Replica1

    App1 <--> Redis_Master
    App2 <--> Redis_Master
    App3 <--> Redis_Master

    PG_Primary -.->|Replication| PG_Replica1
    PG_Primary -.->|Replication| PG_Replica2
    Redis_Master -.->|Replication| Redis_Replica

    App1 -.->|Metrics| Prometheus
    App2 -.->|Metrics| Prometheus
    App3 -.->|Metrics| Prometheus
    Prometheus --> Grafana

    App1 -.->|Logs| Winston
    App2 -.->|Logs| Winston
    App3 -.->|Logs| Winston
    Winston --> ELK

    style LB fill:#68a063
    style App1 fill:#3178c6
    style App2 fill:#3178c6
    style App3 fill:#3178c6
    style PG_Primary fill:#336791
    style PG_Replica1 fill:#5c8eb7
    style PG_Replica2 fill:#5c8eb7
    style Redis_Master fill:#dc382d
    style Redis_Replica fill:#e57373
```

---

**Generated**: 2025-10-21
**Version**: 1.0.0
