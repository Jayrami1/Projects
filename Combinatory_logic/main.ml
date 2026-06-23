type lam = V of string | Lam of string * lam | App of lam * lam;;
type comb = Vc of string | S | K | I | Appc of comb * comb ;;

(*helper to check if a variable x is free in a CL term p*)
let rec contains_var x = function
  | Vc y -> x = y
  | Appc (p1, p2) -> contains_var x p1 || contains_var x p2
  | S | K | I -> false;;

(*core abstraction on Combinatory Logic terms [x]P*)
let rec abs_comb x p =
  if not (contains_var x p) then
    Appc (K, p)
  else match p with
    | Vc y -> if x = y then I else Appc (K, Vc y)
    | Appc (p1, p2) -> Appc (Appc (S, abs_comb x p1), abs_comb x p2)
    | S | K | I -> Appc (K, p)
let rec to_comb = function
  | V x -> Vc x
  | App (e1, e2) -> Appc (to_comb e1, to_comb e2)
  | Lam (x, e) -> abs (x, e)
and abs (x, e) =
  let p = to_comb e in
  abs_comb x p;;

(*stack based evaluator *)
let rec wnf = function
  | (I, c :: s) -> wnf (c, s)
  | (K, c1 :: c2 :: s) -> wnf (c1, s)
  | (S, c1 :: c2 :: c3 :: s) -> wnf (Appc (Appc (c1, c3), Appc (c2, c3)), s)
  | (Appc (c1, c2), s) -> wnf (c1, c2 :: s)
  | (c, s) -> unstack (c, s)

(*unstack unevaluated terms *)
and unstack = function
  | (c, []) -> c
  | (c, c2 :: s) ->
      let c' = wnf (c2, []) in
      unstack (Appc (c, c'), s);;