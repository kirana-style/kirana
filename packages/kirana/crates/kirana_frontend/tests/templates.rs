//! D-069: the style names server templates pass to Kirana's helper.

use std::path::Path;

use kirana_frontend::templates::{StyleName, is_template, style_names};

fn names(text: &str) -> Vec<String> {
    style_names(text).into_iter().map(|name| name.name).collect()
}

#[test]
fn finds_names_in_every_template_language() {
    assert_eq!(names(r#"<p class="@kirana('probe', $active ? 'card.active' : null)">"#), ["probe", "card.active"]);
    assert_eq!(names(r#"<p class="{{ kirana('card', active ? "card.on") }}">"#), ["card", "card.on"]);
    assert_eq!(names("<p class=\"<%= kirana :probe, active && \"card.active\" %>\">"), ["probe", "card.active"]);
    assert_eq!(names("<%= kirana(:probe, :quiet) %>"), ["probe", "quiet"]);
    assert_eq!(names(r#"<p class={kirana(["probe", @active && "quiet"])}>"#), ["probe", "quiet"]);
    // A bare call ends with its line.
    assert_eq!(names("<%= kirana :a\n:b %>"), ["a"]);
}

#[test]
fn records_where_each_literal_is() {
    let text = "{{ kirana('card') }}";
    assert_eq!(style_names(text), [StyleName { start: 10, end: 16, name: "card".to_owned() }]);
    assert_eq!(&text[10..16], "'card'");
}

#[test]
fn ignores_other_words_and_unclosed_text() {
    assert_eq!(names("mykirana('x') kirana.x('y') kiranas('z') kirana  "), Vec::<String>::new());
    assert_eq!(names("kirana = 1; kirana x"), Vec::<String>::new());
    assert_eq!(names(r"kirana('a\'b', 'open"), [r"a\'b", "open"]);
    assert_eq!(names("kirana((a), 'b')"), ["b"]);
    assert_eq!(names("kirana :a ? 1 : x"), ["a"]);
}

#[test]
fn knows_template_files() {
    for file in ["home.blade.php", "index.html.erb", "home.html.heex", "base.html.twig", "home.edge"] {
        assert!(is_template(Path::new(file)), "{file}");
    }
    assert!(!is_template(Path::new("app.ts")));
}
