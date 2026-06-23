### Assignment 2a: A Bigint Package (Modules/(Abstract) Data Type)

#### Files Included

* **[assignment2a.ml](assignment2a.ml)**: The primary implementation containing all core logic.


#### Generated Files

* **assignment2a**: The compiled bytecode executable.
* **.cmi / *.cmo**: Intermediate OCaml compiled interface and object files.



#### Approach and Methodology

##### 1. BIGNUM Data Structure


* **Type Definition**: `type bigint = sign * int list`. The magnitude is stored as a list of integers (digits 0-9), allowing the number to grow dynamically without the overflow limits of standard 63-bit integers.
* **Normalization**: The `strip_zeros` function acts as a normalization invariant. It recursively removes leading zeros to ensure that every number has a unique representation (e.g., `[0; 0; 7]` becomes `[7]`).
* **Sign Isolation**: The system separates **Magnitude Operations** (`add_mags`, `sub_mags`) from **Signed Operations** (`add`, `sub`). This modularity allows the helper code to focus purely on numerical logic while the wrapper functions handle sign rules (e.g., subtracting a negative number becomes addition).

##### 2. Arithmetic Algorithms

The arithmetic operations rely on **List Fold** to promote recursion rather than iterative approaches. The logic explicitly handles all four sign combinations for operations. For example, `sub` is defined as `add a (neg b)`, reducing the problem space to magnitude operations.

* **Addition & Subtraction**: Implemented using `List.fold_left` on reversed lists. This mimics the standard column-addition algorithm, propagating carries (`c`) and borrows (`b`) through the accumulator.(ripple carry adder type)
* **Multiplication**: Uses a **Shift** strategy. The multiplicand is multiplied by each digit of the multiplier (partial products), and these results are shifted (padded with zeros) and summed using the existing `add_mags` function.
* **Division**: Implemented as **Long Division**. The algorithm iterates through the dividend from highest digit to lowest in places.
* **Quotient**: For each step, the `find_q` helper function determines the largest digit  such that it cannot be subtracted more without changing signs.


##### 3. Efficient List Management

* **Comparison Logic**: If lengths are equal, it uses `List.fold_left` to perform a lexicographical comparison from MSD to LSD else based on signs and length of lists comparision is done.
* **Alignment**: The `prepare_lists` function handles inputs of unequal lengths by padding the shorter list with leadng zeros, ensuring that `fold` operations always process corresponding powers of 10 together.

#### Handling Edge cases
* **Division Safety**: The `division` function explicitly guards against `Division_by_zero` by checking if the normalized divisor is `[0]` before attempting recursion.
* **Sign Consistency**: The division operation implements **Truncated Division** (rounding towards zero). The sign of the quotient matches standard integer division rules (`+ / - = -`), and the remainder adopts the sign of the dividend, consistent with standard OCaml behavior (`-107 mod -7 = -2`).
* **Edge Case Coverage**: The system correctly handles identity elements (adding 0, multiplying by 1) and inverse operations (subtracting a number from itself yields `[0]`).
#### Compilation and Usage

To compile the code:

```bash
ocamlc -o assignment2a assignment2a.ml
./assignment2a
```
For running test cases interactively, open it directly in utop:
```bash
utop
"#use "assignment2a.ml";;
```