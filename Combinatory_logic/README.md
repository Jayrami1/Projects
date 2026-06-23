### Assignment: Lambda Calculus to Combinatory Logic Compiler

#### Files Included

* **`main.ml`**: The core compiler and evaluation engine. In this file, I defined the Abstract Syntax Trees (AST) for both Lambda Calculus (`lam`) and Combinatory Logic (`comb`). It contains the `to_comb` translator, the core variable abstraction logic (`abs_comb`), and the mutually recursive stack-based evaluator (`wnf` and `unstack`).
* **`test.ml`**: The execution runner and test suite. This file contains the Church Encodings (Booleans, Numerals, Arithmetic), the AST-to-string formatter, and a custom testing framework (`test_numeral`, `test_boolean`) to verify the compiler against standard functional representations.
* **`Makefile`**: Contains the build instructions to compile the interrelated `.ml` files and link them into the final executable.

#### Generated Files

* **`.cmi / .cmo`**: Compiled OCaml interfaces and object files generated during the build process.
* **`evaluate_cl`**: The final compiled executable.


#### Compilation and Usage

```bash
# To clean build artifacts, compile the core engine and tests, and run the suite:
make clean
make
./evaluate_cl
```