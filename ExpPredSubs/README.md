

### Assignment 1: Expressions, Substitution, Predicates

#### Files Included

* **[assignment1.ml](assignment1.ml)**: The primary implementation containing all core logic.


#### Generated Files

* **assignment1**: The compiled bytecode executable.
* **.cmi / *.cmo**: Intermediate OCaml compiled interface and object files.



#### Approach and Methodology

##### 1. Functional Module Architecture

The project is built using **OCaml Modules** to ensure strict typing and domain isolation between expressions and predicates.

* **`EXP` Module**: Parameterized by `SYMBOL` and `VARIABLE` signatures. It manages the core AST (Abstract Syntax Tree) representation.
* **`Predexp` Module**: A higher-level module that layers First-Order Logic connectives () on top of the existing Expression module.

##### 2. Efficient Substitution Logic

To ensure high performance, especially for the **Weakest Precondition** tasks, the substitution was transitioned from linear arrays to **Hash Tables**.

* **Lookup Complexity**: Reduced from **O(n)** to **O(1)** average case.
* **Composition**: Implemented as a Kleisli composition. When calculating , it ensures that  takes precedence while applying  to its internal mappings.
* **In-Situ Substitution**: For memory-intensive tasks, an imperative `in_situ_subst` function modifies the existing tree arrays directly, avoiding the overhead of allocating new nodes.

##### 3. Structural Editing (Path-Based)

The `edit` function allows surgical replacement of sub-expressions based on a **Position** (a list of integers representing the path from the root).

* **Efficiency**: Uses **Path Copying**. Only the nodes along the path are re-allocated; all other branches are shared with the original tree.
* **Error Handling**: Implements a custom exception `InvalidPosition` to catch out-of-bounds indices or premature leaf-reaching.



#### Formula Metrics & Verification

##### Clause & Metric Logic:

* **`wfexp` (Well-Formed Expression)**: Recursively verifies that every `Node` contains exactly the number of children defined by the symbol's arity.
* **`wff` (Well-Formed Formula)**: Extends validation to the predicate layer, checking the arity of predicate symbols and the validity of their expression arguments.
* **`ht` (Height)**: Calculated as the maximum depth of the tree.
* **`vars` (Variable Set)**: Extracts a unique list of variables.



#### Correctness

##### Soundness: Valid Transformations

* **Composition Soundness**: The `composition` function ensures that the resulting substitution  satisfies .
* **Arity Safety**: The `wff` check prevents the creation of logically invalid predicates (e.g., a binary predicate with three arguments).

##### Completeness: Full Coverage

* **Homomorphic Extension**: The `subst` and `psubst` functions are defined recursively over the entire inductive structure of expressions and predicates, ensuring no node type is ignored during transformation.
* **Path Reachability**: The `edit` function can reach any sub-expression in a well-formed tree, provided a valid coordinate path exists.

##### Weakest Precondition (`wp`)

The implementation of `wp(x, e) p` effectively implements the **Substitution Lemma**. By converting the single variable mapping into a singleton Hash Table, it leverages the optimized `psubst` to replace every occurrence of  with  in one pass.



#### Compilation and Usage

To compile the code:

```bash
ocamlc -o assignment1 assignment1.ml
./assignment1
```
For running test cases interactively, open it directly in utop:
```bash
utop
"#use "assignment1.ml";;
```