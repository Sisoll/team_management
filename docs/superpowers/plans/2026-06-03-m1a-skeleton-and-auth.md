# M1-A：行走骨架 + 登入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立全端骨架並跑通「註冊 → 登入 → 取得自身資料」對真 PostgreSQL 的端到端流程（AC-1）。

**Architecture:** 後端 Spring Boot（API-first），事件/狀態之外的一切以一般 REST 提供；前端 React+TS 透過 fetch 串接；資料庫 PostgreSQL，整合測試以 Testcontainers 啟動真 Postgres（本機透過 Podman socket）。本份計畫先把整條 toolchain 走通（骨架）再做第一個真功能（auth），以最早暴露 Podman/Testcontainers/scaffolding 風險。

**Tech Stack:** Java 21 · Spring Boot 3.5 · Maven · Spring Security 6 + JWT(jjwt 0.12) · Spring Data JPA · Flyway · PostgreSQL 16 · Testcontainers · React 18 + Vite + TypeScript · Playwright

**對應 design doc：** `docs/superpowers/specs/2026-06-03-baseball-record-mvp-design.md`（里程碑 M1）

---

## Scaffolding 決策（本計畫一次鎖定）

| 項目 | 選擇 |
|---|---|
| 建置工具 / JDK | Maven · **Java 21（LTS，本專案限定；系統全域維持 17 不動）** |
| 後端框架 | Spring Boot 3.5.x（最新 3.5 patch；建置時確認） |
| DB / migration | PostgreSQL 16 · Flyway |
| 認證 | Spring Security 6；自簽 JWT（HS256，jjwt 0.12）；密碼 BCrypt |
| 整合測試 | JUnit 5 + Spring Boot Test + Testcontainers（JDBC URL 模式）+ MockMvc |
| 前端 | React 18 + Vite + TypeScript + npm；fetch-based api client |
| 本機容器 | **Podman（無 Docker）**：Testcontainers 走 Podman socket |

## File Structure（本計畫會建立 / 修改）

```
backend/
├── pom.xml                                  # Maven + 依賴
├── compose.yaml                             # 本機 podman compose：Postgres
├── src/main/java/com/baseball/record/
│   ├── BaseballRecordApplication.java
│   ├── common/
│   │   └── HealthController.java            # GET /api/health（骨架驗證）
│   ├── auth/
│   │   ├── UserAccount.java                 # JPA entity
│   │   ├── UserAccountRepository.java
│   │   ├── AuthService.java
│   │   ├── AuthController.java              # /api/auth/register|login|me
│   │   └── dto/{RegisterRequest,LoginRequest,AuthResponse,MeResponse}.java
│   └── security/
│       ├── JwtService.java                  # 簽發/驗證 JWT
│       ├── JwtAuthFilter.java               # OncePerRequestFilter
│       └── SecurityConfig.java              # SecurityFilterChain + PasswordEncoder
├── src/main/resources/
│   ├── application.yaml
│   ├── application-test.yaml                # Testcontainers JDBC URL
│   └── db/migration/
│       └── V1__users.sql                    # users 表
└── src/test/java/com/baseball/record/
    ├── support/IntegrationTest.java         # @SpringBootTest 基底（Testcontainers）
    ├── common/HealthControllerIT.java
    ├── security/JwtServiceTest.java         # 純單元
    └── auth/AuthControllerIT.java

frontend/
├── package.json / vite.config.ts / tsconfig.json
├── index.html
├── src/{main.tsx,App.tsx}
├── src/api/client.ts                        # fetch wrapper + token
├── src/pages/{LoginPage.tsx}
└── e2e/auth.spec.ts                         # Playwright AC-1
docs/dev-podman.md                           # Podman/Testcontainers 設定說明
```

---

## Phase 0：行走骨架（走通 toolchain）

### Task 0.1：Maven Spring Boot 專案 + health endpoint

**Files:**
- Create: `backend/pom.xml`
- Create: `backend/src/main/java/com/baseball/record/BaseballRecordApplication.java`
- Create: `backend/src/main/java/com/baseball/record/common/HealthController.java`
- Test: `backend/src/test/java/com/baseball/record/common/HealthControllerIT.java`（本 task 先用 @WebMvctest 等價的輕量啟動）

- [ ] **Step 1: 建立 pom.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.6</version><!-- 用最新 3.5.x patch；建置時以 start.spring.io / Maven Central 確認 -->
    <relativePath/>
  </parent>
  <groupId>com.baseball</groupId>
  <artifactId>baseball-record-backend</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <properties>
    <java.version>21</java.version>
    <jjwt.version>0.12.6</jjwt.version>
  </properties>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-actuator</artifactId></dependency>
    <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>
    <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>
    <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-database-postgresql</artifactId></dependency>
    <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-api</artifactId><version>${jjwt.version}</version></dependency>
    <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-impl</artifactId><version>${jjwt.version}</version><scope>runtime</scope></dependency>
    <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-jackson</artifactId><version>${jjwt.version}</version><scope>runtime</scope></dependency>
    <!-- test -->
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
    <dependency><groupId>org.springframework.security</groupId><artifactId>spring-security-test</artifactId><scope>test</scope></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-testcontainers</artifactId><scope>test</scope></dependency>
    <dependency><groupId>org.testcontainers</groupId><artifactId>junit-jupiter</artifactId><scope>test</scope></dependency>
    <dependency><groupId>org.testcontainers</groupId><artifactId>postgresql</artifactId><scope>test</scope></dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 2: Application 進入點**

```java
package com.baseball.record;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BaseballRecordApplication {
    public static void main(String[] args) {
        SpringApplication.run(BaseballRecordApplication.class, args);
    }
}
```

- [ ] **Step 3: 寫 health 測試（先紅）** — `HealthControllerIT.java`

```java
package com.baseball.record.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HealthController.class)
class HealthControllerIT {
    @Autowired MockMvc mvc;

    @Test
    @WithMockUser
    void health_returns_ok() throws Exception {
        mvc.perform(get("/api/health"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.status").value("UP"));
    }
}
```

- [ ] **Step 4: 跑測試確認失敗**

Run: `cd backend && ./mvnw -q -Dtest=HealthControllerIT test`
Expected: FAIL（HealthController 不存在 / 404）

- [ ] **Step 5: 實作 HealthController**

```java
package com.baseball.record.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {
    @GetMapping
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
```

- [ ] **Step 6: 跑測試確認通過**

Run: `cd backend && ./mvnw -q -Dtest=HealthControllerIT test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/pom.xml backend/src/main/java backend/src/test/java/com/baseball/record/common
git commit -m "feat(backend): scaffold Spring Boot app with /api/health"
```

> 註：`./mvnw` 由 `mvn -N wrapper:wrapper` 產生；若尚無 wrapper，本 task Step 1 後先執行 `cd backend && mvn -N wrapper:wrapper` 產生 wrapper 再繼續。

---

### Task 0.2：本機 Postgres（podman compose）+ 資料庫設定 + Flyway 基線

**Files:**
- Create: `backend/compose.yaml`
- Create: `backend/src/main/resources/application.yaml`
- Create: `backend/src/main/resources/db/migration/V1__users.sql`
- Create: `docs/dev-podman.md`

- [ ] **Step 1: compose.yaml（podman compose 用）**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: baseball
      POSTGRES_USER: baseball
      POSTGRES_PASSWORD: baseball
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 2: application.yaml**

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/baseball
    username: baseball
    password: baseball
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true
app:
  jwt:
    secret: ${JWT_SECRET:dev-secret-change-me-please-32bytes-minimum-1234567890}
    ttl-minutes: 720
```

- [ ] **Step 3: V1__users.sql（Flyway 第一版，建 users 表）**

```sql
CREATE TABLE users (
    user_id        UUID PRIMARY KEY,
    display_name   VARCHAR(120) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,
    account_status VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: docs/dev-podman.md（Testcontainers 走 Podman 的設定）**

```markdown
# 本機開發（Podman，無 Docker）

## 啟動 Postgres
    cd backend && podman compose up -d db

## Testcontainers 透過 Podman socket
1. 啟動 podman machine 並確認 socket：
   podman machine start
2. 設定環境變數（Windows PowerShell 範例，請依實際 socket 路徑調整）：
   $env:DOCKER_HOST = "npipe:////./pipe/podman-machine-default"
   $env:TESTCONTAINERS_RYUK_DISABLED = "true"
   （或在 ~/.testcontainers.properties 設 docker.host 與 ryuk.disabled=true）
3. 驗證：cd backend && ./mvnw -q -Dtest=HealthControllerIT test 之後再跑整合測試。
```

- [ ] **Step 5: 啟動 DB 並手動 smoke（非測試）**

Run: `cd backend && podman compose up -d db && ./mvnw -q spring-boot:run`
Expected: 應用啟動成功、Flyway 套用 V1、`curl http://localhost:8080/api/health` 回 `{"status":"UP"}`。停止：Ctrl+C。

- [ ] **Step 6: Commit**

```bash
git add backend/compose.yaml backend/src/main/resources docs/dev-podman.md
git commit -m "feat(backend): postgres compose, datasource config, flyway V1 users"
```

---

### Task 0.3：Testcontainers 整合測試基底

**Files:**
- Create: `backend/src/test/java/com/baseball/record/support/IntegrationTest.java`
- Create: `backend/src/main/resources/application-test.yaml`

- [ ] **Step 1: application-test.yaml（用 Testcontainers JDBC URL，自動起 Postgres）**

```yaml
spring:
  datasource:
    url: jdbc:tc:postgresql:16:///baseball
    driver-class-name: org.testcontainers.jdbc.ContainerDatabaseDriver
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true
app:
  jwt:
    secret: test-secret-test-secret-test-secret-32bytes-min
    ttl-minutes: 60
```

- [ ] **Step 2: IntegrationTest 基底**

```java
package com.baseball.record.support;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTest {
}
```

- [ ] **Step 3: 寫一個會啟動完整 context 的整合測試（先紅，因為 health 在 Task 0.1 是 @WebMvcTest）**

改寫 `HealthControllerIT` 之外另建 `backend/src/test/java/com/baseball/record/support/ContextLoadsIT.java`：

```java
package com.baseball.record.support;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ContextLoadsIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    @Test
    void context_loads_and_db_migrates() throws Exception {
        // 能啟動 = Flyway 對 Testcontainers Postgres 套用成功；health 不需登入見 Task 1.5
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }
}
```

- [ ] **Step 4: 跑整合測試（需先依 docs/dev-podman.md 設好 Podman socket）**

Run: `cd backend && ./mvnw -q -Dtest=ContextLoadsIT test`
Expected: 第一次會拉 postgres image；PASS 代表 **Testcontainers 透過 Podman 成功** + Flyway 遷移成功（toolchain 全綠）。

> ⚠️ 若這裡失敗，多半是 Podman socket / ryuk 設定問題 → 回 docs/dev-podman.md 調整，**不要往下做功能**。

- [ ] **Step 5: Commit**

```bash
git add backend/src/test/java/com/baseball/record/support backend/src/main/resources/application-test.yaml
git commit -m "test(backend): Testcontainers integration base over Podman"
```

---

### Task 0.4：前端 React+Vite 骨架，呼叫 /api/health

**Files:**
- Create: `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: 以 Vite 初始化（react-ts 範本）**

Run:
```bash
cd frontend && npm create vite@latest . -- --template react-ts && npm install
```
（若目錄已有 CLAUDE.md，Vite 詢問是否清空時選「保留並繼續」，不要刪 CLAUDE.md。）

- [ ] **Step 2: vite.config.ts 加 /api proxy 到後端**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8080' } },
})
```

- [ ] **Step 3: App.tsx 呼叫 /api/health 顯示狀態**

```tsx
import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('...')
  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => setStatus(d.status)).catch(() => setStatus('DOWN'))
  }, [])
  return <main><h1>棒壘球紀錄平台</h1><p>API: {status}</p></main>
}
```

- [ ] **Step 4: 手動 smoke（後端需跑著）**

Run: `cd frontend && npm run dev` → 開 `http://localhost:5173`，畫面顯示 `API: UP`。

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat(frontend): Vite React skeleton calling /api/health"
```

---

## Phase 1：登入（AC-1）

### Task 1.1：UserAccount entity + repository（整合測試）

**Files:**
- Create: `backend/.../auth/UserAccount.java`, `auth/UserAccountRepository.java`
- Test: `backend/.../auth/UserAccountRepositoryIT.java`

- [ ] **Step 1: 寫 repository 測試（先紅）**

```java
package com.baseball.record.auth;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class UserAccountRepositoryIT extends IntegrationTest {
    @Autowired UserAccountRepository repo;

    @Test
    void save_and_find_by_email() {
        UserAccount u = new UserAccount("Amy", "amy@example.com", "hash");
        repo.save(u);
        assertThat(repo.findByEmail("amy@example.com")).isPresent();
        assertThat(repo.existsByEmail("amy@example.com")).isTrue();
    }
}
```

- [ ] **Step 2: 跑測試確認失敗** — `./mvnw -q -Dtest=UserAccountRepositoryIT test` → FAIL（型別不存在）

- [ ] **Step 3: 實作 entity**

```java
package com.baseball.record.auth;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserAccount {
    @Id @Column(name = "user_id") private UUID userId = UUID.randomUUID();
    @Column(name = "display_name", nullable = false) private String displayName;
    @Column(nullable = false, unique = true) private String email;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Column(name = "account_status", nullable = false) private String accountStatus = "active";
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();

    protected UserAccount() {}
    public UserAccount(String displayName, String email, String passwordHash) {
        this.displayName = displayName; this.email = email; this.passwordHash = passwordHash;
    }
    public UUID getUserId() { return userId; }
    public String getDisplayName() { return displayName; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
}
```

- [ ] **Step 4: 實作 repository**

```java
package com.baseball.record.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {
    Optional<UserAccount> findByEmail(String email);
    boolean existsByEmail(String email);
}
```

- [ ] **Step 5: 跑測試確認通過** — `./mvnw -q -Dtest=UserAccountRepositoryIT test` → PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/baseball/record/auth backend/src/test/java/com/baseball/record/auth
git commit -m "feat(auth): UserAccount entity and repository"
```

---

### Task 1.2：JwtService（純單元測試）

**Files:**
- Create: `backend/.../security/JwtService.java`
- Test: `backend/.../security/JwtServiceTest.java`

- [ ] **Step 1: 寫單元測試（先紅）**

```java
package com.baseball.record.security;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {
    private final JwtService jwt =
        new JwtService("unit-secret-unit-secret-unit-secret-32min", 60);

    @Test
    void issue_then_parse_returns_subject() {
        UUID uid = UUID.randomUUID();
        String token = jwt.issue(uid);
        assertThat(jwt.parseUserId(token)).isEqualTo(uid);
    }

    @Test
    void tampered_token_is_rejected() {
        String token = jwt.issue(UUID.randomUUID());
        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class,
            () -> jwt.parseUserId(token + "x"));
    }
}
```

- [ ] **Step 2: 跑測試確認失敗** — `./mvnw -q -Dtest=JwtServiceTest test` → FAIL

- [ ] **Step 3: 實作 JwtService**

```java
package com.baseball.record.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {
    private final SecretKey key;
    private final long ttlMinutes;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.ttl-minutes}") long ttlMinutes) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttlMinutes = ttlMinutes;
    }

    public String issue(UUID userId) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(userId.toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(ttlMinutes * 60)))
            .signWith(key)
            .compact();
    }

    public UUID parseUserId(String token) {
        String sub = Jwts.parser().verifyWith(key).build()
            .parseSignedClaims(token).getPayload().getSubject();
        return UUID.fromString(sub);
    }
}
```

- [ ] **Step 4: 跑測試確認通過** — `./mvnw -q -Dtest=JwtServiceTest test` → PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/baseball/record/security/JwtService.java backend/src/test/java/com/baseball/record/security/JwtServiceTest.java
git commit -m "feat(security): JwtService issue/parse with jjwt"
```

---

### Task 1.3：SecurityConfig + PasswordEncoder + JwtAuthFilter

**Files:**
- Create: `backend/.../security/JwtAuthFilter.java`, `security/SecurityConfig.java`

- [ ] **Step 1: JwtAuthFilter**

```java
package com.baseball.record.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    public JwtAuthFilter(JwtService jwtService) { this.jwtService = jwtService; }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest req, @NonNull HttpServletResponse res,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                UUID userId = jwtService.parseUserId(header.substring(7));
                var auth = new UsernamePasswordAuthenticationToken(userId, null, List.of());
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (RuntimeException ignored) { /* 無效 token → 視為未認證 */ }
        }
        chain.doFilter(req, res);
    }
}
```

- [ ] **Step 2: SecurityConfig**

```java
package com.baseball.record.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtService jwtService) throws Exception {
        http
          .csrf(AbstractHttpConfigurer::disable)
          .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
          .authorizeHttpRequests(a -> a
              .requestMatchers("/api/health", "/api/auth/register", "/api/auth/login").permitAll()
              .anyRequest().authenticated())
          .addFilterBefore(new JwtAuthFilter(jwtService), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
```

- [ ] **Step 3: 編譯通過（本 task 無新測試，由 Task 1.5 驗證行為）**

Run: `cd backend && ./mvnw -q -DskipTests compile`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/baseball/record/security
git commit -m "feat(security): stateless JWT security config and auth filter"
```

---

### Task 1.4：register + login（整合測試，AC-1 主體）

**Files:**
- Create: `auth/dto/RegisterRequest.java`, `LoginRequest.java`, `AuthResponse.java`, `MeResponse.java`
- Create: `auth/AuthService.java`, `auth/AuthController.java`
- Test: `auth/AuthControllerIT.java`

- [ ] **Step 1: 寫整合測試（先紅）**

```java
package com.baseball.record.auth;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AuthControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String register(String email) throws Exception {
        return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Amy\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
    }

    @Test
    void register_returns_201_and_token() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Amy\",\"email\":\"a@x.com\",\"password\":\"pw123456\"}"))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void duplicate_email_returns_409() throws Exception {
        register("dup@x.com");
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"B\",\"email\":\"dup@x.com\",\"password\":\"pw123456\"}"))
           .andExpect(status().isConflict());
    }

    @Test
    void login_valid_returns_token_invalid_returns_401() throws Exception {
        register("login@x.com");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"login@x.com\",\"password\":\"pw123456\"}"))
           .andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"login@x.com\",\"password\":\"wrong\"}"))
           .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: 跑測試確認失敗** — `./mvnw -q -Dtest=AuthControllerIT test` → FAIL

- [ ] **Step 3: DTOs**

```java
package com.baseball.record.auth.dto;
import jakarta.validation.constraints.*;
public record RegisterRequest(@NotBlank String displayName, @Email @NotBlank String email,
                              @Size(min = 6) String password) {}
```
```java
package com.baseball.record.auth.dto;
import jakarta.validation.constraints.*;
public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
```
```java
package com.baseball.record.auth.dto;
public record AuthResponse(String token) {}
```
```java
package com.baseball.record.auth.dto;
import java.util.UUID;
public record MeResponse(UUID userId, String displayName, String email) {}
```

- [ ] **Step 4: AuthService**

```java
package com.baseball.record.auth;

import com.baseball.record.auth.dto.*;
import com.baseball.record.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
public class AuthService {
    private final UserAccountRepository repo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(UserAccountRepository repo, PasswordEncoder encoder, JwtService jwt) {
        this.repo = repo; this.encoder = encoder; this.jwt = jwt;
    }

    public AuthResponse register(RegisterRequest req) {
        if (repo.existsByEmail(req.email()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "email already registered");
        UserAccount u = new UserAccount(req.displayName(), req.email(), encoder.encode(req.password()));
        repo.save(u);
        return new AuthResponse(jwt.issue(u.getUserId()));
    }

    public AuthResponse login(LoginRequest req) {
        UserAccount u = repo.findByEmail(req.email())
            .filter(x -> encoder.matches(req.password(), x.getPasswordHash()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials"));
        return new AuthResponse(jwt.issue(u.getUserId()));
    }

    public MeResponse me(UUID userId) {
        UserAccount u = repo.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unknown user"));
        return new MeResponse(u.getUserId(), u.getDisplayName(), u.getEmail());
    }
}
```

- [ ] **Step 5: AuthController（register/login；me 在 Task 1.5 接上安全驗證）**

```java
package com.baseball.record.auth;

import com.baseball.record.auth.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService service;
    public AuthController(AuthService service) { this.service = service; }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest req) { return service.register(req); }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) { return service.login(req); }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal UUID userId) { return service.me(userId); }
}
```

- [ ] **Step 6: 跑測試確認通過** — `./mvnw -q -Dtest=AuthControllerIT test` → PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/baseball/record/auth backend/src/test/java/com/baseball/record/auth/AuthControllerIT.java
git commit -m "feat(auth): register and login endpoints with JWT (AC-1)"
```

---

### Task 1.5：/api/auth/me 受保護（整合測試，補完 AC-1）

**Files:**
- Modify: `auth/AuthControllerIT.java`（加 me 測試）

- [ ] **Step 1: 加測試（先紅或部分綠）**

於 `AuthControllerIT` 新增：

```java
@Test
void me_requires_token_and_returns_user() throws Exception {
    String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("{\"displayName\":\"Amy\",\"email\":\"me@x.com\",\"password\":\"pw123456\"}"))
        .andReturn().getResponse().getContentAsString();
    String token = com.jayway.jsonpath.JsonPath.read(body, "$.token");

    mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
       .andExpect(status().isOk())
       .andExpect(jsonPath("$.email").value("me@x.com"));
}
```

- [ ] **Step 2: 跑測試** — `./mvnw -q -Dtest=AuthControllerIT test`
Expected: PASS（SecurityConfig 已在 Task 1.3 將 `/api/auth/me` 設為 authenticated；filter 設定 principal=UUID）。
若 401→200 行為不符，檢查 SecurityConfig 的 permitAll 清單與 filter principal 型別（必須是 `UUID` 以對應 `@AuthenticationPrincipal UUID`）。

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/com/baseball/record/auth/AuthControllerIT.java
git commit -m "test(auth): protected /me returns current user (AC-1)"
```

---

### Task 1.6：前端登入頁 + token 保存

**Files:**
- Create: `frontend/src/api/client.ts`, `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: api client（fetch + token）**

```ts
const TOKEN_KEY = 'br_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)

async function req(path: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as any) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { ...opts, headers })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.status === 204 ? null : res.json()
}
export const api = {
  register: (d: object) => req('/api/auth/register', { method: 'POST', body: JSON.stringify(d) }),
  login: (d: object) => req('/api/auth/login', { method: 'POST', body: JSON.stringify(d) }),
  me: () => req('/api/auth/me'),
}
```

- [ ] **Step 2: LoginPage（註冊/登入 → 存 token → 顯示 me）**

```tsx
import { useState } from 'react'
import { api, setToken } from '../api/client'

export default function LoginPage({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [displayName, setName] = useState(''); const [err, setErr] = useState('')

  async function submit(kind: 'login' | 'register') {
    setErr('')
    try {
      const d = kind === 'register' ? { displayName, email, password } : { email, password }
      const r = await api[kind](d); setToken(r.token); onAuthed()
    } catch { setErr('帳號或密碼錯誤 / 已被註冊') }
  }
  return (
    <main>
      <h1>登入</h1>
      <input placeholder="顯示名稱(註冊用)" value={displayName} onChange={e => setName(e.target.value)} />
      <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input placeholder="密碼" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={() => submit('login')}>登入</button>
      <button onClick={() => submit('register')}>註冊</button>
      {err && <p role="alert">{err}</p>}
    </main>
  )
}
```

- [ ] **Step 3: App.tsx 串接（登入後顯示 me）**

```tsx
import { useEffect, useState } from 'react'
import { api, getToken } from './api/client'
import LoginPage from './pages/LoginPage'

export default function App() {
  const [me, setMe] = useState<any>(null)
  const load = () => api.me().then(setMe).catch(() => setMe(null))
  useEffect(() => { if (getToken()) load() }, [])
  if (!me) return <LoginPage onAuthed={load} />
  return <main><h1>嗨，{me.displayName}</h1><p>{me.email}</p></main>
}
```

- [ ] **Step 4: 手動 smoke** — 後端跑著，`npm run dev`，註冊→看到「嗨，名字」。

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): login/register page with token persistence"
```

---

### Task 1.7：Playwright E2E（AC-1 端到端）

**Files:**
- Create: `frontend/e2e/auth.spec.ts`, `frontend/playwright.config.ts`
- Modify: `frontend/package.json`（加 @playwright/test）

- [x] **Step 1: 安裝 Playwright** — `cd frontend && npm i -D @playwright/test && npx playwright install chromium`

- [x] **Step 2: playwright.config.ts**

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5174' },
  webServer: { command: 'npm run dev -- --port 5174', url: 'http://localhost:5174', reuseExistingServer: true },
})
```

> **注意**：port 改為 5174（5173 被同機另一專案佔用）。

- [x] **Step 3: e2e/auth.spec.ts（先紅）**

```ts
import { test, expect } from '@playwright/test'

test('register then see greeting (AC-1)', async ({ page }) => {
  const email = `e2e_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('E2E User')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()
  await expect(page.getByText('嗨，E2E User')).toBeVisible()
})
```

- [x] **Step 4: 跑 E2E（後端 + DB 需在跑）**

Run: `cd backend && podman-compose up -d db` 然後起後端，再 `cd frontend && npx playwright test`
Result: **1 passed (25.0s)** — 完整端到端：前端→後端→真 Postgres ✅

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e frontend/playwright.config.ts frontend/package.json frontend/package-lock.json
git commit -m "test(frontend): Playwright E2E for register/login (AC-1)"
```

---

## Self-Review（spec 覆蓋檢查）

- **AC-1（帳號：註冊/登入/JWT/未登入不得存取受保護 API）**：Task 1.4（register/login + 重複 409 + 錯誤 401）、Task 1.5（/me 未帶 token→401、帶 token→200）、Task 1.7（E2E）→ ✅ 覆蓋。
- **Toolchain 風險（Podman/Testcontainers/Flyway/Maven/React）**：Task 0.1~0.4 全綠即驗證 → ✅。
- **型別一致性**：`@AuthenticationPrincipal UUID` ↔ JwtAuthFilter 設定 principal=UUID ↔ JwtService.parseUserId 回 UUID → 一致。`AuthResponse.token` ↔ 前端 `r.token` ↔ E2E → 一致。
- **無 placeholder**：所有步驟含實際程式/指令/預期輸出。
- **不在本份範圍（留 M1-B）**：球隊、RBAC 授權、球員 CRUD（AC-2/3）。

## 備註（給執行者）

- 本機未啟 Podman socket 時，整合測試會失敗 → 先讀 `docs/dev-podman.md`。
- 依使用者規則：**不主動 push**；commit 訊息上面已給，但是否 commit 由使用者節奏決定（可在每個里程碑結束統一 review）。
