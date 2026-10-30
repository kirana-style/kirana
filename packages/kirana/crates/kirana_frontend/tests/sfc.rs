use std::path::Path;

use kirana_frontend::sfc::{Block, Framework, framework_of, scan};

/// The text of each binding's expression.
fn expressions(framework: Framework, source: &str) -> Vec<String> {
    scan(framework, source).bindings.iter().map(|binding| binding.expression.clone()).collect()
}

fn attributes(framework: Framework, source: &str) -> Vec<String> {
    scan(framework, source).bindings.iter().map(|binding| source[binding.start..binding.end].to_owned()).collect()
}

fn blocks(framework: Framework, source: &str) -> Vec<(&'static str, String, String)> {
    scan(framework, source)
        .blocks
        .iter()
        .map(|block| (block.label, block.lang.clone(), source[block.start..block.end].to_owned()))
        .collect()
}

#[test]
fn frameworks_by_extension() {
    assert_eq!(framework_of(Path::new("a/Card.vue")), Some(Framework::Vue));
    assert_eq!(framework_of(Path::new("Card.svelte")), Some(Framework::Svelte));
    assert_eq!(framework_of(Path::new("index.astro")), Some(Framework::Astro));
    assert_eq!(framework_of(Path::new("card.tsx")), None);
    assert_eq!(framework_of(Path::new("Makefile")), None);
}

#[test]
fn block_ids_match_the_build() {
    let block = Block { label: "setup", start: 0, end: 0, lang: "ts".to_owned() };
    assert_eq!(block.id(Path::new("/app/src/Card.vue")), Path::new("/app/src/Card.vue.setup.ts"));
}

#[test]
fn vue_blocks_and_bindings() {
    let source = "<script setup lang=\"ts\">\nconst card = css({})\n</script>\n<template>\n  <div class=\"own\" :sx=\"[card, on && card]\"><p v-if=\"on\" v-bind:sx='card[\"x\"]' title=\"t\">t</p><i sx=\"static\" /></div>\n</template>\n";
    assert_eq!(blocks(Framework::Vue, source), vec![("setup", "ts".to_owned(), "\nconst card = css({})\n".to_owned())]);
    assert_eq!(expressions(Framework::Vue, source), vec!["[card, on && card]", "card[\"x\"]"]);
    assert_eq!(attributes(Framework::Vue, source), vec![":sx=\"[card, on && card]\"", "v-bind:sx='card[\"x\"]'"]);
    let component = scan(Framework::Vue, source);
    assert_eq!(component.target, Some(0));
    assert_eq!(component.block_at(30).map(|block| block.label), Some("setup"));
    assert_eq!(component.block_at(source.len()), None);
}

#[test]
fn vue_script_and_setup_in_build_order() {
    let source = "<template><p :sx=\"x\"></p></template>\n<script setup>\nlet x\n</script>\n<script lang=\"ts\">\nexport default {}\n</script>\n";
    let found = blocks(Framework::Vue, source);
    assert_eq!(
        found.iter().map(|(label, lang, _)| (*label, lang.as_str())).collect::<Vec<_>>(),
        vec![("script", "ts"), ("setup", "js")]
    );
    assert_eq!(scan(Framework::Vue, source).target, Some(1));
    // Without `<script setup>` the template has no block to see.
    assert_eq!(scan(Framework::Vue, "<script>\nexport default {}\n</script>").target, None);
}

#[test]
fn vue_ignores_what_vue_does_not_bind() {
    // Outside the template, under `v-pre`, a plain `sx` attribute, and a script that is not top-level.
    let source = "<custom :sx=\"no\"></custom><template><div v-pre><p :sx=\"pre\"></p></div><p :sx=\"yes\"><script>let a</script></p><!-- <p :sx=\"comment\"> --></template>";
    assert_eq!(expressions(Framework::Vue, source), vec!["yes"]);
    assert!(scan(Framework::Vue, source).blocks.is_empty());
    // Mustache braces are text in Vue.
    assert_eq!(expressions(Framework::Vue, "<template><p :sx=\"a\">{{ b }}</p></template>"), vec!["a"]);
}

#[test]
fn svelte_blocks_and_bindings() {
    let source = "<script module>\nexport const shared = 1\n</script>\n<script lang=\"ts\">\nconst card = css({})\n</script>\n\n<div class=\"own {on ? 'x' : ''}\" style=\"opacity: 1\" sx={[card]}>{#if on}<p sx=\"{card}\" hidden>t</p><i sx=\"text\" /><b class sx={card} /><u {sx} />{/if}</div>\n<style>p { color: red }</style>\n";
    assert_eq!(
        blocks(Framework::Svelte, source).iter().map(|(label, lang, _)| (*label, lang.clone())).collect::<Vec<_>>(),
        vec![("module", "js".to_owned()), ("instance", "ts".to_owned())]
    );
    assert_eq!(expressions(Framework::Svelte, source), vec!["[card]", "card", "card", "sx"]);
    assert_eq!(attributes(Framework::Svelte, source)[3], "{sx}");
    assert_eq!(scan(Framework::Svelte, source).target, Some(1));
    // Svelte 4's `context="module"`.
    assert_eq!(blocks(Framework::Svelte, "<script context=\"module\">let a</script>")[0].0, "module");
}

#[test]
fn svelte_skips_what_is_not_one_expression() {
    // Text around the expression, an empty expression, a spread and another shorthand.
    let source = "<p sx=\"a {b}\" /><p sx={} /><p {...rest} /><p {other} /><p sx={/* none */} />";
    assert!(expressions(Framework::Svelte, source).is_empty());
}

#[test]
fn expressions_skip_strings_comments_and_template_literals() {
    let source = "<p sx={[a, \"}\", '}', `}${ {x: 1}.x }`, /* } */ b // }\n]} />";
    assert_eq!(expressions(Framework::Svelte, source), vec!["[a, \"}\", '}', `}${ {x: 1}.x }`, /* } */ b // }\n]"]);
    assert_eq!(expressions(Framework::Svelte, "<p sx={`a\\`b`} />"), vec!["`a\\`b`"]);
    assert_eq!(expressions(Framework::Svelte, "<p sx={\"a\\\"b\"} />"), vec!["\"a\\\"b\""]);
}

#[test]
fn astro_frontmatter_and_markup_inside_expressions() {
    let source = "---\nconst card = css({})\n---\n<ul sx={card}>{items.map((item) => <li sx={[card, item.on && card]}>{item.name}</li>)}<>{x}</></ul>\n<script>let s = '<p sx={no} />'</script>\n";
    assert_eq!(
        blocks(Framework::Astro, source),
        vec![("frontmatter", "ts".to_owned(), "\nconst card = css({})\n".to_owned())]
    );
    assert_eq!(expressions(Framework::Astro, source), vec!["card", "[card, item.on && card]"]);
    assert_eq!(scan(Framework::Astro, source).target, Some(0));
    // No frontmatter, or one that never closes.
    assert_eq!(scan(Framework::Astro, "<p sx={a} />").target, None);
    assert!(scan(Framework::Astro, "---\nconst a = 1\n").blocks.is_empty());
    assert_eq!(scan(Framework::Astro, "\n  ---\n---\n").blocks[0].start, 6);
}

#[test]
fn implied_end_tags_and_unterminated_input() {
    // A slash inside a tag that does not close it.
    assert_eq!(expressions(Framework::Svelte, "<p / sx={a}></p>"), vec!["a"]);
    // A slash inside an attribute's name, a fragment inside an Astro expression, and an
    // expression that is only a line comment.
    assert_eq!(expressions(Framework::Svelte, "<p a/b sx={x} />"), vec!["x"]);
    assert_eq!(expressions(Framework::Astro, "{on && <>t<p sx={a} /></>}"), vec!["a"]);
    assert!(expressions(Framework::Svelte, "<p sx={// none\n} />").is_empty());
    assert!(expressions(Framework::Svelte, "<p sx={// one\n/* two */} />").is_empty());
    // `<li>` without `</li>`: the list's close tag still ends the list.
    let source = "<ul><li>a<li>b</ul><p sx={after} />";
    assert_eq!(expressions(Framework::Svelte, source), vec!["after"]);
    // Void elements, stray close tags, a lone `<`, a bare `=` and unterminated tags, strings and
    // comments end without a panic.
    for source in [
        "<br><img src=x></nope><p sx={a}>",
        "a < b <p = sx={c} />",
        "<p sx={unterminated",
        "<p sx=\"open",
        "<p title=`open",
        "<!-- open",
        "<p sx={`open ${x",
        "<p sx={'open",
        "<p sx={/* open",
        "<p sx={// open",
        "<script>never closed",
        "<p",
        "</p",
        "<p sx={a} title=b",
    ] {
        let _ = scan(Framework::Svelte, source);
        let _ = scan(Framework::Astro, source);
        let _ = scan(Framework::Vue, source);
    }
}

#[test]
fn vue_decodes_character_references() {
    let source = "<template><p :sx=\"x + &quot;y&quot; + &#39;z&#x27; + &bogus; + &amp\"></p></template>";
    let component = scan(Framework::Vue, source);
    let binding = &component.bindings[0];
    assert_eq!(binding.expression, "x + \"y\" + 'z' + &bogus; + &amp");
    let named = scan(Framework::Vue, "<template><p :sx=\"a &lt; b &gt; c &apos;&nbsp;\"></p></template>");
    assert_eq!(named.bindings[0].expression, "a < b > c '\u{a0}");
    // Each offset in the decoded text maps back to the same character in the component.
    let y = binding.expression.find('y').unwrap();
    assert_eq!(&source[binding.source_offset(y)..binding.source_offset(y) + 1], "y");
    assert_eq!(binding.source_offset(0), binding.expression_start);
    let bogus = binding.expression.find("&bogus").unwrap();
    assert_eq!(&source[binding.source_offset(bogus)..binding.source_offset(bogus) + 6], "&bogus");
    // Other frameworks keep the text as written.
    assert_eq!(scan(Framework::Svelte, "<p sx={a &amp; b} />").bindings[0].expression, "a &amp; b");
}

#[test]
fn angular_templates_inline_and_named() {
    use kirana_frontend::sfc::{angular_bindings, angular_template, angular_template_url};
    let component = "import { Component } from \"@angular/core\"\nconst styles = {}\n@Component({\n  selector: \"app-card\",\n  templateUrl: './card.component.html',\n})\nexport class Card {}\n";
    assert_eq!(angular_template_url(component), Some("./card.component.html"));
    assert_eq!(angular_template(component), None, "`templateUrl` is not `template`");
    let inline = "@Component({ selector: 'x', template: `\n  @if (on) { <p [sx]=\"[styles.card, on &amp;&amp; styles.on]\">{{ text }}</p> }\n  <i bind-sx='styles.icon'></i><b [sx]=\"\"></b><script>x</script>\n`, styles: [] })\nclass C {}";
    let (start, end) = angular_template(inline).unwrap();
    assert!(inline[start..end].starts_with("\n  @if"));
    let bindings = angular_bindings(&inline[start..end], start);
    let expressions: Vec<&str> = bindings.iter().map(|binding| binding.expression.as_str()).collect();
    // Braces are text in Angular templates; character references are decoded, as Angular does.
    assert_eq!(expressions, ["[styles.card, on && styles.on]", "styles.icon", ""]);
    assert_eq!(&inline[bindings[1].start..bindings[1].end], "bind-sx='styles.icon'");
    // A decoded offset maps back into the file, after the references it passed.
    let after = bindings[0].expression.find("styles.on").unwrap();
    assert_eq!(&inline[bindings[0].source_offset(after)..][..9], "styles.on");
    // Quoted strings, an escaped quote inside them, and files without a decorator.
    let quoted = "@Component({ template: \"<p [sx]=\\\"a\\\"></p>\" })";
    let (start, end) = angular_template(quoted).unwrap();
    assert_eq!(&quoted[start..end], "<p [sx]=\\\"a\\\"></p>");
    assert_eq!(angular_template("@Component({ template: x })"), None);
    assert_eq!(angular_template("export const a = 1"), None);
    assert_eq!(angular_template_url("export const a = 1"), None);
    assert_eq!(angular_template_url("@Component({ selector: 'app-card' })"), None);
    assert_eq!(angular_template_url("@Component({ templateUrl: x })"), None);
    assert_eq!(angular_template_url("@Component({ templateUrl })"), None);
    assert_eq!(angular_template_url("@Component({ templateUrl: 'open"), None);
    assert!(scan(Framework::Angular, "<script>x</script>").blocks.is_empty());
}
