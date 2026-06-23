open Assignment2a
open AST
open Assignment2c_yacc
open Assignment2d_type

let show_atom = function
  | ID s -> Printf.sprintf "ID(\"%s\")" s
  | NUM n -> Printf.sprintf "NUM(%s)" (big_int_to_string n)
  | BOOL b -> Printf.sprintf "BOOL(%b)" b
  | SYMBOL s -> Printf.sprintf "SYMBOL(\"%s\")" s
let rec show_exp = function
  | A a -> Printf.sprintf "A(%s)" (show_atom a)
  | L lst -> Printf.sprintf "L([%s])" (String.concat "; " (List.map show_exp lst))

let rec show_typ = function
  | TInt -> "Int"
  | TBool -> "Bool"
  | TList n -> Printf.sprintf "List(%d)" n
  | TAny -> "Any"
  | TFunc (n, rets) -> 
      let ret_str = String.concat " | " (List.map show_typ rets) in
      Printf.sprintf "List(%d) -> [%s]" n ret_str

let show_type_list types =
  "[" ^ String.concat "; " (List.map show_typ types) ^ "]"

let rec count_parens s i parens =
  if i >= String.length s then parens
  else match s.[i] with
    | '(' -> count_parens s (i+1) (parens + 1)
    | ')' -> count_parens s (i+1) (parens - 1)
    | ';' -> parens 
    | _ -> count_parens s (i+1) parens

let process_file filename =
  let ic = open_in filename in
  
  let rec read_expr acc parens =
    try
      let line = input_line ic in
      let new_acc = if acc = "" then line else acc ^ "\n" ^ line in
      let new_parens = count_parens line 0 parens in
      if new_parens <= 0 && String.trim new_acc <> "" then Some new_acc
      else read_expr new_acc new_parens
    with End_of_file ->
      if String.trim acc <> "" then Some acc else None
  in
  
  (* Pure Functional Loop: State is passed as an argument! *)
  let rec loop current_env =
    match read_expr "" 0 with
    | Some input_string ->
        let lexbuf = Lexing.from_string input_string in
        
        let next_env = 
          try
            match Assignment2c_yacc.main Assignment2b_lex.token lexbuf with
            | Some ast -> 
                Printf.printf "Input:\n%s\n" (String.trim input_string);
                print_endline ("AST: " ^ show_exp ast);
                
                (* Unpack the tuple! *)
                let (inferred_types, updated_env) = infer_type current_env ast in
                print_endline ("Type: " ^ show_type_list inferred_types);
                print_newline ();
                
                (* Return the newly updated environment for the next loop *)
                updated_env
                
            | None -> current_env (* Empty comment line: keep the same env *)
          with
          | Failure msg -> 
              Printf.printf "Input:\n%s\n" (String.trim input_string);
              Printf.printf "Lexer Error: %s\n\n" msg;
              current_env
          | Parsing.Parse_error -> 
              Printf.printf "Input:\n%s\n" (String.trim input_string);
              print_endline "Parser Error: Syntax error.\n";
              current_env
          | TypeError msg ->
              Printf.printf "Type Error: %s\n\n" msg;
              current_env
        in
        (* pass the environment to the next iteration safely! *)
        loop next_env
        
    | None -> close_in ic
  in
  
  (*start the loop with an empty environment list [] *)
  loop []

let () =
  let filename = "input.txt" in
  if Sys.file_exists filename then begin
    print_endline "==================================================";
    Printf.printf "       READING LISP FROM: %s\n" filename;
    print_endline "==================================================";
    process_file filename
  end else begin
    Printf.printf "Error: Could not find file '%s' in the current directory.\n" filename;
  end