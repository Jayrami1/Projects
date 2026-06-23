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

%start main
%type <unit> main
%%

main:
    EOF { () }
%%