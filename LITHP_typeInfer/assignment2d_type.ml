open Assignment2a
open AST 

type env = (string * typ) list

let rec list_typecheck l1 l2 =
  let rec mem x lst =
    match lst with
    | [] -> false
    | h :: t -> if h = x || h = TAny || x = TAny then true else mem x t
  in
  match l1 with
  | [] -> false
  | h :: t -> if h = TAny || mem h l2 then true else list_typecheck t l2

let rec mem_type x lst =
  match lst with
  | [] -> false
  | h :: t -> if h = x || h = TAny then true else mem_type x t

let rec list_length = function
  | L [] -> 0
  | L (hd :: tl) -> 1 + list_length (L tl)
  | _ -> 0

(*to check if a string matches the c[ad]+r regex pattern *)
let is_cadr_op s =
  let len = String.length s in
  if len < 3 || s.[0] <> 'c' || s.[len - 1] <> 'r' then false
  else
    let rec check_mid i =
      if i = len - 1 then true
      else if (s.[i] = 'a' || s.[i] = 'd') then check_mid (i+1)
      else false
    in check_mid 1
(* returns type and updated env*)
let rec infer_type (env : env) (expr : exp) : (typ list * env) =
  match expr with
  | A (NUM _) -> ([TInt], env)
  | A (BOOL true) -> ([TBool], env)
  | A (BOOL false) -> ([TBool; TList 0], env)
  | A (ID s) -> 
      let rec lookup key lst =
        match lst with
        | [] -> raise (TypeError ("Undefined ident: " ^ key))
        | (k, v) :: rest -> if k = key then [v] else lookup key rest
      in (lookup s env, env)

  | L [] -> ([TBool; TList 0], env)
  
  | L (A (SYMBOL op) :: args) ->
      (match op, args with
      | "quote", [arg] -> ([TList (list_length arg)], env)
      | "atom", [_] -> ([TBool], env)
      
      | "eq", [arg1; arg2] ->
          let (t1, env1) = infer_type env arg1 in
          let (t2, env2) = infer_type env1 arg2 in
          if list_typecheck t1 t2 then ([TBool], env2)
          else raise (TypeError "eq expects arguments of compatible types")
          
      (*dynamic car/cdr/cadr matching *)
      | op, [arg] when is_cadr_op op ->
          let (t1, env1) = infer_type env arg in
          let rec apply_op char_idx current_types =
            if char_idx = 0 then current_types
            else 
              let next_types = 
                if op.[char_idx] = 'd' then
                  let rec get_cdr_types lst =
                    match lst with
                    | [] -> []
                    | TList n :: rest when n > 0 -> TList (n - 1) :: get_cdr_types rest
                    | TAny :: rest -> TAny :: get_cdr_types rest
                    | _ :: rest -> get_cdr_types rest
                  in
                  let valid_types = get_cdr_types current_types in
                  if valid_types <> [] then valid_types else raise (TypeError (op ^ " expects List(n) where n > 0"))
                else
                  let rec has_valid_list lst =
                    match lst with
                    | [] -> false
                    | TList n :: _ when n > 0 -> true
                    | TAny :: _ -> true
                    | _ :: rest -> has_valid_list rest
                  in
                  if has_valid_list current_types then [TAny] else raise (TypeError (op ^ " expects List(n) where n > 0"))
              in
              apply_op (char_idx - 1) next_types
          in
          (apply_op (String.length op - 2) t1, env1)
          
      | "cons", [arg1; arg2] ->
          let (_, env1) = infer_type env arg1 in 
          let (t2, env2) = infer_type env1 arg2 in
          let rec get_cons_types lst =
            match lst with
            | [] -> []
            | TList n :: rest -> TList (n + 1) :: get_cons_types rest
            | TAny :: rest -> TAny :: get_cons_types rest
            | _ :: rest -> get_cons_types rest
          in
          let valid_types = get_cons_types t2 in
          if valid_types <> [] then (valid_types, env2)
          else raise (TypeError "cons expects second argument to be a List(n)")

      | "+", _ | "*", _ ->
          if List.length args < 2 then raise (TypeError (op ^ " expects at least 2 arguments"));
          let rec check_args e lst =
            match lst with
            | [] -> e
            | h :: t -> 
                let (th, e1) = infer_type e h in
                if not (mem_type TInt th) then raise (TypeError (op ^ " expects Ints"))
                else check_args e1 t
          in
          ([TInt], check_args env args)
          
      | "-", [a; b] | "div", [a; b] | "mod", [a; b] ->
          let (t1, env1) = infer_type env a in
          let (t2, env2) = infer_type env1 b in
          if mem_type TInt t1 && mem_type TInt t2 then ([TInt], env2)
          else raise (TypeError (op ^ " expects two Ints"))

      | "=", [a; b] | ">", [a; b] | "<", [a; b] | ">=", [a; b] | "<=", [a; b] | "=/=", [a; b] ->
          let (t1, env1) = infer_type env a in
          let (t2, env2) = infer_type env1 b in
          if mem_type TInt t1 && mem_type TInt t2 then ([TBool], env2)
          else raise (TypeError (op ^ " expects two Ints"))

      | "not", [a] ->
          let (t1, env1) = infer_type env a in
          if mem_type TBool t1 then ([TBool], env1) else raise (TypeError "not expects a Bool")
          
      | "and", [a; b] | "or", [a; b] ->
          let (t1, env1) = infer_type env a in
          let (t2, env2) = infer_type env1 b in
          if mem_type TBool t1 && mem_type TBool t2 then ([TBool], env2)
          else raise (TypeError (op ^ " expects two Bools"))

      | "cond", clauses ->
          let rec eval_clauses e cls acc =
            match cls with
            | [] -> (acc, e)
            | L [cond_expr; ret_expr] :: rest ->
                let (tc, e1) = infer_type e cond_expr in
                if mem_type TBool tc then
                  let (tr, e2) = infer_type e1 ret_expr in
                  eval_clauses e2 rest (tr @ acc)
                else raise (TypeError "cond conditions must be Bool")
            | _ -> raise (TypeError "cond clauses must be a List(2)")
          in
          let (ret_types, final_env) = eval_clauses env clauses [] in
          (List.sort_uniq compare ret_types, final_env)

      | "lambda", [L params; body] ->
          let param_len = List.length params in
          let rec build_env ps e =
            match ps with
            | [] -> e
            | A (ID p) :: rest -> build_env rest ((p, TAny) :: e)
            | _ -> raise (TypeError "lambda parameters must be identifiers")
          in
          let new_env = build_env params env in
          let (body_types, _) = infer_type new_env body in
          ([TFunc (param_len, body_types)], env) (* Lambda doesn't mutate outer env *)

      | "label", [A (ID f); L (A (SYMBOL "lambda") :: L params :: [body])]
      | "defun", [A (ID f); L params; body] ->
          let param_len = List.length params in
          let rec build_env ps e =
            match ps with
            | [] -> e
            | A (ID p) :: rest -> build_env rest ((p, TAny) :: e)
            | _ -> raise (TypeError "function parameters must be identifiers")
          in
          let env_with_f = (f, TFunc (param_len, [TAny])) :: env in
          let new_env = build_env params env_with_f in
          let (body_types, _) = infer_type new_env body in
          let final_func = TFunc (param_len, body_types) in
          ([final_func], (f, final_func) :: env)

      | _ -> 
          let func_types = 
            let rec lookup key lst =
              match lst with
              | [] -> raise (TypeError ("Unknown function or operator: " ^ key))
              | (k, v) :: rest -> if k = key then [v] else lookup key rest
            in lookup op env
          in
          let rec get_valid_funcs lst =
            match lst with
            | [] -> []                                 
            | TFunc (n, ret) :: rest -> (n, ret) :: get_valid_funcs rest
            | TAny :: rest -> (-1, [TAny]) :: get_valid_funcs rest
            | _ :: rest -> get_valid_funcs rest
          in
          let valid_funcs = get_valid_funcs func_types in
          (match valid_funcs with
          | [] -> raise (TypeError (op ^ " is not a function"))
          | (expected_args, ret_types) :: _ ->
              let rec eval_args e lst =
                match lst with
                | [] -> e
                | h :: t -> let (_, e1) = infer_type e h in eval_args e1 t
              in
              let final_env = eval_args env args in
              if expected_args = -1 || List.length args = expected_args then (ret_types, final_env)
              else raise (TypeError (Printf.sprintf "Incorrect number of arguments for %s. Expected %d." op expected_args)))
      )
      
  | L (func_expr :: args) ->
      let (func_types, env1) = infer_type env func_expr in
      let rec get_valid_funcs lst =
        match lst with
        | [] -> []                                 
        | TFunc (n, ret) :: rest -> (n, ret) :: get_valid_funcs rest
        | TAny :: rest -> (-1, [TAny]) :: get_valid_funcs rest
        | _ :: rest -> get_valid_funcs rest
      in
      let valid_funcs = get_valid_funcs func_types in
      (match valid_funcs with
      | [] -> raise (TypeError "Expression is not a valid function")
      | (expected_args, ret_types) :: _ ->
          let rec eval_args e lst =
            match lst with
            | [] -> e
            | h :: t -> let (_, e1) = infer_type e h in eval_args e1 t
          in
          let final_env = eval_args env1 args in
          if expected_args = -1 || List.length args = expected_args then (ret_types, final_env)
          else raise (TypeError "Incorrect number of arguments for anonymous function"))
  | A (SYMBOL s) -> raise (TypeError ("Unexpected bare symbol: " ^ s))