### Assignment 2c: Using OCaml-Yacc to build a parser

#### Files Included

* **[assignment2b_lex.mll](assignment2b_lex.mll)**: The OCaml-lex specification defining the regular expressions and actions for LITHP tokens.
* **[assignment2b_yacc.mly](assignment2c_yacc.mly)**: The OCaml-yacc specification defining the token types, terminal symbols, and the grammar interface.
* **[assignment2a.ml](assignment2a.ml)**: The integrated BigInt package used for numeral tokenization.
* **[main.ml](main.ml)**: The main file consisting of some automated test cases and then command line input.
* **[Makefile](Makefile)**: Consists of all running instructions for the ocaml compile and run.
#### Generated Files

* **assignment2b_lex.ml**: The OCaml scanner generated from the lexer specification.
* **assignment2c_yacc.ml / .mli**: The parser implementation and interface containing token definitions.
* **.cmi / .cmo**: Compiled OCaml interfaces and object files for both lexer and parser.


#### Grammar specification 
#### 1. Lexical Conventions (Tokens)
The lexer breaks the input text into the following foundational tokens:
* **Whitespace & Comments:** Spaces, tabs, and newlines are taken as token and gives syntax error if not given between atoms in a list. Comments begin with one to four semicolons (`;`, `;;`, `;;;`, `;;;;`) and run until the end of the line. The lexer safely strips these before parsing.
* **Identifiers:** Alphanumeric strings starting with a letter. They may contain underscores and optionally end with a single period (e.g., `foo`, `my_var`, `x.`).
* **Numerals (`BIG_INT`):** Integers of arbitrary length, supporting optional negative signs (e.g., `123`, `-456`). These are parsed into a custom `bigint` data structure to prevent standard integer overflow.
* **Booleans:** Represented by `t` (True) and `()` or `NIL` (False/Empty List).
* **Operators & Symbols:** 
  * Arithmetic: `+`, `-`, `*`, `div`, `mod`
  * Comparison: `=`, `>`, `<`, `>=`, `<=`, `=/=`
* **Keywords:** Core language features including `quote`, `atom`, `eq`, `car`, `cdr`, `cons`, `cond`, `lambda`, `label`, and `defun`.
* **Dynamic Keywords:** A regular expression dynamically matches any variation of nested `car`/`cdr` operations (e.g., `cadr`, `cddaar`).

#### 2. Context-Free Grammar (CFG) Rules
The language structure is defined by mutually recursive rules that process tokens into expressions:

* **Atom (`atom`):** The smallest indivisible unit of the language. It safely maps terminal tokens (Identifiers, Numbers, Booleans, Operators, and Keywords) into AST leaf nodes.
* **Expression (`expr`):** A LITHP expression evaluates to either:
  1. A single `atom`.
  2. A parenthesized list of expressions: `( expr_list )`.
* **Expression List (`expr_list`):** A right-recursive sequence containing zero or more `expr` units.

#### Compilation and Usage

```bash
#To compile the files use all and then run using make run
make all run

# Clears all *.cmi *.cmo files
make clean
```