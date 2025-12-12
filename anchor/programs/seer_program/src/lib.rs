use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("R8Q5AaY9CnWqnhobPQ9LtTGewdpnJ3NoGNGxyKicqfg");

// Market creation fee: 0.01 SOL
pub const MARKET_CREATION_FEE: u64 = 10_000_000; // 0.01 SOL in lamports

// Minimum rent-exempt balance for vault PDA
pub const VAULT_RENT_RESERVE: u64 = 890880; // ~0.00089 SOL

#[program]
pub mod seer_program {
    use super::*;

    /// Initialize program configuration (call once after deployment)
    pub fn initialize_config(ctx: Context<InitializeConfig>, treasury: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = treasury;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Update treasury address (only authority can call)
    pub fn update_treasury(ctx: Context<UpdateConfig>, new_treasury: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.treasury = new_treasury;
        
        msg!("Treasury updated to: {}", new_treasury);
        Ok(())
    }

    /// Initialize a new prediction market (charges 0.01 SOL fee)
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        _market_id: [u8; 32], // Hash of the question, used for PDA
        question: String,
        end_time: i64,
    ) -> Result<()> {
        require!(question.len() <= 200, SeerError::QuestionTooLong);
        require!(end_time > Clock::get()?.unix_timestamp, SeerError::InvalidEndTime);

        // Charge market creation fee to treasury from config
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, MARKET_CREATION_FEE)?;

        // Initialize vault with rent-exempt amount
        let vault_init_cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.market_vault.to_account_info(),
            },
        );
        system_program::transfer(vault_init_cpi, VAULT_RENT_RESERVE)?;

        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.question = question;
        market.yes_amount = 0;
        market.no_amount = 0;
        market.resolved = false;
        market.outcome = false;
        market.end_time = end_time;
        market.bump = ctx.bumps.market;
        market.total_bettors = 0;
        market.total_claimed = 0; // Track total claimed amount

        msg!("Market created: {}", market.key());
        msg!("Creator: {}", market.creator);
        msg!("End time: {}", market.end_time);
        msg!("Creation fee: {} lamports", MARKET_CREATION_FEE);

        Ok(())
    }

    /// Place a bet on a market (YES or NO)
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        amount: u64,
        bet_yes: bool,
    ) -> Result<()> {
        require!(amount > 0, SeerError::InvalidBetAmount);
        
        let market = &ctx.accounts.market;
        require!(!market.resolved, SeerError::MarketResolved);
        require!(Clock::get()?.unix_timestamp < market.end_time, SeerError::MarketEnded);

        // Transfer SOL from bettor to market vault
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.bettor.to_account_info(),
                to: ctx.accounts.market_vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;

        // Update market totals
        let market = &mut ctx.accounts.market;
        if bet_yes {
            market.yes_amount = market.yes_amount.checked_add(amount).unwrap();
        } else {
            market.no_amount = market.no_amount.checked_add(amount).unwrap();
        }

        // Update or create user position
        let position = &mut ctx.accounts.user_position;
        if position.bettor == Pubkey::default() {
            position.bettor = ctx.accounts.bettor.key();
            position.market = market.key();
            market.total_bettors = market.total_bettors.checked_add(1).unwrap();
        }
        
        if bet_yes {
            position.yes_amount = position.yes_amount.checked_add(amount).unwrap();
        } else {
            position.no_amount = position.no_amount.checked_add(amount).unwrap();
        }
        position.bump = ctx.bumps.user_position;

        emit!(BetPlaced {
            market: market.key(),
            bettor: ctx.accounts.bettor.key(),
            amount,
            bet_yes,
            total_yes: market.yes_amount,
            total_no: market.no_amount,
        });

        Ok(())
    }

    /// Resolve the market (only creator can resolve)
    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        outcome: bool, // true = YES wins, false = NO wins
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(!market.resolved, SeerError::MarketAlreadyResolved);
        require!(
            Clock::get()?.unix_timestamp >= market.end_time,
            SeerError::MarketNotEnded
        );

        let market = &mut ctx.accounts.market;
        market.resolved = true;
        market.outcome = outcome;

        emit!(MarketResolved {
            market: market.key(),
            outcome,
            total_pool: market.yes_amount.checked_add(market.no_amount).unwrap(),
        });

        Ok(())
    }

    /// Claim winnings after market is resolved
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let position = &mut ctx.accounts.user_position;

        require!(market.resolved, SeerError::MarketNotResolved);
        require!(!position.claimed, SeerError::AlreadyClaimed);

        // Determine user's winning bet amount
        let user_winning_bet = if market.outcome {
            position.yes_amount
        } else {
            position.no_amount
        };

        require!(user_winning_bet > 0, SeerError::NoWinningPosition);

        // Get winning and total pools
        let winning_pool = if market.outcome {
            market.yes_amount
        } else {
            market.no_amount
        };

        let total_pool = market.yes_amount.checked_add(market.no_amount).unwrap();
        
        require!(winning_pool > 0, SeerError::InvalidWinningPool);

        // Calculate proportional winnings: (user_winning_bet / winning_pool) * total_pool
        // Using u128 to prevent overflow
        let winnings = (user_winning_bet as u128)
            .checked_mul(total_pool as u128)
            .unwrap()
            .checked_div(winning_pool as u128)
            .unwrap() as u64;

        // Get available vault balance (subtract rent reserve)
        let vault_balance = ctx.accounts.market_vault.lamports();
        require!(
            vault_balance > VAULT_RENT_RESERVE,
            SeerError::InsufficientVaultBalance
        );
        
        let available_balance = vault_balance.checked_sub(VAULT_RENT_RESERVE).unwrap();
        
        // Verify sufficient funds before transfer
        require!(
            available_balance >= winnings,
            SeerError::InsufficientVaultBalance
        );

        // Transfer winnings from vault to user using PDA signer
        let market_key = market.key();
        let seeds = &[
            b"vault",
            market_key.as_ref(),
            &[ctx.bumps.market_vault],
        ];
        let signer = &[&seeds[..]];

        let transfer_cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.market_vault.to_account_info(),
                to: ctx.accounts.bettor.to_account_info(),
            },
            signer,
        );
        system_program::transfer(transfer_cpi, winnings)?;

        // Mark as claimed and update total claimed
        position.claimed = true;
        position.claimed_amount = winnings;
        market.total_claimed = market.total_claimed.checked_add(winnings).unwrap();

        emit!(WinningsClaimed {
            market: market.key(),
            bettor: ctx.accounts.bettor.key(),
            amount: winnings,
        });

        Ok(())
    }

    /// Emergency function to return rent reserve to creator after all claims
    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        let market = &ctx.accounts.market;
        
        require!(market.resolved, SeerError::MarketNotResolved);
        
        // Ensure enough time has passed (e.g., 30 days after resolution)
        let current_time = Clock::get()?.unix_timestamp;
        let min_close_time = market.end_time.checked_add(30 * 24 * 60 * 60).unwrap();
        require!(current_time >= min_close_time, SeerError::TooEarlyToClose);

        // Transfer remaining vault balance to creator
        let vault_balance = ctx.accounts.market_vault.lamports();
        
        if vault_balance > 0 {
            let market_key = market.key();
            let seeds = &[
                b"vault",
                market_key.as_ref(),
                &[ctx.bumps.market_vault],
            ];
            let signer = &[&seeds[..]];

            **ctx.accounts.market_vault.try_borrow_mut_lamports()? = 0;
            **ctx.accounts.creator.try_borrow_mut_lamports()? = ctx
                .accounts
                .creator
                .lamports()
                .checked_add(vault_balance)
                .unwrap();
        }

        Ok(())
    }
}

// ============================================================================
// ACCOUNTS
// ============================================================================

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = ProgramConfig::SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        constraint = authority.key() == config.authority @ SeerError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ProgramConfig>,
}

#[derive(Accounts)]
#[instruction(market_id: [u8; 32], question: String)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        init,
        payer = creator,
        space = Market::SPACE,
        seeds = [b"market", creator.key().as_ref(), &market_id],
        bump
    )]
    pub market: Account<'info, Market>,

    /// CHECK: This is a PDA that will hold the funds
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: AccountInfo<'info>,

    /// CHECK: Treasury from config
    #[account(
        mut,
        address = config.treasury @ SeerError::InvalidTreasury
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    /// CHECK: This is a PDA vault that holds the funds
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = bettor,
        space = UserPosition::SPACE,
        seeds = [b"position", market.key().as_ref(), bettor.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(
        constraint = creator.key() == market.creator @ SeerError::Unauthorized
    )]
    pub creator: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        constraint = market.resolved @ SeerError::MarketNotResolved
    )]
    pub market: Account<'info, Market>,

    /// CHECK: This is a PDA vault that holds the funds
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), bettor.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.bettor == bettor.key() @ SeerError::Unauthorized
    )]
    pub user_position: Account<'info, UserPosition>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    #[account(
        mut,
        constraint = creator.key() == market.creator @ SeerError::Unauthorized
    )]
    pub creator: Signer<'info>,

    #[account(
        constraint = market.resolved @ SeerError::MarketNotResolved
    )]
    pub market: Account<'info, Market>,

    /// CHECK: This is a PDA vault
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// STATE
// ============================================================================

#[account]
pub struct ProgramConfig {
    pub authority: Pubkey,      // 32 bytes - Program authority (can update config)
    pub treasury: Pubkey,       // 32 bytes - Treasury address for fees
    pub bump: u8,               // 1 byte - PDA bump
}

impl ProgramConfig {
    pub const SPACE: usize = 8  // discriminator
        + 32                    // authority
        + 32                    // treasury
        + 1;                    // bump
}

#[account]
pub struct Market {
    pub creator: Pubkey,        // 32 bytes - Market creator
    pub question: String,       // 4 + 200 bytes - The prediction question
    pub yes_amount: u64,        // 8 bytes - Total SOL bet on YES
    pub no_amount: u64,         // 8 bytes - Total SOL bet on NO
    pub resolved: bool,         // 1 byte - Whether market is resolved
    pub outcome: bool,          // 1 byte - true = YES won, false = NO won
    pub end_time: i64,          // 8 bytes - Unix timestamp when betting ends
    pub bump: u8,               // 1 byte - PDA bump
    pub total_bettors: u32,     // 4 bytes - Number of unique bettors
    pub total_claimed: u64,     // 8 bytes - Total amount claimed by winners
}

impl Market {
    pub const SPACE: usize = 8  // discriminator
        + 32                    // creator
        + 4 + 200               // question (string prefix + max chars)
        + 8                     // yes_amount
        + 8                     // no_amount
        + 1                     // resolved
        + 1                     // outcome
        + 8                     // end_time
        + 1                     // bump
        + 4                     // total_bettors
        + 8;                    // total_claimed
}

#[account]
pub struct UserPosition {
    pub bettor: Pubkey,         // 32 bytes - User's wallet
    pub market: Pubkey,         // 32 bytes - Market pubkey
    pub yes_amount: u64,        // 8 bytes - Amount bet on YES
    pub no_amount: u64,         // 8 bytes - Amount bet on NO
    pub claimed: bool,          // 1 byte - Whether winnings claimed
    pub bump: u8,               // 1 byte - PDA bump
    pub claimed_amount: u64,    // 8 bytes - Amount claimed
}

impl UserPosition {
    pub const SPACE: usize = 8  // discriminator
        + 32                    // bettor
        + 32                    // market
        + 8                     // yes_amount
        + 8                     // no_amount
        + 1                     // claimed
        + 1                     // bump
        + 8;                    // claimed_amount
}

// ============================================================================
// EVENTS
// ============================================================================

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub question: String,
    pub end_time: i64,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub amount: u64,
    pub bet_yes: bool,
    pub total_yes: u64,
    pub total_no: u64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub outcome: bool,
    pub total_pool: u64,
}

#[event]
pub struct WinningsClaimed {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub amount: u64,
}

// ============================================================================
// ERRORS
// ============================================================================

#[error_code]
pub enum SeerError {
    #[msg("Question exceeds maximum length of 200 characters")]
    QuestionTooLong,

    #[msg("End time must be in the future")]
    InvalidEndTime,

    #[msg("Bet amount must be greater than 0")]
    InvalidBetAmount,

    #[msg("Market has already been resolved")]
    MarketResolved,

    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,

    #[msg("Betting period has ended")]
    MarketEnded,

    #[msg("Market has not ended yet")]
    MarketNotEnded,

    #[msg("Market has not been resolved yet")]
    MarketNotResolved,

    #[msg("Winnings have already been claimed")]
    AlreadyClaimed,

    #[msg("You do not have a winning position")]
    NoWinningPosition,

    #[msg("Unauthorized action")]
    Unauthorized,

    #[msg("Invalid treasury address")]
    InvalidTreasury,

    #[msg("Insufficient balance in vault")]
    InsufficientVaultBalance,

    #[msg("Invalid winning pool amount")]
    InvalidWinningPool,

    #[msg("Too early to close market")]
    TooEarlyToClose,
}