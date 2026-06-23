{
    open Assignment2c_yacc
    open Assignment2a
    (*since not defined this function in BigInt*)
    let string_to_bigint s =
    let is_neg = s.[0] = '-' in
    let s_clean = if is_neg then String.sub s 1 (String.length s -1) else s in
    let rec to_int_list i acc =
      if i < 0 then acc
      else to_int_list (i - 1) ((int_of_char s_clean.[i] - 48) :: acc)
    in
    let sign = if is_neg then Neg else NonNeg in
    B(sign, (to_int_list (String.length s_clean - 1)[]))
}
(*Regex definitions*)
let digit = ['0' - '9']
let alpha = ['a'-'z' 'A'-'Z']
let whitespace = ['\r' '\t' '\n' ' ']+
let ident = alpha(alpha|digit|'_')*'.'?

rule token = parse 

    (*Constants and punctuations*)
    | "(" {LPAREN}
    | ")" {RPAREN}
    | "'" {QUOTE}
    | "t" {TRUE}
    | "()" {NIL}

    (*Arithmetic Operators*)
    | "+" { PLUS }
    | "-" { MINUS }
    | "*" { TIMES }
    | "div" { DIV }
    | "mod" { MOD }

    (* Comparison Operator*)
    | "=" { EQ }
    | ">" { GT }
    | "<" { LT }
    | ">=" { GEQ }
    | "<=" { LEQ }
    | "=/=" { NEQ }

    (*Numerals using BigInt module and defined function required here*)
    | '-'?digit+ as n {BIG_INT(string_to_bigint n)}

    (* Keywords *)
    | "quote" { QUOTE_KW }
    | "atom" { ATOM }
    | "eq" { EQ_KW }
    | "car" { CAR }
    | "cdr" { CDR }
    | "cons" { CONS }
    | "cond" { COND }
    | "lambda" { LAMBDA }
    | "label" { LABEL }
    | "defun" { DEFUN }

    (*car/cdr operations regex c[ad]+r*)
    | 'c'['a' 'd']+'r' as res {CADR res}

    (*Comments definition*)
    | whitespace {WHITESPACE}
    | ";;;;" [^'\n']* {token lexbuf} (*File header*)
    | ";;;" [^'\n']* {token lexbuf} (*Whole line *)
    | ";;" [^'\n']* {token lexbuf} (*Comment idented*)
    | ";" [^'\n']* {token lexbuf} (*inline comment*)

    (*General Identifiers line list,eval etc.*)
    | ident as id {IDENT id}

    | eof {EOF}
    | _ as char { failwith (Printf.sprintf "Unexpected character: %c" char) }