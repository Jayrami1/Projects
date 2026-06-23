(* tests.ml *)
open Assignment3

let id = Abs ("x", V "x")
let k_comb = Abs ("x", Abs ("y", V "x"))
let omega_func = Abs ("x", App (V "x", V "x"))
let omega = App (omega_func, omega_func)
let pair = Abs ("a", Abs ("b", Abs ("s", App (App (V "s", V "a"), V "b"))))
let fst_func = Abs ("p", App (V "p", Abs ("x", Abs ("y", V "x"))))
let snd_func = Abs ("p", App (V "p", Abs ("x", Abs ("y", V "y"))))
let tru = Abs ("t", Abs ("f", V "t"))
let fls = Abs ("t", Abs ("f", V "f"))
let church_if = Abs ("c", Abs ("t", Abs ("e", App (App (V "c", V "t"), V "e"))))
let church_1 = Abs ("s", Abs ("z", App (V "s", V "z")))
let church_succ = Abs ("n", Abs ("s", Abs ("z", App (V "s", App (App (V "n", V "s"), V "z")))))

(* FORMAT: (test_name, ast) *)
let all_tests = [
  ("3.1 Identity and basic application", App (id, Abs ("y", V "y")));
  ("3.2 Constant function (K combinator)", App (App (k_comb, Abs ("z", V "z")), Abs ("a", Abs ("b", V "a"))));
  ("3.3 Pair encoding - fst", App (fst_func, App (App (pair, id), k_comb)));
  ("3.4 Pair encoding - snd", App (snd_func, App (App (pair, id), k_comb)));
  ("3.5 Boolean encoding - true branch", App (App (App (church_if, tru), id), k_comb));
  ("3.6 Boolean encoding - false branch", App (App (App (church_if, fls), id), k_comb));
  ("3.7 Church numerals (successor)", App (church_succ, church_1));
  ("3.8 Nested scoping", App (App (Abs ("x", Abs ("y", V "x")), Abs ("z", V "z")), Abs ("a", Abs ("b", V "a"))));
  ("3.9 Call-by-Name laziness test (Omega)", App (App (Abs ("x", Abs ("y", V "y")), omega), Abs ("z", V "z")));
  ("3.10 Call-by-Value strictness test (Omega)", App (App (Abs ("x", Abs ("y", V "y")), omega), Abs ("z", V "z")));
  
  ("3.11 Closure capture", App (App (Abs ("x", Abs ("y", V "x")), Abs ("z", V "z")), Abs ("w", V "w")));
  ("3.12 Variable shadowing", App (Abs ("x", Abs ("x", V "x")), Abs ("y", V "y")));
  ("3.13a SECD compilation sanity 1", Abs ("x", V "x"));
  ("3.13b SECD compilation sanity 2", App (Abs ("x", V "x"), V "y"));
  ("3.14 SECD execution", App (Abs ("x", V "x"), Abs ("y", V "y")));
  ("3.15a Cross-machine consistency 1", App (Abs ("x", V "x"), Abs ("y", V "y")));
  ("3.15b Cross-machine consistency 2", App (App (Abs ("x", Abs ("y", V "x")), V "a"), V "b"));
  ("3.16a Extended language (Add)", Add (Int 1, Int 2));
  ("3.16b Extended language (If)", If (Bool true, Int 42, Int 0));
  ("3.17 Let binding", Let ("x", Int 10, Add (V "x", V "x")));
]