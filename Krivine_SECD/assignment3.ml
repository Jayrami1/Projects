type var = string
type exp =
  | V of var
  | Abs of var * exp
  | App of exp * exp
  (*syntactic sugar and int bool using church and lambda*)
  | Let of var * exp * exp
  | Int of int
  | Bool of bool
  | Add of exp * exp
  | Mul of exp * exp
  | If of exp * exp * exp
  | And of exp * exp
  | Or of exp * exp
  | Not of exp
  
let rec synt_to_lambda (e : exp) : exp =
  match e with
  | V x -> V x
  | Abs (x, e1) -> Abs (x, synt_to_lambda e1)
  | App (e1, e2) -> App (synt_to_lambda e1, synt_to_lambda e2)
  (*smart ways to implement condi, let , in tbools*)
  | Let (x, e1, e2) -> App (Abs (x, synt_to_lambda e2), synt_to_lambda e1)
  | Bool true  -> Abs("_t",Abs("_f",V"_t"))
  | Bool false -> Abs("_t",Abs("_f",V"_f"))
  | If (cond,e1,e2) -> App(App(synt_to_lambda cond, synt_to_lambda e1), synt_to_lambda e2)
  | And (e1,e2)-> App(App(synt_to_lambda e1, synt_to_lambda e2), synt_to_lambda (Bool false))
  | Or (e1,e2) -> App(App(synt_to_lambda e1, synt_to_lambda (Bool true)), synt_to_lambda e2)
  | Not e1    -> App(App(synt_to_lambda e1, synt_to_lambda (Bool false)), synt_to_lambda (Bool true))

  | Int n -> 
      let rec num_rec count =
        if count = 0 then V "_x" else App (V "_f", num_rec (count - 1))
      in Abs ("_f", Abs ("_x", num_rec n))

  | Add (e1, e2) -> 
      let m = synt_to_lambda e1 and n = synt_to_lambda e2 in
      Abs("_f", Abs ("_x", App (App (m, V "_f"), App (App (n, V "_f"), V "_x"))))
      
  | Mul (e1, e2) -> 
      let m = synt_to_lambda e1 and n = synt_to_lambda e2 in
      Abs("_f", App (m, App (n, V "_f")))
(*general implementation module which will be overloaded by two methods*)
module type TABLE = sig
  type 'a t
  val empty : 'a t
  val extend : var -> 'a -> 'a t -> 'a t
  val lookup : var -> 'a t -> 'a
  val remove : var -> 'a t -> 'a t
end

module List_table : TABLE = struct
  type 'a t = (var * 'a) list
  let empty = []
  let extend x v t = (x, v) :: t
  let rec lookup x t =
    match t with
    | [] -> failwith ("Unbound variable: " ^ x)
    | (k, v) :: rest -> if k = x then v else lookup x rest
  let rec remove x t =
    match t with
    |[]-> []
    |(k,v) :: rest -> if k = x then remove x rest else (k, v) :: remove x rest
end

module Func_table : TABLE = struct
  type 'a t = var -> 'a
  let empty = fun x -> failwith ("Unbound variable: " ^ x)
  let extend x v t = fun y -> if y = x then v else t y
  let lookup x t = t x
  let remove x t = fun y -> if y = x then failwith ("Unbound variable: " ^ x) else t y
end

module Krivine (T : TABLE) = struct
  type k_clos = KClos of exp * k_clos T.t
  type k_state = k_clos * k_clos list
(*converts closures to expression in lambda*)
  let rec unpack (KClos (e, env)) =
    match e with
    | V x -> (try unpack (T.lookup x env) with Failure _ -> V x)
    |Abs (x, e1) -> Abs (x, unpack (KClos (e1, T.remove x env)))
    | App (e1, e2) -> App (unpack (KClos (e1, env)), unpack (KClos (e2, env)))
    | _ -> e

  let step (state : k_state) : k_state =
    match state with
    |(KClos (App (e1, e2), gamma), s) -> (KClos (e1, gamma), KClos (e2, gamma) :: s)
    |(KClos (V x, gamma), s) -> (T.lookup x gamma, s)
    |(KClos (Abs (x, e1), gamma), cl :: s) -> (KClos (e1, T.extend x cl gamma), s)
    | _ -> failwith "Krivine Machine halted or stuck"

  let rec run (state : k_state) : k_clos =
    try run (step state)
    with Failure _ -> fst state 

  let eval e =
    let pure_e = synt_to_lambda e in
    unpack (run (KClos (pure_e, T.empty), []))
end

type opcode = LOOKUP of var | MKCLOS of var*opcode list | APP | RET

let rec compile e =
  match e with
  | V x -> [LOOKUP x]
  | App (e1, e2) -> (compile e1) @ (compile e2) @ [APP]
  | Abs (x, e1) -> [MKCLOS (x, (compile e1) @ [RET])]
  | _ -> failwith "AST must be synt_to_lambdaed to pure lambda calculus first!"

module SECD (T : TABLE) = struct
  type secd_val = VClos of var* opcode list *secd_val T.t
  type dump_item = secd_val list *secd_val T.t *opcode list
  type secd_state = secd_val list* secd_val T.t* opcode list * dump_item list

  let step (state : secd_state) : secd_state =
    match state with
    | (s, gamma, LOOKUP x :: c', d) -> (T.lookup x gamma :: s, gamma, c', d)
    | (s, gamma, MKCLOS (x, c1) :: c', d) -> (VClos (x, c1, gamma) :: s, gamma, c', d)
    | (v2 :: VClos (x, c1, gamma1) :: s, gamma, APP :: c', d) ->
        ([], T.extend x v2 gamma1, c1, (s, gamma, c') :: d)
    | (v :: _, _, RET :: c'', (s, gamma, c') :: d) ->
        (v :: s, gamma, c', d)
    | _ -> failwith "SECD Machine stuck!"

  let rec run (state : secd_state) : secd_val =
    match state with
    | (v :: _, _, [], []) -> v
    | _ -> run (step state)
(*to convert opcode back to lambda and int bool (not necessary to implement but looks nice since church numerals otherwiise will be opcodes only)*)
(*church numeral opcodes to lambdaa and then beta reduced in main.ml to ast with values.*)
  let rec decompile (ops : opcode list) (stack : exp list) : exp =
    match ops with
    | [] -> List.hd stack
    | LOOKUP x :: rest -> decompile rest (V x :: stack)
    | MKCLOS (x, c) :: rest ->
        let rec remove_ret l = match l with
          | [RET] -> []
          | h :: t -> h :: remove_ret t
          | [] -> []
        in
        decompile rest (Abs (x, decompile (remove_ret c) []) :: stack)
    | APP :: rest ->
        (match stack with
        | e2 :: e1 :: s' -> decompile rest (App (e1, e2) :: s')
        | _ -> failwith "Decompile error: stack underflow on APP")
    | RET :: rest -> decompile rest stack
(*to solve val and closure from corresponding env to resolve*)
  let rec unpack_val (v : secd_val) : exp =
    match v with
    | VClos (x, c, env) ->
        let rec remove_ret l = match l with
          | [RET] -> []
          | h :: t -> h :: remove_ret t
          | [] -> []
        in
        let e_body = decompile (remove_ret c) [] in
        Abs (x, unpack_exp e_body (T.remove x env))
  and unpack_exp (e : exp) (env : secd_val T.t) : exp =
    match e with
    | V x -> (try unpack_val (T.lookup x env) with Failure _ -> V x)
    | Abs (x, e1) -> Abs (x, unpack_exp e1 (T.remove x env))
    | App (e1, e2) -> App (unpack_exp e1 env, unpack_exp e2 env)
    | _ -> e
  (*convert syntax to lambda and pass on to run machine*)
  let eval e =
    let pure_e = synt_to_lambda e in
    let opcodes = compile pure_e in
    run ([], T.empty, opcodes, [])
end
(*instead of implementing separately make a general table type to allow easy making *)
module KrivineList = Krivine(List_table)
module KrivineFun  = Krivine(Func_table)
module SECDList    = SECD(List_table)
module SECDFun     = SECD(Func_table)