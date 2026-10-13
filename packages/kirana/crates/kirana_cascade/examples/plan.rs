fn main() {
    for name in std::env::args().skip(1) {
        let plan = kirana_cascade::write_plan(&name).unwrap();
        let n = |p: &[kirana_ir::Property]| p.iter().map(|p| p.name.clone()).collect::<Vec<_>>().join(",");
        println!("{name}: longhands [{}] covered [{}]", n(&plan.longhands), n(&plan.covered));
        for (s, keep, narrow) in &plan.overlapping {
            println!("   overlap {} keep [{}] narrow={narrow}", s.name, n(keep));
        }
    }
}
