open Assignment2a
type typ =
  | TInt
  | TBool
  | TList of int (*tracks length 'n'List(n) *)
  | TFunc of int * typ list (*list(n)->possible return types*)
  | TAny (* for elements in car cadr*)

type atom =
  | ID of string          
  | NUM of bigint         
  | BOOL of bool          
  | SYMBOL of string

type exp =
  | A of atom             
  | L of exp list      

(* Exception for Type Mismatches *)
exception TypeError of string