# Name of the final executable
EXEC = lithp_parser

# Compiler tools
OCAMLC = ocamlc
OCAMLLEX = ocamllex
OCAMLYACC = ocamlyacc

# Default target
all: $(EXEC)

# Link everything together to create the executable
$(EXEC): assignment2a.cmo AST.cmo assignment2c_yacc.cmo assignment2b_lex.cmo assignment2d_type.cmo main.cmo
	$(OCAMLC) -o $(EXEC) assignment2a.cmo AST.cmo assignment2c_yacc.cmo assignment2b_lex.cmo assignment2d_type.cmo main.cmo

# 1. Compile Math and AST Types FIRST
assignment2a.cmo: assignment2a.ml
	$(OCAMLC) -c assignment2a.ml

AST.cmo: AST.ml assignment2a.cmo
	$(OCAMLC) -c AST.ml

# 2. Generate Parser files
assignment2c_yacc.ml assignment2c_yacc.mli: assignment2c_yacc.mly
	$(OCAMLYACC) assignment2c_yacc.mly

# 3. Compile Parser Interface
assignment2c_yacc.cmi: assignment2c_yacc.mli assignment2a.cmo AST.cmo
	$(OCAMLC) -c assignment2c_yacc.mli

# 4. Generate Lexer file
assignment2b_lex.ml: assignment2b_lex.mll
	$(OCAMLLEX) assignment2b_lex.mll

# 5. Compile Lexer
assignment2b_lex.cmo: assignment2b_lex.ml assignment2c_yacc.cmi assignment2a.cmo
	$(OCAMLC) -c assignment2b_lex.ml

# 6. Compile Parser Implementation
assignment2c_yacc.cmo: assignment2c_yacc.ml assignment2c_yacc.cmi assignment2a.cmo AST.cmo
	$(OCAMLC) -c assignment2c_yacc.ml

# 7. Compile Type Checker
assignment2d_type.cmo: assignment2d_type.ml AST.cmo assignment2a.cmo
	$(OCAMLC) -c assignment2d_type.ml

# 8. Compile Main REPL
main.cmo: main.ml assignment2a.cmo AST.cmo assignment2c_yacc.cmo assignment2b_lex.cmo assignment2d_type.cmo
	$(OCAMLC) -c main.ml

run: $(EXEC)
	./$(EXEC)

clean:
	rm -f *.cmo *.cmi assignment2b_lex.ml assignment2c_yacc.ml assignment2c_yacc.mli $(EXEC)

.PHONY: all run clean