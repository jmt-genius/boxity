use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock;

declare_id!("YourProgramIdHere"); // Replace with your program ID

#[program]
pub mod supply_chain_trust {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        program_state.owner = ctx.accounts.owner.key();
        program_state.total_batches = 0;
        program_state.next_event_id = 1;
        program_state.bump = ctx.bumps.program_state;
        Ok(())
    }

    pub fn create_batch(
        ctx: Context<CreateBatch>,
        batch_id: String,
        product_name: String,
        sku: String,
        origin: String,
        first_view_baseline: String,
        second_view_baseline: String,
    ) -> Result<()> {
        require!(!product_name.is_empty(), SupplyChainError::EmptyProductName);
        require!(!origin.is_empty(), SupplyChainError::EmptyOrigin);

        let batch = &mut ctx.accounts.batch;
        batch.batch_id = batch_id.clone();
        batch.product_name = product_name;
        batch.sku = sku;
        batch.origin = origin;
        batch.first_view_baseline = first_view_baseline;
        batch.second_view_baseline = second_view_baseline;
        batch.creator = ctx.accounts.creator.key();
        batch.created_at = clock::Clock::get()?.unix_timestamp;
        batch.exists = true;
        batch.bump = ctx.bumps.batch;

        let program_state = &mut ctx.accounts.program_state;
        program_state.total_batches = program_state.total_batches.checked_add(1).unwrap();

        emit!(BatchCreated {
            batch_id,
            creator: ctx.accounts.creator.key(),
            timestamp: batch.created_at,
        });

        Ok(())
    }

    pub fn log_event(
        ctx: Context<LogEvent>,
        actor: String,
        role: String,
        note: String,
        first_view_image: String,
        second_view_image: String,
        event_hash: String,
    ) -> Result<()> {
        require!(!actor.is_empty(), SupplyChainError::EmptyActor);
        require!(!role.is_empty(), SupplyChainError::EmptyRole);
        require!(!note.is_empty(), SupplyChainError::EmptyNote);
        require!(!event_hash.is_empty(), SupplyChainError::EmptyEventHash);

        let batch = &ctx.accounts.batch;
        require!(batch.exists, SupplyChainError::BatchNotFound);

        let program_state = &mut ctx.accounts.program_state;
        let event_id = program_state.next_event_id;
        program_state.next_event_id = program_state.next_event_id.checked_add(1).unwrap();

        let event = &mut ctx.accounts.event;
        event.id = event_id;
        event.actor = actor.clone();
        event.role = role.clone();
        event.note = note.clone();
        event.first_view_image = first_view_image;
        event.second_view_image = second_view_image;
        event.event_hash = event_hash;
        event.logged_by = ctx.accounts.logger.key();
        event.timestamp = clock::Clock::get()?.unix_timestamp;
        event.batch = batch.key();
        event.bump = ctx.bumps.event;

        emit!(EventLogged {
            batch_id: batch.batch_id.clone(),
            event_id,
            actor,
            role,
            logged_by: ctx.accounts.logger.key(),
            timestamp: event.timestamp,
        });

        Ok(())
    }

    pub fn set_user_authorization(
        ctx: Context<SetUserAuthorization>,
        user: Pubkey,
        authorized: bool,
    ) -> Result<()> {
        let program_state = &ctx.accounts.program_state;
        require!(
            ctx.accounts.owner.key() == program_state.owner,
            SupplyChainError::Unauthorized
        );

        let user_auth = &mut ctx.accounts.user_authorization;
        user_auth.user = user;
        user_auth.authorized = authorized;
        user_auth.bump = ctx.bumps.user_authorization;

        emit!(UserAuthorized { user, authorized });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + ProgramState::LEN,
        seeds = [b"program_state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(batch_id: String)]
pub struct CreateBatch<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Batch::LEN,
        seeds = [b"batch", batch_id.as_bytes()],
        bump
    )]
    pub batch: Account<'info, Batch>,
    #[account(
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LogEvent<'info> {
    #[account(
        seeds = [b"batch", batch.batch_id.as_bytes()],
        bump = batch.bump
    )]
    pub batch: Account<'info, Batch>,
    #[account(
        init,
        payer = logger,
        space = 8 + BatchEvent::LEN,
        seeds = [b"event", batch.key().as_ref(), program_state.next_event_id.to_le_bytes().as_ref()],
        bump
    )]
    pub event: Account<'info, BatchEvent>,
    #[account(
        mut,
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub logger: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetUserAuthorization<'info> {
    #[account(
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(
        init,
        payer = owner,
        space = 8 + UserAuthorization::LEN,
        seeds = [b"user_auth", user_authorization.user.as_ref()],
        bump
    )]
    pub user_authorization: Account<'info, UserAuthorization>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: User to authorize
    pub user: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct ProgramState {
    pub owner: Pubkey,
    pub total_batches: u64,
    pub next_event_id: u64,
    pub bump: u8,
}

impl ProgramState {
    pub const LEN: usize = 32 + 8 + 8 + 1; // owner + total_batches + next_event_id + bump
}

#[account]
pub struct Batch {
    pub batch_id: String,
    pub product_name: String,
    pub sku: String,
    pub origin: String,
    pub first_view_baseline: String,
    pub second_view_baseline: String,
    pub creator: Pubkey,
    pub created_at: i64,
    pub exists: bool,
    pub bump: u8,
}

impl Batch {
    pub const LEN: usize = 4 + 100 + 4 + 100 + 4 + 100 + 4 + 200 + 4 + 200 + 32 + 8 + 1 + 1;
    // batch_id(100) + product_name(100) + sku(100) + origin(100) + first_view_baseline(200) + second_view_baseline(200) + creator + created_at + exists + bump
}

#[account]
pub struct BatchEvent {
    pub id: u64,
    pub actor: String,
    pub role: String,
    pub note: String,
    pub first_view_image: String,
    pub second_view_image: String,
    pub event_hash: String,
    pub logged_by: Pubkey,
    pub timestamp: i64,
    pub batch: Pubkey,
    pub bump: u8,
}

impl BatchEvent {
    pub const LEN: usize = 8 + 4 + 100 + 4 + 100 + 4 + 200 + 4 + 200 + 4 + 200 + 4 + 64 + 32 + 8 + 32 + 1;
    // id + actor(100) + role(100) + note(200) + first_view_image(200) + second_view_image(200) + event_hash(64) + logged_by + timestamp + batch + bump
}

#[account]
pub struct UserAuthorization {
    pub user: Pubkey,
    pub authorized: bool,
    pub bump: u8,
}

impl UserAuthorization {
    pub const LEN: usize = 32 + 1 + 1; // user + authorized + bump
}

#[event]
pub struct BatchCreated {
    pub batch_id: String,
    pub creator: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct EventLogged {
    pub batch_id: String,
    pub event_id: u64,
    pub actor: String,
    pub role: String,
    pub logged_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct UserAuthorized {
    pub user: Pubkey,
    pub authorized: bool,
}

#[error_code]
pub enum SupplyChainError {
    #[msg("Product name cannot be empty")]
    EmptyProductName,
    #[msg("Origin cannot be empty")]
    EmptyOrigin,
    #[msg("Actor cannot be empty")]
    EmptyActor,
    #[msg("Role cannot be empty")]
    EmptyRole,
    #[msg("Note cannot be empty")]
    EmptyNote,
    #[msg("Event hash cannot be empty")]
    EmptyEventHash,
    #[msg("Batch does not exist")]
    BatchNotFound,
    #[msg("Unauthorized")]
    Unauthorized,
}

