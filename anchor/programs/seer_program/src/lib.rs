use anchor_lang::prelude::*;
use anchor_lang::system_program;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

declare_id!("5d9gPjzVJsPaVhw1LvSj8RBr2MXSca12mTQoh63CmN74");

#[program]
pub mod seer_program {
    use super::*;

    /// Initialize a new prediction market
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        _market_id: [u8; 32], // Hash of the question, used for PDA
        question: String,
        end_time: i64,
        market_type: MarketType,
        pyth_feed_id: Option<String>, // Hex string of Pyth feed ID
        target_price: Option<i64>, // Target price in USD cents (e.g., 150000 for $1500.00)
    ) -> Result<()> {
        require!(question.len() <= 200, SeerError::QuestionTooLong);
        require!(end_time > Clock::get()?.unix_timestamp, SeerError::InvalidEndTime);

        // Validate price market parameters
        if market_type == MarketType::Price {
            require!(pyth_feed_id.is_some(), SeerError::MissingPythFeed);
            require!(target_price.is_some(), SeerError::MissingTargetPrice);
        }

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
        market.market_type = market_type;
        
        // Set Pyth params if price market
        market.pyth_feed_id = pyth_feed_id.map(|hex| {
            get_feed_id_from_hex(&hex)
                .expect("Invalid Pyth feed ID")
        });
        market.target_price = target_price;

        msg!("Market created: {}", market.key());
        msg!("Creator: {}", market.creator);
        msg!("End time: {}", market.end_time);
        msg!("Market type: {:?}", market_type);

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
        require!(market.market_type == MarketType::Event, SeerError::CannotResolveAutomatically);

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

    /// Auto-resolve price market using Pyth oracle (anyone can call after end_time)
    pub fn resolve_price_market(
        ctx: Context<ResolvePriceMarket>,
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(!market.resolved, SeerError::MarketAlreadyResolved);
        require!(
            Clock::get()?.unix_timestamp >= market.end_time,
            SeerError::MarketNotEnded
        );
        require!(market.market_type == MarketType::Price, SeerError::NotPriceMarket);
        
        let feed_id = market.pyth_feed_id.ok_or(SeerError::MissingPythFeed)?;
        let target_price = market.target_price.ok_or(SeerError::MissingTargetPrice)?;

        // Get price from Pyth oracle
        let price_update = &mut ctx.accounts.price_update;
        let price = price_update.get_price_no_older_than(
            &Clock::get()?,
            60, // Max 60 seconds old
            &feed_id,
        )?;

        // Compare price with target (price.price is in cents/dollars depending on feed)
        let outcome = price.price >= target_price;

        let market = &mut ctx.accounts.market;
        market.resolved = true;
        market.outcome = outcome;

        emit!(MarketResolved {
            market: market.key(),
            outcome,
            total_pool: market.yes_amount.checked_add(market.no_amount).unwrap(),
        });

        msg!("Price market resolved: price={}, target={}, outcome={}", 
            price.price, target_price, outcome);

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

        // Transfer winnings from vault to user
        let market_key = market.key();
        let seeds = &[
            b"vault",
            market_key.as_ref(),
            &[ctx.bumps.market_vault],
        ];
        let signer = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.market_vault.to_account_info(),
                to: ctx.accounts.bettor.to_account_info(),
            },
            signer,
        );
        system_program::transfer(cpi_context, winnings)?;

        // Mark as claimed
        let position = &mut ctx.accounts.user_position;
        position.claimed = true;

        emit!(WinningsClaimed {
            market: market.key(),
            bettor: ctx.accounts.bettor.key(),
            amount: winnings,
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
pub struct ResolvePriceMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// Pyth price update account
    pub price_update: Account<'info, PriceUpdateV2>,
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum MarketType {
    Event,  // Manual resolution (current system)
    Price,  // Auto-resolve with Pyth oracle
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
    pub market_type: MarketType, // 1 byte - Event or Price market
    pub pyth_feed_id: Option<[u8; 32]>, // 1 + 32 bytes - Pyth price feed ID (if price market)
    pub target_price: Option<i64>, // 1 + 8 bytes - Target price in USD (if price market)
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
        + 1                     // market_type
        + 1 + 32                // pyth_feed_id (Option)
        + 1 + 8;                // target_price (Option)
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

    #[msg("Pyth feed ID is required for price markets")]
    MissingPythFeed,

    #[msg("Target price is required for price markets")]
    MissingTargetPrice,

    #[msg("This market type cannot be resolved automatically")]
    CannotResolveAutomatically,

    #[msg("This is not a price market")]
    NotPriceMarket,
}
