### Assignment 2d: Weak Type Inference for LITHP

#### Files Included

  * **[assignment2d\_type.ml](assignment2d_type.ml)**: The core type inference engine. It evaluates AST nodes and returns a tuple containing all possible types for the expression and the updated environment.
  * **[AST.ml](AST.ml)**: Contains the Abstract Syntax Tree definitions and the LITHP Type definitions (`TInt`, `TBool`, `TList(n)`, `TFunc(n, rets)`, and `TAny`).
  * **[main.ml](main.ml)**: The main file that reads from `input.txt`, parses multi-line inputs by counting parentheses, tracks the persistent global environment, and prints the AST and inferred types.
  * **[assignment2c\_yacc.mly](assignment2c_yacc.mly)**: The OCaml-yacc specification defining the parser grammar, including support for the `'` quote syntactic sugar.
  * **[assignment2b\_lex.mll](assignment2b_lex.mll)**: The OCaml-lex specification defining tokens, including rules to strip comments and handle dynamic `c[ad]+r` strings.
  * **[assignment2a.ml](assignment2a.ml)**: The integrated BigInt package used for infinite-precision numeral operations.
  * **[input.txt](input.txt)**: A comprehensive test suite containing multi-line expressions, edge cases, and intentional type errors to test exception handling.
  * **[Makefile](Makefile)**: Consists of all running instructions for the OCaml compiler and executable.

#### Generated Files

  * **assignment2b\_lex.ml**: The OCaml scanner generated from the lexer specification.
  * **assignment2c\_yacc.ml / .mli**: The parser implementation and interface.
  * **.cmi / .cmo**: Compiled OCaml interfaces and object files.
  * **lithp\_parser**: The final compiled executable.

#### Changes from Assignment 2c to 2d

To support type checking, the following structural changes were made to the foundational parser files:

1.  **`AST.ml` (New Module)**: The Abstract Syntax Tree definitions (`atom` and `exp`) were extracted from `assignment2a.ml` to decouple the BigInt logic from the compiler structures. Added the `typ` variant type to represent LITHP weak types.
2.  **`assignment2b_lex.mll`**:
      * Added token recognition for the Part D boolean logic operators: `and`, `or`, and `not`.
3.  **`assignment2c_yacc.mly`**:
      * Added syntax grammar for the `'` (tick) syntactic sugar, seamlessly translating `'expr` into `(quote expr)`.
      * Added grammar support for the new boolean logic tokens.
4.  **`main.ml`**:
      * Transitioned from an interactive terminal REPL to an automated file-processor that reads LISP expressions chunk-by-chunk from `input.txt`.
      * Implemented **purely functional state management**, passing the `env` state tuple recursively through the parsing loop to remember function definitions across multiple lines without using mutable `ref` variables.
      * Added formatting functions to elegantly print inferred type lists to the terminal.
5.  **`Makefile`**: Updated to compile the new `AST.ml` and `assignment2d_type.ml` dependencies in the correct order.

#### Type System & Design Decisions

Because LITHP is a **weakly typed** language, expressions do not always have a single principal type. The type checker infers a *list* of possible types, utilizing several specific design decisions to emulate classic Lisp behavior:

**1. Dual Typing for the Empty List**
The empty list `()` evaluates to both a Boolean and a List of length zero: `[TBool; TList(0)]`. This allows the empty list to be used dynamically in both logical comparisons and list manipulations.

**2. Function Parameters and the `TAny` Wildcard**
When defining functions via `lambda`, `label`, or `defun`, parameters are **not strictly typed**. Instead, the type checker binds parameters to a wildcard type `TAny`. The specific return type of the function is dictated entirely by the operators used in the function's body (e.g., if the body is `(+ x y)`, the `+` operator accepts `TAny` and forces the return type to be `[Int]`).

**3. Function Application & Arity Checking**
During function application (e.g., `(square 5)`), the type checker **does not check the types of the arguments provided**. It relies exclusively on checking the **arity** (the number of arguments). If the function expects 1 argument and 1 argument is provided, the type check passes and returns the function's predefined return type.

**4. Higher-Order Functions (Functions as Parameters)**
The type system fully supports passing functions as arguments to other functions (e.g., `((lambda (f x) (f x)) square 5)`). Because parameters are typed as `TAny`, the type checker includes a special rule that allows a `TAny` variable to be executed as a function. It assigns it a dummy arity of `-1` to bypass strict argument-count checking, returning `[Any]` as the safe evaluation type.

**5. `cond` Type Merging**
For `cond` expressions, we implemented the "weaker" typing design decision. Instead of enforcing that all branches return the exact same type, the type checker recursively evaluates the return type of *every* valid branch and merges them. For example, if one branch returns `[Int]` and another returns `[Bool; List(0)]`, the `cond` block successfully evaluates to `[Int; Bool; List(0)]`.

**6. Dynamic `c[ad]+r` Regex Evaluation**
Instead of hardcoding rules for `car`, `cdr`, `cadr`, `caddr`, etc., the type checker dynamically parses any string matching the regex `c[ad]+r`. It reads the string from right to left, dynamically applying type reductions:

  * `'d'` (cdr): Requires a `List(n)` where `n > 0` and returns `List(n - 1)`.
  * `'a'` (car): Requires a `List(n)` where `n > 0` and returns `Any`.

**7. Function Signatures**
Following the assignment specifications, function signatures represent incoming arguments as a list. In the terminal output, functions accurately print as `List(n) -> [ty]` (e.g., `List(2) -> [Int]`).

**8. Purely Functional State Management**
The `infer_type` engine in `assignment2d_type.ml` is purely functional. It takes an environment and returns a tuple of `(types, updated_env)`. The `main.ml` REPL handles the persistent state by passing this updated environment sequentially to the next line of `input.txt`, allowing functions defined via `defun` or `label` to be used globally across the entire file without relying on mutable `ref` variables.

#### Compilation and Usage

```bash
# To compile the files and run the input.txt test suite automatically
make all run

# Clears all *.cmi *.cmo files and the executable
make clean
```