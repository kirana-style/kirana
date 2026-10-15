//! The standalone `kirana-style` binary, for environments without Node.js (KRN-INT-007).

fn main() {
    let args: Vec<String> = std::env::args().collect();
    std::process::exit(kirana_cli::run(&args, &mut std::io::stdout()));
}
