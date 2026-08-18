# Mocking Strategy Documentation

## Overview

This document outlines the mocking strategy for QuizMaster testing, following the principle that external boundaries should be mocked while domain/business logic should be tested directly.

---

## Mock External Boundaries

### 1. Supabase Client

**Status:** PARTIALLY MOCKED

**What to Mock:**
- ✅ Supabase client responses for unit tests
- ✅ Network errors and timeouts
- ✅ Malformed responses
- ✅ Authentication failures
- ✅ Database connectivity issues

**Current Implementation:**
- The question loader already has a 4-second timeout for Supabase requests
- Tests can mock the timeout behavior
- No explicit mocking library currently used

**Recommended Approach:**
```typescript
// Example: Mock Supabase for unit tests
vi.mock('../lib/supabaseClient', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        data: [],
        error: null,
      })),
    })),
  })),
}))
```

---

### 2. Network Requests

**Status:** NOT CURRENTLY MOCKED

**What to Mock:**
- ✅ Fetch requests to external APIs
- ✅ WebSocket connections (for online testing)
- ✅ Network latency and failures
- ✅ Timeout scenarios

**Current Implementation:**
- No explicit network mocking
- Real Supabase client used in tests
- Network tests rely on actual connectivity

**Recommended Approach:**
```typescript
// Example: Mock fetch for unit tests
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data: 'mock' }),
  })
)
```

---

### 3. Browser APIs

**Status:** PARTIALLY MOCKED

**What to Mock:**
- ✅ localStorage (already mocked in test setup)
- ✅ sessionStorage (if used)
- ✅ Geolocation API (if used)
- ✅ Notifications API (if used)

**Current Implementation:**
- `localStorage` is already mocked with `MemoryStorage` in `src/test/setup.ts`
- This provides in-memory polyfill for zustand persist middleware

**Existing Mock:**
```typescript
// src/test/setup.ts
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  // ... implementation
}
```

---

### 4. Date/Time

**Status:** NOT CURRENTLY MOCKED

**What to Mock:**
- ✅ Current time for timeout calculations
- ✅ Date-based operations
- ✅ Timer/interval behavior

**Current Implementation:**
- Tests use real system time
- May cause flaky tests if time-sensitive

**Recommended Approach:**
```typescript
// Example: Mock time for deterministic tests
vi.useFakeTimers()
vi.setSystemTime(new Date('2024-01-01'))
```

---

### 5. File System

**Status:** NOT CURRENTLY MOCKED

**What to Mock:**
- ✅ File reading for question JSON files
- ✅ File system operations
- ✅ Image loading

**Current Implementation:**
- Tests use real file system
- Question loader reads actual JSON files
- May cause issues if test data changes

**Recommended Approach:**
```typescript
// Example: Mock file system for isolated tests
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify(mockData)),
}))
```

---

## Do NOT Mock

### 1. Domain/Business Logic

**Status:** NOT MOCKED (CORRECT)

**What NOT to Mock:**
- ❌ Game board store logic
- ❌ Question selection logic
- ❌ Score calculation logic
- ❌ Turn management logic
- ❌ State machine transitions
- ❌ Validation contracts

**Rationale:**
- These are the core logic we want to test
- Mocking them would defeat the purpose of testing
- They should be tested directly and thoroughly

**Current Implementation:**
- ✅ Business logic tested directly via store tests
- ✅ Validation contracts tested via unit tests
- ✅ State machine tested via scenario tests

---

### 2. Data Structures

**Status:** NOT MOCKED (CORRECT)

**What NOT to Mock:**
- ❌ TypeScript types/interfaces
- ❌ Data models
- ❌ Utility functions
- ❌ Helper functions

**Rationale:**
- These are pure functions that should be tested directly
- Mocking them would not provide value
- They are deterministic and testable

**Current Implementation:**
- ✅ Utility functions tested directly
- ✅ Data transformations tested directly
- ✅ Helper functions tested directly

---

### 3. Store State

**Status:** NOT MOCKED (CORRECT)

**What NOT to Mock:**
- ❌ Zustand store state
- ❌ Store actions
- ❌ Store selectors

**Rationale:**
- Store state is the core of the application
- Mocking it would prevent testing actual behavior
- Store should be tested in isolation with real state

**Current Implementation:**
- ✅ Store tested directly via unit tests
- ✅ State transitions tested via scenario tests
- ✅ Store invariants tested via property tests

---

### 4. Validation Functions

**Status:** NOT MOCKED (CORRECT)

**What NOT to Mock:**
- ❌ `isPointValue()` function
- ❌ `isTeamId()` function
- ❌ `isLifelineId()` function
- ❌ Contract validation functions

**Rationale:**
- These are pure validation functions
- They should be tested directly for correctness
- Mocking them would not provide additional confidence

**Current Implementation:**
- ✅ Validation functions tested directly in `contracts.test.ts`
- ✅ Edge cases covered comprehensively
- ✅ Runtime behavior verified

---

## Current Mocking Assessment

### Well-Implemented Mocks

1. **localStorage Mock**
   - ✅ Location: `src/test/setup.ts`
   - ✅ Purpose: Enables zustand persist in Node environment
   - ✅ Quality: Complete implementation of Storage interface
   - ✅ Usage: Works correctly for all store tests

### Missing Mocks

1. **Supabase Client Mock**
   - ❌ Status: Not implemented
   - ❌ Impact: Tests depend on real Supabase connectivity
   - ❌ Priority: HIGH for isolated unit testing

2. **Network Mock**
   - ❌ Status: Not implemented
   - ❌ Impact: Cannot test offline scenarios reliably
   - ❌ Priority: MEDIUM for resilience testing

3. **Time Mock**
   - ❌ Status: Not implemented
   - ❌ Impact: Time-sensitive tests may be flaky
   - ❌ Priority: LOW for current test suite

4. **File System Mock**
   - ❌ Status: Not implemented
   - ❌ Impact: Tests depend on real test data files
   - ❌ Priority: LOW for current architecture

### Over-Mocking Risks

1. **Over-Mocking Store Actions**
   - ✅ Status: AVOIDED
   - ✅ Approach: Store actions tested directly
   - ✅ Rationale: Store actions are the business logic we want to test

2. **Over-Mocking Validation**
   - ✅ Status: AVOIDED
   - ✅ Approach: Validation functions tested directly
   - ✅ Rationale: Validation is critical for security

3. **Over-Mocking Data Transformations**
   - ✅ Status: AVOIDED
   - ✅ Approach: Transformations tested directly
   - ✅ Rationale: Transformations should be deterministic

---

## Mocking Guidelines

### When to Mock

**DO Mock When:**
- Testing integration with external services
- Simulating error conditions
- Isolating units from external dependencies
- Creating deterministic test scenarios
- Testing error handling logic

**DO NOT Mock When:**
- Testing core business logic
- Testing data transformations
- Testing validation logic
- Testing state management
- Testing algorithmic correctness

### Mock Quality Standards

**Good Mocks:**
- ✅ Realistic behavior
- ✅ Configurable responses
- ✅ Error simulation
- ✅ Easy to understand
- ✅ Well-documented

**Bad Mocks:**
- ❌ Over-simplified behavior
- ❌ Always success (no error cases)
- ❌ Hardcoded responses
- ❌ Complex setup
- ❌ Poorly documented

---

## Test Isolation Strategy

### Current Approach

**Store Reset:**
- Each test resets store to initial state
- Prevents state leakage between tests
- Implemented via `beforeEach` hooks

**File System:**
- Tests use real test data files
- No file system mocking
- Risk: Test data changes may affect tests

**Network:**
- Tests use real network where applicable
- No network mocking
- Risk: Network issues may cause flaky tests

### Recommended Improvements

**Store Reset:**
- ✅ Current approach is good
- ✅ Continue with beforeEach reset
- ✅ Consider adding store snapshot testing

**File System:**
- ❌ Consider adding virtual file system for isolated tests
- ❌ Priority: LOW for current needs
- ❌ Benefit: Complete test isolation

**Network:**
- ❌ Consider adding network mocking for offline tests
- ❌ Priority: MEDIUM for resilience testing
- ❌ Benefit: Reliable offline scenario testing

---

## External Service Integration Testing

### Supabase Integration

**Current Status:**
- Real Supabase client used in tests
- Tests depend on Supabase availability
- Limited ability to test error scenarios

**Recommendations:**
1. Add Supabase client mocking for unit tests
2. Create integration tests for real Supabase calls
3. Separate unit tests from integration tests
4. Use test environment for integration tests

### Online Multiplayer Integration

**Current Status:**
- Online event validation tested
- Real-time communication not mocked
- WebSocket connections not tested

**Recommendations:**
1. Add WebSocket mocking for online tests
2. Test connection/disconnection scenarios
3. Test message ordering and delivery
4. Test reconnection handling

---

## Mocking Tool Recommendations

### Vitest Built-in Mocking

**Current Framework:** Vitest

**Available Features:**
- ✅ `vi.fn()` for function mocking
- ✅ `vi.mock()` for module mocking
- ✅ `vi.useFakeTimers()` for time mocking
- ✅ `vi.spyOn()` for partial mocking

**Recommended Usage:**
```typescript
// Mock a function
const mockFn = vi.fn(() => 'mocked')

// Mock a module
vi.mock('../lib/supabaseClient')

// Use fake timers
vi.useFakeTimers()
vi.setSystemTime(new Date('2024-01-01'))
```

### Additional Libraries

**Consider Adding:**
- `msw` (Mock Service Worker) for API mocking
- `sinon` for complex mocking scenarios
- `nock` for HTTP request mocking

**Current Decision:**
- Vitest built-in mocking is sufficient for current needs
- Additional libraries can be added if complexity grows
- Keep mocking simple and maintainable

---

## Conclusion

**Current Mocking Strategy:**
- ✅ localStorage properly mocked
- ✅ Business logic NOT mocked (correct)
- ✅ Validation NOT mocked (correct)
- ✅ Store state NOT mocked (correct)
- ❌ Supabase client NOT mocked (gap)
- ❌ Network NOT mocked (gap)
- ❌ Time NOT mocked (gap)

**Priority Improvements:**
1. Add Supabase client mocking for unit tests (HIGH)
2. Add network mocking for offline scenarios (MEDIUM)
3. Consider time mocking for deterministic tests (LOW)
4. Keep current approach for business logic (MAINTAIN)

**Overall Assessment:**
The current mocking strategy is sound for testing core business logic. The main gaps are in external service mocking, which should be addressed for more comprehensive integration testing.

---

**Document Created:** 2026-08-18  
**Status:** Review Complete  
**Next Steps:** Implement Supabase client mocking for isolated unit tests
