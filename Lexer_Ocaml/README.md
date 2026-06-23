### Assignment 2b: Lexical Analysis for LITHP

#### Files Included

* **[assignment2b_lex.mll](assignment2b_lex.mll)**: The OCaml-lex specification defining the regular expressions and actions for LITHP tokens.
* **[assignment2b_yacc.mly](assignment2b_yacc.mly)**: The OCaml-yacc specification defining the token types, terminal symbols, and the grammar interface(to be defined later on).
* **[assignment2a.ml](assignment2a.ml)**: The integrated BigInt package used for numeral tokenization.

#### Generated Files

* **assignment2b_lex.ml**: The OCaml scanner generated from the lexer specification.
* **assignment2b_yacc.ml / .mli**: The parser implementation and interface containing token definitions.
* **.cmi / .cmo**: Compiled OCaml interfaces and object files for both lexer and parser.

#### Approach and Methodology

##### Token Specification and Type Integration

* **BigInt Integration**: Numerals are not stored as standard integers. Instead, the `BIG_INT` token is defined as `<Assignment2a.bigint>`, ensuring that every number processed by the scanner leverages the arbitrary-precision logic defined in Assignment 2a.
* **Shorthand Pattern Matching**: To handle Lisp-style list access, a specific regular expression—`'c' ['a' 'd']+ 'r'`—is used to capture compound operations (e.g., `caadr`, `cdar`) as a single `CADR` token.
* **Dotted Identifiers**: The language allows helper functions to end with a dot (e.g., `list.`, `append.`). The identifier regex—`alpha (alpha | digit)* '.'?`—ensures these are treated as single atomic tokens rather than being split by the period.

* **Keyword and Identifier**: To prevent keywords like `quote` or `defun` from being misidentified as generic names, they are listed early in the `rule token` block. OCaml-lex matches patterns in the order they appear, giving keywords priority over the general `identifier` rule.
* **Symbolic Mapping**: Literal characters like `(`, `)`, and `'` are mapped to `LPAREN`, `RPAREN`, and `QUOTE_SYM` respectively. The specific constant `t` is mapped to a `TRUE` token, while `()` is identified as `NIL`.

* **Comment Hierarchy**: The lexer implements a greedy matching strategy for comments using a semicolon prefix.
* Patterns for `;`, `;;`, `;;;`, and `;;;;` all use the regex `[^ '\n']*` to consume everything until the newline.
* These actions call `token lexbuf` recursively, effectively discarding the comments from the token stream.


* **Whitespace Management**: Space, tabs, and newlines are consumed as separators to ensure that tokens like `defun` and an identifier `x` are recognized as distinct entities.

#### Compilation and Usage

```bash
# Compile the dependency first
ocamlc -c assignment2a.ml

# Generate and compile the parser/token interface
ocamlyacc assignment2b_yacc.mly
ocamlc -c assignment2b_yacc.mli
ocamlc -c assignment2b_yacc.ml

# Generate and compile the lexer
ocamllex assignment2b_lex.mll
ocamlc -c assignment2b_lex.ml

```