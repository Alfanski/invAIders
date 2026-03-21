# Test Patterns Reference

Patterns for Python (pytest) and TypeScript (jest/vitest). Read this when
writing tests to follow established patterns.

## Python (pytest)

### Basic Test Structure

```python
class TestTargetFunction:
    """Tests for target_function."""

    def test_returns_expected_for_valid_input(self):
        result = target_function(valid_input())
        assert result == expected

    def test_raises_value_error_for_empty_input(self):
        with pytest.raises(ValueError, match="must not be empty"):
            target_function("")

    def test_handles_none_gracefully(self):
        with pytest.raises(TypeError):
            target_function(None)
```

### Fixtures

```python
@pytest.fixture
def db_session():
    session = create_test_session()
    yield session
    session.rollback()

@pytest.fixture
def sample_user(db_session):
    user = UserFactory.create(session=db_session)
    return user
```

### Parametrize for Edge Cases

```python
@pytest.mark.parametrize("input_val,expected", [
    ("", ValueError),
    (None, TypeError),
    ("valid", "processed_valid"),
    ("  spaces  ", "processed_spaces"),
])
def test_process_handles_edge_cases(input_val, expected):
    if isinstance(expected, type) and issubclass(expected, Exception):
        with pytest.raises(expected):
            process(input_val)
    else:
        assert process(input_val) == expected
```

### Mocking External Services

```python
@patch("app.services.external_api.fetch")
def test_service_handles_api_failure(mock_fetch):
    mock_fetch.side_effect = ConnectionError("timeout")
    result = my_service.get_data()
    assert result.status == "fallback"
    mock_fetch.assert_called_once()
```

## TypeScript (jest / vitest)

### Basic Test Structure

```typescript
describe("targetFunction", () => {
  it("returns expected value for valid input", () => {
    const result = targetFunction(validInput());
    expect(result).toEqual(expected);
  });

  it("throws for empty input", () => {
    expect(() => targetFunction("")).toThrow("must not be empty");
  });

  it("handles undefined gracefully", () => {
    expect(() => targetFunction(undefined)).toThrow(TypeError);
  });
});
```

### Async Tests

```typescript
describe("fetchUser", () => {
  it("returns user data", async () => {
    const user = await fetchUser("123");
    expect(user.id).toBe("123");
    expect(user.name).toBeDefined();
  });

  it("throws on network error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
    await expect(fetchUser("123")).rejects.toThrow("offline");
  });
});
```

### Mocking

```typescript
vi.mock("../services/api", () => ({
  fetchData: vi.fn().mockResolvedValue({ items: [] }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});
```

## Naming Conventions

| Style | Pattern | Example |
|-------|---------|---------|
| Behavior | `test_[action]_[scenario]_[expected]` | `test_create_user_with_duplicate_email_raises_conflict` |
| Given-When-Then | `test_given_[state]_when_[action]_then_[result]` | `test_given_empty_cart_when_checkout_then_raises_error` |
| Jest style | `it("[verbs] when [condition]")` | `it("returns 404 when user not found")` |
