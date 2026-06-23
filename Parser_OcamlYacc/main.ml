open Assignment2a
open Assignment2c_yacc

(*helper function to format atoms into a readable string *)
let show_atom = function
  | ID s -> Printf.sprintf "ID(\"%s\")" s
  | NUM n -> Printf.sprintf "NUM(%s)" (big_int_to_string n)
  | BOOL b -> Printf.sprintf "BOOL(%b)" b
  | SYMBOL s -> Printf.sprintf "SYMBOL(\"%s\")" s

(*helper function to recursively format expressions into a readable string *)
let rec show_exp = function
  | A a -> Printf.sprintf "A(%s)" (show_atom a)
  | L lst -> Printf.sprintf "L([%s])" (String.concat "; " (List.map show_exp lst))
let run_test test_string =
  Printf.printf "--------------------------------------------------\n";
  Printf.printf "Input:\n%s\n\n" test_string;
  let lexbuf = Lexing.from_string test_string in
  try
    match Assignment2c_yacc.main Assignment2b_lex.token lexbuf with
    | Some ast -> 
        Printf.printf "AST: %s\n" (show_exp ast)
    | None -> 
        print_endline "AST: Empty input."
  with
  | Failure msg -> 
      Printf.printf "Lexer Error: %s\n" msg
  | Parsing.Parse_error -> 
      print_endline "Parser Error: Syntax error."
let automated_tests = [
  (* 1. Basic Atoms *)
  "foo";
  "t";
  "()";
  "NIL"; (* Testing if normal identifiers map to ID *)
  
  (* 2. Numerals & BigInts *)
  "0";
  "1";
  "-1";
  "99999999999999999999999999999999999999999999999999";
  "-99999999999999999999999999999999999999999999999999";

  (* 3. Lists and Nesting *)
  "(a)";
  "(a b c)";
  "((a) (b c))";
  "((((((nested))))))";
  "()"; 

  (* 4. All Arithmetic Operators *)
  "(+ 1 2)";
  "(- 10 5)";
  "(* 3 4)";
  "(div 100 3)";
  "(mod 10 3)";
  "(+ (* 2 3) (- 10 (div 15 4)))"; (* Compound Arithmetic *)

  (* 5. All Comparison Operators *)
  "(= x 10)";
  "(> y 20)";
  "(< z 30)";
  "(>= a b)";
  "(<= c d)";
  "(=/= e f)";

  (* 6. LISP Core Keywords *)
  "(quote a)";
  "(quote (a b c))";
  "(atom x)";
  "(eq a b)";
  "(car (quote (a b c)))";
  "(cdr (quote (a b c)))";
  "(cons (quote a) (quote (b c)))";

  (* 7. c[ad]+r regex matching (Various lengths) *)
  "(car lst)";
  "(cdr lst)";
  "(cadr lst)";
  "(cddr lst)";
  "(caddr lst)";
  "(cddaar lst)";
  "(caadaar lst)";

  (* 8. Control Flow and Functions *)
  "(cond ((> x 0) x) (t (- 0 x)))"; (* Absolute value equivalent *)
  "(lambda (x y) (+ x y))";
  "(label fact (lambda (n) (cond ((= n 0) 1) (t (* n (fact (- n 1)))))))";
  "(defun square (x) (* x x))";

  (* 9. Whitespace, Newlines, and Mixed Spaces *)
  "(   foo \n \t bar   )";
  "(\n+\n1\n\t2\n)";

  (* 10. Multi-line & Comment Stress Test *)
  "(defun sum_list (lst)
    ;;; This function sums a list of numbers
    (cond ((eq lst ()) 0)        ; base case: empty list returns 0
          (t (+ (car lst)        ;; add first element to the...
                (sum_list (cdr lst)))))) ; ...recursive call of the rest";

  (* 11. Edge Cases (Identifier names containing numbers/dots) *)
  "variable123";
  "x.y";
  "foo_bar";
]

(* --- Parenthesis counter to support multi-line REPL --- *)
let rec count_parens s i parens =
  if i >= String.length s then parens
  else match s.[i] with
    | '(' -> count_parens s (i+1) (parens + 1)
    | ')' -> count_parens s (i+1) (parens - 1)
    | ';' -> parens (* Semicolon means the rest of the line is a comment, stop counting! *)
    | _ -> count_parens s (i+1) parens

let rec read_lisp_expression () =
  let first_line = read_line () in
  if first_line = "exit" || first_line = "quit" then exit 0
  else
    let rec read_more acc parens =
      (* If parens are balanced, we are done reading *)
      if parens <= 0 && String.trim acc <> "" then acc
      else begin
        print_string "  "; flush stdout; (* Indent to show we are waiting for more input *)
        let next_line = read_line () in
        let new_parens = count_parens next_line 0 parens in
        read_more (acc ^ "\n" ^ next_line) new_parens
      end
    in
    
    let initial_parens = count_parens first_line 0 0 in
    read_more first_line initial_parens

let () =
  print_endline "==================================================";
  print_endline "       RUNNING AUTOMATED PARSER TESTS             ";
  print_endline "==================================================";
  
  List.iter run_test automated_tests;

  print_endline "==================================================";
  print_endline "LITHP Parser :";
  while true do
    print_string "> ";
    flush stdout;
    
    let input_string = read_lisp_expression () in
    let lexbuf = Lexing.from_string input_string in
    
    try
      match Assignment2c_yacc.main Assignment2b_lex.token lexbuf with
      | Some ast -> 
          print_endline ("AST: " ^ show_exp ast)
      | None -> 
          print_endline "Empty input."
    with
    | Failure msg -> 
        Printf.printf "Lexer Error: %s\n" msg
    | Parsing.Parse_error -> 
        print_endline "Parser Error: Syntax error."
  done