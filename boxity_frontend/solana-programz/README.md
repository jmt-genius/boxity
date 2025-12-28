# Supply Chain Trust - Solana Program

This is the Solana/Anchor implementation of the Supply Chain Trust smart contract.

## Project Structure

```
solana-program/
├── programs/
│   └── supply-chain-trust/
│       └── src/
│           └── lib.rs          # Main program logic
├── tests/
│   └── supply-chain-trust.ts   # Integration tests
├── Anchor.toml                 # Anchor configuration
├── Cargo.toml                  # Rust dependencies
└── Xargo.toml                  # Build configuration
```

## Quick Start

1. **Install dependencies**:
   ```bash
   anchor build
   ```

2. **Run tests**:
   ```bash
   anchor test
   ```

3. **Deploy to devnet**:
   ```bash
   anchor deploy
   ```

## Program Accounts

### ProgramState
- Stores global program state (owner, total batches, next event ID)
- PDA: `["program_state"]`

### Batch
- Stores batch information
- PDA: `["batch", batch_id]`

### BatchEvent
- Stores individual events for batches
- PDA: `["event", batch_pubkey, event_id]`

### UserAuthorization
- Stores user authorization status
- PDA: `["user_auth", user_pubkey]`

## Instructions

### initialize
Initializes the program (call once).

### create_batch
Creates a new product batch.

### log_event
Logs a new event for a batch.

### set_user_authorization
Sets authorization status for a user (owner only).

## Events

- `BatchCreated`: Emitted when a batch is created
- `EventLogged`: Emitted when an event is logged
- `UserAuthorized`: Emitted when user authorization changes

