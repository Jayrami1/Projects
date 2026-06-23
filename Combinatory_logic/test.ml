(* test.ml *)

open Main (* Assumes you are compiling with the Makefile. If using REPL, change to: #use "main.ml";; *)

(* Helper function to print the resulting CL tree in the requested format *)
let rec string_of_comb = function
  | Vc x -> x
  | S -> "S"
  | K -> "K"
  | I -> "I"
  | Appc (c1, c2) -> "(" ^ string_of_comb c1 ^ " " ^ string_of_comb c2 ^ ")"

(* The Core Testing Pipeline: lam -> translate -> comb -> wnf(c, []) -> print *)
let run_test test_name lam_expr =
  print_endline ("----------------------------------------------------------------");
  print_endline test_name;
  let cl_expr = to_comb lam_expr in
  let result = wnf (cl_expr, []) in
  print_endline ("Result: " ^ string_of_comb result);
  print_endline ""

(* ==========================================
   A4 TEST DEFINITIONS
   ========================================== *)

(* 4.1 Variable: V "y" *)
let t1 = V "y"

(* 4.2 Identity application: (\x.x) y *)
let id = Lam("x", V "x")
let t2 = App(id, V "y")

(* Church Numerals Base *)
let ch_0 = Lam("f", Lam("x", V "x"))
let ch_1 = Lam("f", Lam("x", App(V "f", V "x")))
let ch_2 = Lam("f", Lam("x", App(V "f", App(V "f", V "x"))))
let ch_3 = Lam("f", Lam("x", App(V "f", App(V "f", App(V "f", V "x")))))

(* 4.3 Church numeral 0: (church 0) f x *)
let t3 = App(App(ch_0, V "f"), V "x")

(* 4.4 Church numeral 1: (church 1) f x *)
let t4 = App(App(ch_1, V "f"), V "x")

(* 4.5 Church numeral 2: (church 2) f x *)
let t5 = App(App(ch_2, V "f"), V "x")

(* 4.6 Church numeral 3: (church 3) f x *)
let t6 = App(App(ch_3, V "f"), V "x")

(* 4.7 K combinator behavior: (\x.\y.x) u v *)
let k_comb = Lam("x", Lam("y", V "x"))
let t7 = App(App(k_comb, V "u"), V "v")

(* 4.8 K* combinator behavior: (\x.\y.y) u v *)
let k_star = Lam("x", Lam("y", V "y"))
let t8 = App(App(k_star, V "u"), V "v")

(* 4.9 Nested application: ((\x.x) (\y.y)) z *)
let t9 = App(App(id, Lam("y", V "y")), V "z")

(* 4.10 Constant function (free variable body): (\x.w) y *)
let const_fn = Lam("x", V "w")
let t10 = App(const_fn, V "y")


(* ==========================================
   EXECUTE TESTS
   ========================================== *)

let () =
  run_test "4.1 Variable\nRun: V \"y\"" t1;
  run_test "4.2 Identity application\nRun: (\\x.x) y" t2;
  run_test "4.3 Church numeral 0\nRun: (church 0) f x" t3;
  run_test "4.4 Church numeral 1\nRun: (church 1) f x" t4;
  run_test "4.5 Church numeral 2\nRun: (church 2) f x" t5;
  run_test "4.6 Church numeral 3\nRun: (church 3) f x" t6;
  run_test "4.7 K combinator behavior\nRun: (\\x.\\y.x) u v" t7;
  run_test "4.8 K* combinator behavior\nRun: (\\x.\\y.y) u v" t8;
  run_test "4.9 Nested application\nRun: ((\\x.x) (\\y.y)) z" t9;
  run_test "4.10 Constant function\nRun: (\\x.w) y" t10;
  
  print_endline "----------------------------------------------------------------";
  print_endline "ALL TESTS EXECUTED"