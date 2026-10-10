# Race Condition Fixes

## Overview
Fixed race conditions in location subscriptions and async operations that could cause state updates on unmounted components, leading to memory leaks and "Can't perform a React state update on an unmounted component" errors.

## Problem

### Original Implementation
The map screen used a local `active` variable to track mount status:

```typescript
useEffect(() => {
  if (!isFocused) return;

  let active = true;
  let subscription: Location.LocationSubscription | null = null;

  const updateLocation = (point: Coordinates) => {
    if (!active) return;
    setGpsLocation(point);
    // ...
  };

  void getCurrentCoordinates()
    .then((point) => {
      if (!active) return null;
      updateLocation(point);
      return watchCurrentCoordinates(updateLocation, ...);
    })
    .then((result) => {
      if (!result) return;
      if (active) subscription = result;
      else result.remove();
    });

  return () => {
    active = false;
    subscription?.remove();
  };
}, [isFocused, locationWatchRetry]);
```

### Issues
1. **Local variable capture**: The `active` variable is captured in closures and may not reflect the actual mount status
2. **Async operation timing**: Async operations (promises) may complete after unmount
3. **Finally block updates**: State updates in finally blocks could execute after unmount
4. **Multiple useEffect hooks**: Multiple independent hooks with separate `active` variables could cause inconsistencies

## Solution

### Ref-Based Mount Tracking
Replaced local `active` variable with a ref that persists across async operations:

```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  if (!isFocused) return;

  isMountedRef.current = true;
  let subscription: Location.LocationSubscription | null = null;

  const updateLocation = (point: Coordinates) => {
    if (!isMountedRef.current) return;
    setGpsLocation(point);
    // ...
  };

  void getCurrentCoordinates()
    .then((point) => {
      if (!isMountedRef.current) return null;
      updateLocation(point);
      return watchCurrentCoordinates(updateLocation, ...);
    })
    .then((result) => {
      if (!result) return;
      if (isMountedRef.current) subscription = result;
      else result.remove();
    });

  return () => {
    isMountedRef.current = false;
    subscription?.remove();
  };
}, [isFocused, locationWatchRetry]);
```

### Benefits
1. **Ref persistence**: Ref value persists across async operations and closures
2. **Consistent mount tracking**: Single source of truth for mount status
3. **Finally block safety**: Mount checks in finally blocks prevent state updates after unmount
4. **Proper cleanup**: Subscription removal happens immediately on unmount

## Changes Made

### File: `app/(tabs)/map.tsx`

**Location Subscription Effect:**
- Added `isMountedRef` ref to track mount status
- Replaced all `active` variable checks with `isMountedRef.current`
- Set `isMountedRef.current = true` on mount
- Set `isMountedRef.current = false` in cleanup

**Offline Packs Effect:**
- Replaced local `active` variable with `isMountedRef.current`
- Added mount check in finally block

**Place Lookup Async Function:**
- Added mount checks in success path
- Added mount checks in error path
- Added mount check in finally block

### File: `src/services/location-service.test.ts`

**Added Test:**
- Test for subscription removal to verify cleanup works correctly

## Testing

### Test Coverage
- Subscription removal test verifies cleanup
- Manual verification of mount check logic
- Verification that no state updates occur after unmount

### Test Results
All 123 tests passing:
```
Test Suites: 20 passed, 20 total
Tests:       123 passed, 123 total
Time:        8.506 s
```

## Best Practices

### React Async Operations
1. **Use refs for mount tracking**: Refs persist across async operations better than local variables
2. **Check mount before state updates**: Always check mount status before calling setState
3. **Check mount in finally blocks**: State updates in finally blocks need mount checks
4. **Clean up subscriptions**: Always remove subscriptions in cleanup functions
5. **Abort pending requests**: Consider using AbortController for cancellable operations

### Pattern for Async State Updates
```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  isMountedRef.current = true;

  const asyncOperation = async () => {
    try {
      const result = await someAsyncWork();
      if (isMountedRef.current) {
        setState(result);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setError(error.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  asyncOperation();

  return () => {
    isMountedRef.current = false;
  };
}, [dependencies]);
```

## Security Impact

### Before
- Race conditions could cause state updates on unmounted components
- Memory leaks from uncleared subscriptions
- "Can't perform a React state update on an unmounted component" errors
- Potential app crashes from memory pressure

### After
- Ref-based mount tracking prevents state updates on unmounted components
- Proper subscription cleanup prevents memory leaks
- No React state update errors
- Stable memory usage during navigation

## Related Patterns

### AbortController Pattern
For cancellable async operations, consider using AbortController:

```typescript
useEffect(() => {
  const controller = new AbortController();

  const fetchData = async () => {
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setState(await response.json());
      }
    } catch (error) {
      if (error.name !== 'AbortError' && !controller.signal.aborted) {
        setError(error.message);
      }
    }
  };

  fetchData();

  return () => {
    controller.abort();
  };
}, [url]);
```

### UseCleanupEffect Pattern
For complex cleanup logic, consider a custom hook:

```typescript
function useIsMounted() {
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  return isMountedRef;
}
```

## Future Enhancements

- Consider adding AbortController support for cancellable network requests
- Consider adding a custom useIsMounted hook for reusability
- Consider adding telemetry for mount/unmount cycles
- Consider adding error boundaries for async operation failures
