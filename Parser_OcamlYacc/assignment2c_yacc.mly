%{
  (* Accessing bigint type from assignment2a.ml *)
    open Assignment2a
%}
// Symbols and Punctuation
%token LPAREN RPAREN NIL QUOTE
%token TRUE EOF

// Numerals using bigInt type
%token <Assignment2a.bigint> BIG_INT

// Arithmetic Operators 
%token PLUS MINUS TIMES DIV MOD

// Comparison Operators
%token EQ GT LT GEQ LEQ NEQ

// Keywords
%token QUOTE_KW ATOM EQ_KW CAR CDR CONS COND
%token LAMBDA LABEL DEFUN
%token <string>CADR
%token <string>IDENT
%token WHITESPACE
%start main
%type <Assignment2a.exp option> main

%%
main:
    | opt_ws EOF { None }
    | opt_ws elements opt_ws EOF { 
        match $2 with
        | [single_expr] -> Some(single_expr)
        | _ -> None
    }
opt_ws:
    | /* empty */ { () }
    | req_ws { () }
req_ws:
    | WHITESPACE { () }
    | WHITESPACE req_ws { () }

elements:
    | {[]}
    | expr { [$1] }
    | expr req_ws elements { $1 :: $3 }

expr:
    | atom { A($1) }
    | LPAREN opt_ws RPAREN { L([]) }
    | LPAREN opt_ws elements opt_ws RPAREN { L($3) }

atom:
    | IDENT { ID($1) }
    | BIG_INT { NUM($1) }
    | TRUE { BOOL(true) }
    | PLUS { SYMBOL("+") }
    | MINUS { SYMBOL("-") }
    | TIMES { SYMBOL("*") }
    | DIV { SYMBOL("div") }
    | MOD { SYMBOL("mod") }
    | EQ { SYMBOL("=") }
    | GT { SYMBOL(">") }
    | LT { SYMBOL("<") }
    | GEQ { SYMBOL(">=") }
    | LEQ { SYMBOL("<=") }
    | NEQ { SYMBOL("=/=") }
    | QUOTE_KW { SYMBOL("quote") }
    | ATOM { SYMBOL("atom") }
    | EQ_KW { SYMBOL("eq") }
    | CAR { SYMBOL("car") }
    | CDR { SYMBOL("cdr") }
    | CONS { SYMBOL("cons") }
    | COND { SYMBOL("cond") }
    | LAMBDA { SYMBOL("lambda") }
    | LABEL { SYMBOL("label") }
    | DEFUN { SYMBOL("defun") }
    | CADR { SYMBOL($1) }
    | NIL {BOOL(false)}
%%