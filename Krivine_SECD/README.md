### Assignment 3: Pure Lambda Calculus Interpreters (Krivine & SECD)

#### Files Included

* **`assignment3.ml`**:  core execution engine. In this file, I defined the Abstract Syntax Tree (AST), the `synt_to_lambda` desugaring pass (for Church encodings), and the `TABLE` signature with two distinct implementations (`List_table` and `Func_table`). I also implemented the Krivine and SECD abstract machines here as OCaml Functors.
* **`main.ml`**: The execution runner. I wrote a betareducer here to force the full evaluation of Weak normal form closures. It also contains  "Un-churching" helper functions (`church_to_int`, `church_to_bool`), the AST-to-string formatters, and the main loop that runs  tests across all four machine/table combinations.
* **`tests.ml`**: tests cases to test all cases of simple to complex implementations
* **`Makefile`**: Contains the build instructions to compile the interrelated `.ml` files and link them into the final executable.

#### Generated Files

* **`.cmi / .cmo`**: Compiled OCaml interfaces and object files generated during the build process.
* **`interpreter`**: The final compiled executable.

#### Core Architecture & Design Decisions

To satisfy the requirements for Call-by-Name (Krivine) and Call-by-Value (SECD) evaluation :

**1. Pure Church Encodings (Syntactic Sugar)**
Instead of polluting  abstract machines with hardware-level math opcodes (like `ADD` or `VInt`), I treated all primitive data types as syntactic sugar. I wrote a `synt_to_lambda` function that intercepts Integers, Booleans, Arithmetic, and Logic, and compiles them down entirely into **Pure Lambda Calculus**. 
* **Booleans:** I encoded `True` as a function that takes two arguments and returns the first, and `False` as a function that returns the second. This naturally allowed me to evaluate `If` statements as pure function applications.
* **Numerals:** I encoded integers as Church Numerals, where a number $N$ is represented as a function that takes an action `f` and a base case `x`, applying `f` to `x` exactly $N$ times.
* **Arithmetic:** Addition and Multiplication are implemented as higher-order functions. For example,  addition macro takes two Church numerals ($m$ and $n$) and creates a new function that applies `f` to `x` $n$ times, and then applies `f` to that result $m$ more times.
* **Confusion Resolv:** To prevent variable capture bugs (e.g., if a user-defined variable like `x` or `f` collides with the variables in  Church macros), I ensured all variables in  desugarer are prefixed with an underscore (e.g., `_x`, `_f`, `_t`).

**2. Modular Environments via OCaml Functors**
The assignment required testing both machines against two environment structures: a List of Tuples and a Function mapping. Rather than copying and pasting  machine code to swap the environments, I defined a generic `TABLE` module signature. 
I then wrote  Krivine and SECD machines as **OCaml Functors**. This design allowed me to dynamically instantiate four distinct, perfectly synchronized abstract machines by just passing the table modules in: `KrivineList`, `KrivineFun`, `SECDList`, and `SECDFun`.

**3. SECD Decompiler & Reverse-Engineering**
Because the SECD machine compiles expressions into machine-level opcodes (e.g., `[LOOKUP x; MKCLOS (y, [...]); APP; RET]`), standard execution results in an unreadable closure. The assignment explicitly required showing that the resulting closure is a correct rendering of the lambda term. To solve this, I made a `decompile` and `unpack_val` module into  SECD Functor. It parses the execution stack in reverse and substitutes environment variables, flawlessly reconstructing the raw Lambda AST from the compiled bytecode.

**4. Un-Churching the Output**
Once  Beta-Reducer simplifies the AST, I wanted the terminal output to be readable. I wrote `church_to_int` and `church_to_bool` helper functions that pattern-match the pure lambda structures. By counting the number of nested applications of `_f`, the interpreter seamlessly translates the purely functional outputs back into standard OCaml integers and booleans for the terminal display.

#### Compilation and Usage

```bash
# To compile the core engine, tests, and runner, and execute the 50-test suite:
make clean
make run
```