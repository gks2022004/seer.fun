use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("5XrAkDuDwvsqVxMkVETukYdAjuACH3poCAcP4hZJoKSQ");

// Market creation fee: 0.01 SOL
pub const MARKET_CREATION_FEE: u64 = 10_000_000; // 0.01 SOL in lamports

// Treasury address to receive fees (change this to your wallet)
pub const TREASURY: &str = "BfxvKDgh3nWpM5JX2NF7M7MJLirJkuWHMM3n5JohStx";

#[program]
pub mod seer_program {
    use super::*;

    /// Initialize a new prediction market (charges 0.01 SOL fee)
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        _market_id: [u8; 32], // Hash of the question, used for PDA
        question: String,
        end_time: i64,
    ) -> Result<()> {
        require!(question.len() <= 200, SeerError::QuestionTooLong);
        require!(end_time > Clock::get()?.unix_timestamp, SeerError::InvalidEndTime);

        // Charge market creation fee
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, MARKET_CREATION_FEE)?;

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
    /// Creator can use AI suggestion from Perplexity to determine outcome
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
        let market = &ctx.accounts.market;
        let position = &ctx.accounts.user_position;

        require!(market.resolved, SeerError::MarketNotResolved);
        require!(!position.claimed, SeerError::AlreadyClaimed);

        // Calculate winnings
        let user_bet = if market.outcome {
            position.yes_amount
        } else {
            position.no_amount
        };

        require!(user_bet > 0, SeerError::NoWinningPosition);

        let winning_pool = if market.outcome {
            market.yes_amount
        } else {
            market.no_amount
        };

        let total_pool = market.yes_amount.checked_add(market.no_amount).unwrap();
        
        // Calculate proportional winnings: (user_bet / winning_pool) * total_pool
        let winnings = (user_bet as u128)
            .checked_mul(total_pool as u128)
            .unwrap()
            .checked_div(winning_pool as u128)
            .unwrap() as u64;

        // Get vault balance and determine actual transfer amount
        let vault_balance = ctx.accounts.market_vault.lamports();
        
        // Transfer all available funds from vault (handles dust and rent issues)
        // If vault has less than calculated winnings due to rounding, transfer what's available
        let actual_transfer = std::cmp::min(winnings, vault_balance);
        
        // Transfer winnings from vault to user
        let market_key = market.key();
        let seeds = &[
            b"vault",
            market_key.as_ref(),
            &[ctx.bumps.market_vault],
        ];
        let signer = &[&seeds[..]];

        // Use direct lamport manipulation to avoid rent issues
        // This allows us to drain the PDA completely
        **ctx.accounts.market_vault.try_borrow_mut_lamports()? = ctx
            .accounts
            .market_vault
            .lamports()
            .checked_sub(actual_transfer)
            .unwrap();
        **ctx.accounts.bettor.try_borrow_mut_lamports()? = ctx
            .accounts
            .bettor
            .lamports()
            .checked_add(actual_transfer)
            .unwrap();

        // Mark as claimed
        let position = &mut ctx.accounts.user_position;
        position.claimed = true;

        emit!(WinningsClaimed {
            market: market.key(),
            bettor: ctx.accounts.bettor.key(),
            amount: actual_transfer,
        });

        Ok(())
    }
}

// ============================================================================
// ACCOUNTS
// ============================================================================

#[derive(Accounts)]
#[instruction(market_id: [u8; 32], question: String)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

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
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: AccountInfo<'info>,

    /// CHECK: Treasury account to receive market creation fees
    #[account(
        mut,
        address = TREASURY.parse::<Pubkey>().unwrap() @ SeerError::InvalidTreasury
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

// ============================================================================
// STATE
// ============================================================================

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
        + 4;                    // total_bettors
}

#[account]
pub struct UserPosition {
    pub bettor: Pubkey,         // 32 bytes - User's wallet
    pub market: Pubkey,         // 32 bytes - Market pubkey
    pub yes_amount: u64,        // 8 bytes - Amount bet on YES
    pub no_amount: u64,         // 8 bytes - Amount bet on NO
    pub claimed: bool,          // 1 byte - Whether winnings claimed
    pub bump: u8,               // 1 byte - PDA bump
}

impl UserPosition {
    pub const SPACE: usize = 8  // discriminator
        + 32                    // bettor
        + 32                    // market
        + 8                     // yes_amount
        + 8                     // no_amount
        + 1                     // claimed
        + 1;                    // bump
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
}
