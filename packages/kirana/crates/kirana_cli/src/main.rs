//! The standalone `kirana-style` binary, for environments without Node.js (KRN-INT-007).

use std::env;
use std::io::{self, IsTerminal};

fn main() {
    let args: Vec<String> = env::args().collect();
    let colour = kirana_diagnostics::colour(
        io::stdout().is_terminal(),
        env::var("FORCE_COLOR").ok().as_deref(),
        env::var("NO_COLOR").ok().as_deref(),
    );
    std::process::exit(kirana_cli::run_coloured(&args, &mut io::stdout(), colour));
}
