open Assignment3
open Tests

let rec string_of_exp = function
  | V x -> x
  | Abs (x, e) -> "(\\" ^ x ^ ". " ^ string_of_exp e ^ ")"
  | App (e1, e2) -> "(" ^ string_of_exp e1 ^ " " ^ string_of_exp e2 ^ ")"
  | Let (x, e1, e2) -> "let " ^ x ^ " = " ^ string_of_exp e1 ^ " in " ^ string_of_exp e2
  | Int n -> string_of_int n
  | Bool b -> string_of_bool b
  | Add (e1, e2) -> "(" ^ string_of_exp e1 ^ " + " ^ string_of_exp e2 ^ ")"
  | Mul (e1, e2) -> "(" ^ string_of_exp e1 ^ " * " ^ string_of_exp e2 ^ ")"
  | If (cond, e1, e2) -> "(if " ^ string_of_exp cond ^ " then " ^ string_of_exp e1 ^ " else " ^ string_of_exp e2 ^ ")"
  | And (e1, e2) -> "(" ^ string_of_exp e1 ^ " AND " ^ string_of_exp e2 ^ ")"
  | Or (e1, e2) -> "(" ^ string_of_exp e1 ^ " OR " ^ string_of_exp e2 ^ ")"
  | Not e -> "(NOT " ^ string_of_exp e ^ ")"

let rec string_of_opcodes ops =
  let string_of_opcode = function
    | LOOKUP x -> "LOOKUP " ^ x
    | MKCLOS (x, c) -> "MKCLOS (" ^ x ^ ", [" ^ string_of_opcodes c ^ "])"
    | APP -> "APP"
    | RET -> "RET"
  in
  String.concat "; " (List.map string_of_opcode ops)

let rec free_vars e =
  match e with
  | V x -> [x]
  | Abs (x, e1) -> List.filter (fun y -> y <> x) (free_vars e1)
  | App (e1, e2) -> (free_vars e1) @ (free_vars e2)
  | _ -> []

let rec fresh_var x vars =
  if List.mem x vars then fresh_var (x ^ "'") vars else x

let rec subst x v e =
  match e with
  | V y -> if x = y then v else V y
  | App (e1, e2) -> App (subst x v e1, subst x v e2)
  | Abs (y, e1) ->
      if x = y then Abs (y, e1)
      else if not (List.mem y (free_vars v)) then Abs (y, subst x v e1)
      else
        let y' = fresh_var y ((free_vars e1) @ (free_vars v) @ [x]) in
        let e1' = subst y (V y') e1 in
        Abs (y', subst x v e1')
  | _ -> e
(*to bring from lambda to int bool format*)
let rec beta_reduce e =
  match e with
  | App (Abs (x, e1), e2) -> beta_reduce (subst x e2 e1)
  | App (e1, e2) ->
      let e1' = beta_reduce e1 in
      (match e1' with
       | Abs _ -> beta_reduce (App (e1', e2))
       | _ -> App (e1', beta_reduce e2))
  | Abs (x, e1) -> Abs (x, beta_reduce e1)
  | _ -> e

let rec church_to_int exp =
  let rec count_apps e =
    match e with
    | App (V "_f", rest) -> 1 + count_apps rest
    | V "_x" -> 0
    | _ -> failwith "Not fully reduced"
  in
  match exp with
  | Abs ("_f", Abs ("_x", body)) -> count_apps body
  | _ -> failwith "Not a Church Numeral"

let church_to_bool exp =
  match exp with
  | Abs ("_t", Abs ("_f", V "_t")) -> true
  | Abs ("_t", Abs ("_f", V "_f")) -> false
  | _ -> failwith "Not a Church Boolean"

let krivine_eval_list ast = let rec f g s = if g<0 then failwith "Loop" else try f (g-1) (KrivineList.step s) with _->fst s in KrivineList.unpack (f 9999 (KrivineList.KClos (synt_to_lambda ast, List_table.empty), []))
let krivine_eval_fun ast  = let rec f g s = if g<0 then failwith "Loop" else try f (g-1) (KrivineFun.step s) with _->fst s in KrivineFun.unpack (f 9999 (KrivineFun.KClos (synt_to_lambda ast, Func_table.empty), []))
let secd_eval_list ast    = let rec f g s = if g<0 then failwith "Loop" else match s with (v::_,_,[],[])->v | _->f (g-1) (SECDList.step s) in f 9999 ([], List_table.empty, compile (synt_to_lambda ast), [])
let secd_eval_fun ast     = let rec f g s = if g<0 then failwith "Loop" else match s with (v::_,_,[],[])->v | _->f (g-1) (SECDFun.step s) in f 9999 ([], Func_table.empty, compile (synt_to_lambda ast), [])

let print_krivine_list name ast =
  try
    let k_res = krivine_eval_list ast in
    let reduced = beta_reduce k_res in
    try Printf.printf "  [%s] Result: %d\n" name (church_to_int reduced)
    with _ -> 
      try Printf.printf "  [%s] Result: %b\n" name (church_to_bool reduced)
      with _ -> Printf.printf "  [%s] Lambda AST:\n    %s\n" name (string_of_exp reduced)
  with Failure msg -> Printf.printf "  [%s] Result: <CRASH: %s>\n" name msg

let print_krivine_fun name ast =
  try
    let k_res = krivine_eval_fun ast in
    let reduced = beta_reduce k_res in
    try Printf.printf "  [%s] Result: %d\n" name (church_to_int reduced)
    with _ -> 
      try Printf.printf "  [%s] Result: %b\n" name (church_to_bool reduced)
      with _ -> Printf.printf "  [%s] Lambda AST:\n    %s\n" name (string_of_exp reduced)
  with Failure msg -> Printf.printf "  [%s] Result: <CRASH: %s>\n" name msg

let print_secd_list name ast = 
  try
    let res = secd_eval_list ast in
    let ast_unpacked = SECDList.unpack_val res in
    let reduced = beta_reduce ast_unpacked in
    try Printf.printf "  [%s] Result: %d\n" name (church_to_int reduced)
    with _ -> 
      try Printf.printf "  [%s] Result: %b\n" name (church_to_bool reduced)
      with _ -> Printf.printf "  [%s] Lambda AST:\n    %s\n" name (string_of_exp reduced)
  with Failure msg -> 
    let ops_str = try string_of_opcodes (compile (synt_to_lambda ast)) with _ -> "Error compiling" in
    Printf.printf "  [%s] Result: <CRASH: %s>\n" name msg;
    Printf.printf "  [%s] Compiled Opcodes: [%s]\n" name ops_str

let print_secd_fun name ast = 
  try
    let res = secd_eval_fun ast in
    let ast_unpacked = SECDFun.unpack_val res in
    let reduced = beta_reduce ast_unpacked in
    try Printf.printf "  [%s] Result: %d\n" name (church_to_int reduced)
    with _ -> 
      try Printf.printf "  [%s] Result: %b\n" name (church_to_bool reduced)
      with _ -> Printf.printf "  [%s] Lambda AST:\n    %s\n" name (string_of_exp reduced)
  with Failure msg -> 
    let ops_str = try string_of_opcodes (compile (synt_to_lambda ast)) with _ -> "Error compiling" in
    Printf.printf "  [%s] Result: <CRASH: %s>\n" name msg;
    Printf.printf "  [%s] Compiled Opcodes: [%s]\n" name ops_str
let run_test (name, ast) =
  print_endline ("\n========================================================");
  print_endline (" RUNNING: " ^ name);
  print_endline (" Source AST: " ^ string_of_exp ast);
  print_endline ("========================================================");

  print_krivine_list "Krivine (ListTable)" ast;
  print_krivine_fun "Krivine (FunTable) " ast;
  print_secd_list "SECD (ListTable)   " ast;
  print_secd_fun "SECD (FunTable)    " ast

let () =
  print_endline "Starting Pure Church-Encoded Interpreter Test Suite...";
  List.iter run_test Tests.all_tests;
  print_endline "\nAll combinations executed successfully!"